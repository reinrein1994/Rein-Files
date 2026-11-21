import crypto from 'crypto';
import express from 'express';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {createServer as createViteServer} from 'vite';
import * as XLSX from 'xlsx';
import {generateFilledForm6Pdf} from './server-form6.ts';
import {
  ANNUAL_WELLNESS_LIMIT,
  DEFAULT_DAILY_BOOKING_LIMIT,
  DEPARTMENTS,
  type AdminBookingsPayload,
  type AdminStatusPayload,
  type BookingRecord,
  type Department,
  type OccupiedByDepartment,
  type PersonnelUsagePayload,
  type PublicAppState,
} from './src/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(__dirname, 'data');
const BOOKINGS_JSON_PATH = resolveSafeDataPath('wellness-bookings.json');
const SETTINGS_JSON_PATH = resolveSafeDataPath('portal-settings.json');
const ADMIN_AUTH_JSON_PATH = resolveSafeDataPath('admin-auth.json');
const EXCEL_FILE_PATH = resolveSafeDataPath('nccs-wellness-leave.xlsx');

const DEFAULT_SCHOOL_LOGO = '/logos/nccs-seal.png';
const DEPED_LOGO = '/logos/deped.svg';

const SESSION_SECRET = process.env.SESSION_SECRET
  ? Buffer.from(process.env.SESSION_SECRET, 'utf-8')
  : crypto.randomBytes(32);
const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const MAX_LOGO_DATA_URL_LENGTH = 1_500_000; // ~1.1MB binary image max

interface PortalSettings {
  schoolLogoUrl: string;
  dailyLimits: Record<string, number>;
}

interface AdminAuthRecord {
  salt: string;
  passwordHash: string;
  createdAt: string;
}

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const authFailuresByIp = new Map<string, RateLimitBucket>();
const apiRequestsByIp = new Map<string, RateLimitBucket>();

function resolveSafeDataPath(filename: string): string {
  const safeBase = path.basename(filename);
  const resolved = path.resolve(DATA_DIR, safeBase);
  if (!resolved.startsWith(DATA_DIR + path.sep)) {
    throw new Error('Invalid data file path.');
  }
  return resolved;
}

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, {recursive: true, mode: 0o700});
  }
}

function writeFileSecure(filePath: string, content: string): void {
  ensureDataDir();
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(DATA_DIR + path.sep)) {
    throw new Error('Path outside data directory blocked.');
  }
  const tmpPath = `${resolved}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  fs.writeFileSync(tmpPath, content, {encoding: 'utf-8', mode: 0o600});
  fs.renameSync(tmpPath, resolved);
}

function getClientIp(req: express.Request): string {
  return String(req.ip || req.socket.remoteAddress || 'unknown').slice(0, 80);
}

function checkRateLimit(
  store: Map<string, RateLimitBucket>,
  key: string,
  limit: number,
  windowMs: number,
  increment = true
): {allowed: boolean; retryAfterSec: number} {
  const now = Date.now();
  const existing = store.get(key);
  if (!existing || existing.resetAt <= now) {
    if (increment) {
      store.set(key, {count: 1, resetAt: now + windowMs});
    }
    return {allowed: true, retryAfterSec: 0};
  }
  if (existing.count >= limit) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }
  if (increment) {
    existing.count += 1;
  }
  return {allowed: true, retryAfterSec: 0};
}

function constantTimeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf-8');
  const bufB = Buffer.from(b, 'utf-8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function hashPasswordScrypt(password: string, saltHex?: string): {salt: string; hash: string} {
  const salt = saltHex || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, Buffer.from(salt, 'hex'), 64);
  return {salt, hash: derived.toString('hex')};
}

function verifyPasswordScrypt(password: string, saltHex: string, expectedHashHex: string): boolean {
  try {
    const derived = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), 64);
    const expected = Buffer.from(expectedHashHex, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

function getEnvAdminPassword(): string {
  return String(process.env.ADMIN_PORTAL_PASSWORD ?? '').trim();
}

function readAdminAuthRecord(): AdminAuthRecord | null {
  if (!fs.existsSync(ADMIN_AUTH_JSON_PATH)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(ADMIN_AUTH_JSON_PATH, 'utf-8')) as Partial<AdminAuthRecord>;
    if (
      typeof raw.salt === 'string' &&
      typeof raw.passwordHash === 'string' &&
      raw.salt.length >= 16 &&
      raw.passwordHash.length >= 64
    ) {
      return {
        salt: raw.salt,
        passwordHash: raw.passwordHash,
        createdAt: String(raw.createdAt ?? ''),
      };
    }
    return null;
  } catch {
    return null;
  }
}

function getAdminStatus(): AdminStatusPayload {
  const envPass = getEnvAdminPassword();
  if (envPass.length > 0) {
    return {configured: true, usingEnvPassword: true};
  }
  const stored = readAdminAuthRecord();
  return {configured: stored !== null, usingEnvPassword: false};
}

function verifyAdminPassword(candidate: string): boolean {
  if (!candidate) return false;
  const envPass = getEnvAdminPassword();
  if (envPass.length > 0) {
    const hmacKey = crypto.createHash('sha256').update(SESSION_SECRET).digest();
    const digestCandidate = crypto.createHmac('sha256', hmacKey).update(candidate).digest();
    const digestExpected = crypto.createHmac('sha256', hmacKey).update(envPass).digest();
    return crypto.timingSafeEqual(digestCandidate, digestExpected);
  }
  const stored = readAdminAuthRecord();
  if (!stored) return false;
  return verifyPasswordScrypt(candidate, stored.salt, stored.passwordHash);
}

function issueAdminSessionToken(): {token: string; expiresAt: number} {
  const iat = Date.now();
  const expiresAt = iat + SESSION_TTL_MS;
  const payload = {
    role: 'admin',
    iat,
    exp: expiresAt,
    jti: crypto.randomBytes(12).toString('hex'),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encodedPayload)
    .digest('base64url');
  return {token: `${encodedPayload}.${sig}`, expiresAt};
}

function verifyAdminSessionToken(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [encodedPayload, providedSig] = parts;
  if (!encodedPayload || !providedSig) return false;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encodedPayload)
    .digest('base64url');
  if (!constantTimeEqualStrings(providedSig, expectedSig)) return false;

  try {
    const parsed = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf-8')) as {
      role?: unknown;
      exp?: unknown;
    };
    if (parsed.role !== 'admin') return false;
    if (typeof parsed.exp !== 'number' || Date.now() > parsed.exp) return false;
    return true;
  } catch {
    return false;
  }
}

function extractBearerToken(req: express.Request): string {
  const auth = String(req.headers.authorization ?? '').trim();
  if (auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  return '';
}

function isAuthorizedAdmin(req: express.Request): boolean {
  const bearer = extractBearerToken(req);
  if (!bearer) return false;
  return verifyAdminSessionToken(bearer);
}

function isSameOriginMutation(req: express.Request): boolean {
  const origin = req.headers.origin;
  if (!origin) return true; // Non-CORS / same-origin requests without Origin header
  const expectedHost = String(req.headers['x-forwarded-host'] || req.headers.host || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  if (!expectedHost) return false;
  try {
    const parsedOrigin = new URL(origin);
    return parsedOrigin.host.toLowerCase() === expectedHost;
  } catch {
    return false;
  }
}

function getTodayManilaStr(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function addDaysStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function toInitials(firstName: string): string {
  const parts = firstName
    .trim()
    .split(/[\s.-]+/)
    .map((p) => p.replace(/[^a-zA-Z]/g, ''))
    .filter(Boolean);
  if (parts.length === 0) return '';
  return parts.map((p) => `${p[0].toUpperCase()}.`).join(' ');
}

function formatManilaFilingDate(): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());
}

function cleanPlainText(val: unknown, maxLen: number): string {
  if (typeof val !== 'string') return '';
  return val
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, maxLen);
}

function cleanLastName(lastName: string): string {
  return cleanPlainText(lastName, 60);
}

function isValidDepartment(dept: unknown): dept is Department {
  return typeof dept === 'string' && (DEPARTMENTS as readonly string[]).includes(dept);
}

function isValidDateString(date: unknown): date is string {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() + 1 === m &&
    dt.getUTCDate() === d
  );
}

function expandDateRange(startDate: string, endDate: string): string[] {
  if (!isValidDateString(startDate) || !isValidDateString(endDate)) return [];
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const [ey, em, ed] = endDate.split('-').map(Number);
  const start = new Date(Date.UTC(sy, sm - 1, sd));
  const end = new Date(Date.UTC(ey, em - 1, ed));
  if (start > end) return [];
  const dates: string[] = [];
  const cursor = new Date(start);
  let guard = 0;
  while (cursor <= end && guard < 90) {
    const y = cursor.getUTCFullYear();
    const m = String(cursor.getUTCMonth() + 1).padStart(2, '0');
    const d = String(cursor.getUTCDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    guard += 1;
  }
  return dates;
}

function sanitizeDailyLimits(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const result: Record<string, number> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    if (!isValidDateString(key)) continue;
    const num = Number(val);
    if (Number.isInteger(num) && num >= 0 && num <= 100) {
      result[key] = num;
    }
  }
  return result;
}

function sanitizeSchoolLogoUrl(candidate: unknown): string | null {
  if (typeof candidate !== 'string') return null;
  const trimmed = candidate.trim();
  if (!trimmed || trimmed === DEFAULT_SCHOOL_LOGO) {
    return DEFAULT_SCHOOL_LOGO;
  }
  if (trimmed.length > MAX_LOGO_DATA_URL_LENGTH) {
    return null;
  }
  // Strictly permit raster data URLs only (blocks SVG/XSS, javascript:, external SSRF URLs)
  if (/^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/.test(trimmed)) {
    return trimmed;
  }
  return null;
}

function readSettings(): PortalSettings {
  ensureDataDir();
  if (!fs.existsSync(SETTINGS_JSON_PATH)) {
    const defaults: PortalSettings = {
      schoolLogoUrl: DEFAULT_SCHOOL_LOGO,
      dailyLimits: {},
    };
    writeFileSecure(SETTINGS_JSON_PATH, JSON.stringify(defaults, null, 2));
    return defaults;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(SETTINGS_JSON_PATH, 'utf-8')) as Partial<PortalSettings>;
    const safeLogo = sanitizeSchoolLogoUrl(parsed.schoolLogoUrl) || DEFAULT_SCHOOL_LOGO;
    return {
      schoolLogoUrl: safeLogo,
      dailyLimits: sanitizeDailyLimits(parsed.dailyLimits),
    };
  } catch {
    return {schoolLogoUrl: DEFAULT_SCHOOL_LOGO, dailyLimits: {}};
  }
}

function saveSettings(settings: PortalSettings): void {
  writeFileSecure(SETTINGS_JSON_PATH, JSON.stringify(settings, null, 2));
}

function normalizeBookingRecord(raw: Record<string, unknown>): BookingRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  if (!isValidDepartment(raw.department)) return null;

  let dates: string[] = [];
  if (Array.isArray(raw.dates)) {
    dates = Array.from(new Set(raw.dates.filter(isValidDateString))).sort();
  } else {
    const legacyDate = isValidDateString(raw.date) ? raw.date : null;
    const startDate = isValidDateString(raw.startDate) ? raw.startDate : legacyDate;
    const endDate = isValidDateString(raw.endDate) ? raw.endDate : startDate;
    if (startDate && endDate) {
      dates = expandDateRange(startDate, endDate);
    }
  }
  if (dates.length === 0) return null;

  const firstName = cleanPlainText(raw.firstName, 60);
  const middleInitial = cleanPlainText(raw.middleInitial, 40);
  const position = cleanPlainText(raw.position, 60);
  const salary = cleanPlainText(raw.salary, 40);
  const filingDate = cleanPlainText(raw.filingDate, 40);
  const form6TokenHash = cleanPlainText(raw.form6TokenHash, 128);
  const firstInitials = cleanPlainText(raw.firstInitials, 30);

  return {
    id: cleanPlainText(raw.id, 60) || `${Date.now()}`,
    timestamp: cleanPlainText(raw.timestamp, 60),
    filingDate: filingDate || cleanPlainText(raw.timestamp, 40).split(',')[0] || '',
    formattedName: cleanPlainText(raw.formattedName, 90),
    firstName: firstName || firstInitials,
    firstInitials,
    lastName: cleanPlainText(raw.lastName, 60),
    ...(middleInitial ? {middleInitial} : {}),
    ...(position ? {position} : {}),
    ...(salary ? {salary} : {}),
    department: raw.department,
    dates,
    daysCount: dates.length,
    dateLabel: dates.join(', '),
    ...(form6TokenHash ? {form6TokenHash} : {}),
  };
}

function readBookings(): BookingRecord[] {
  ensureDataDir();
  if (!fs.existsSync(BOOKINGS_JSON_PATH)) {
    writeFileSecure(BOOKINGS_JSON_PATH, JSON.stringify([], null, 2));
    return [];
  }
  try {
    const raw = fs.readFileSync(BOOKINGS_JSON_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => normalizeBookingRecord(item as Record<string, unknown>))
      .filter((item): item is BookingRecord => item !== null);
  } catch {
    return [];
  }
}

// Neutralizes Excel spreadsheet formula injection (=, +, -, @, tab, CR)
function escapeExcelCell(val: string | number | undefined): string | number {
  if (typeof val === 'number') return val;
  const text = String(val ?? '');
  if (/^[=+\-@\t\r]/.test(text)) {
    return `'${text}`;
  }
  return text;
}

function writeExcelWorkbook(bookings: BookingRecord[]): void {
  ensureDataDir();
  const rows = bookings.map((b) => ({
    Timestamp: escapeExcelCell(b.timestamp),
    'Last Name': escapeExcelCell(b.lastName),
    'First Name': escapeExcelCell(b.firstName || b.firstInitials),
    'Middle Name': escapeExcelCell(b.middleInitial ?? ''),
    'Personnel (Initials)': escapeExcelCell(b.formattedName),
    Department: escapeExcelCell(b.department),
    Position: escapeExcelCell(b.position ?? ''),
    Salary: escapeExcelCell(b.salary ?? ''),
    'Wellness Leave Dates': escapeExcelCell(b.dateLabel),
    Days: b.daysCount,
  }));

  const worksheet = XLSX.utils.json_to_sheet(
    rows.length > 0
      ? rows
      : [
          {
            Timestamp: '',
            'Last Name': '',
            'First Name': '',
            'Middle Name': '',
            'Personnel (Initials)': '',
            Department: '',
            Position: '',
            Salary: '',
            'Wellness Leave Dates': '',
            Days: '',
          },
        ]
  );

  worksheet['!cols'] = [
    {wch: 24},
    {wch: 20},
    {wch: 22},
    {wch: 18},
    {wch: 24},
    {wch: 18},
    {wch: 18},
    {wch: 14},
    {wch: 40},
    {wch: 8},
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Wellness Leave');
  const tmpExcel = resolveSafeDataPath(`nccs-wellness-leave.${crypto.randomBytes(6).toString('hex')}.tmp.xlsx`);
  XLSX.writeFile(workbook, tmpExcel);
  fs.renameSync(tmpExcel, EXCEL_FILE_PATH);
}

function saveBookings(bookings: BookingRecord[]): void {
  writeFileSecure(BOOKINGS_JSON_PATH, JSON.stringify(bookings, null, 2));
  writeExcelWorkbook(bookings);
}

function buildOccupiedByDepartment(bookings: BookingRecord[]): OccupiedByDepartment {
  const map = {} as OccupiedByDepartment;
  for (const dept of DEPARTMENTS) {
    map[dept] = [];
  }
  for (const b of bookings) {
    if (!isValidDepartment(b.department)) continue;
    for (const d of b.dates) {
      if (!map[b.department].includes(d)) {
        map[b.department].push(d);
      }
    }
  }
  return map;
}

function buildDailyCounts(bookings: BookingRecord[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const b of bookings) {
    for (const d of b.dates) {
      counts[d] = (counts[d] ?? 0) + 1;
    }
  }
  return counts;
}

function buildDailyCountsByDepartment(
  bookings: BookingRecord[]
): Record<Department, Record<string, number>> {
  const map = {} as Record<Department, Record<string, number>>;
  for (const dept of DEPARTMENTS) {
    map[dept] = {};
  }
  for (const b of bookings) {
    if (!isValidDepartment(b.department)) continue;
    for (const d of b.dates) {
      map[b.department][d] = (map[b.department][d] ?? 0) + 1;
    }
  }
  return map;
}

function computePersonnelUsageByYear(
  bookings: BookingRecord[],
  formattedName: string,
  department: Department
): Record<string, number> {
  const targetName = formattedName.trim().toLowerCase();
  const usedByYear: Record<string, number> = {};
  for (const b of bookings) {
    if (b.department === department && b.formattedName.trim().toLowerCase() === targetName) {
      for (const d of b.dates) {
        const yr = d.slice(0, 4);
        usedByYear[yr] = (usedByYear[yr] ?? 0) + 1;
      }
    }
  }
  return usedByYear;
}

function buildPublicState(bookings: BookingRecord[]): PublicAppState {
  const settings = readSettings();
  const todayStr = getTodayManilaStr();
  return {
    occupiedByDepartment: buildOccupiedByDepartment(bookings),
    dailyCounts: buildDailyCounts(bookings),
    dailyCountsByDepartment: buildDailyCountsByDepartment(bookings),
    dailyLimits: settings.dailyLimits,
    defaultDailyLimit: DEFAULT_DAILY_BOOKING_LIMIT,
    bookingCount: bookings.length,
    todayStr,
    minAdvanceDateStr: addDaysStr(todayStr, 14),
    schoolLogoUrl: settings.schoolLogoUrl,
    depedLogoUrl: DEPED_LOGO,
  };
}

function buildAdminPayload(bookings: BookingRecord[], token?: string, expiresAt?: number): AdminBookingsPayload {
  const settings = readSettings();
  const safeBookings = bookings.map(({form6TokenHash: _omit, ...rest}) => rest);
  return {
    ...(token ? {token, expiresAt} : {}),
    bookings: safeBookings,
    dailyLimits: settings.dailyLimits,
    defaultDailyLimit: DEFAULT_DAILY_BOOKING_LIMIT,
    schoolLogoUrl: settings.schoolLogoUrl,
  };
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // Security headers across all responses (keeps AI Studio iframe embeddable)
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    if (req.path.startsWith('/api')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.setHeader('Pragma', 'no-cache');
    }
    next();
  });

  app.use(express.json({limit: '2mb'}));

  // Reject malformed JSON payloads cleanly
  app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof SyntaxError) {
      res.status(400).json({error: 'Invalid request payload.'});
      return;
    }
    next(err);
  });

  // General API rate limit and same-origin guard for state mutations
  app.use('/api', (req, res, next) => {
    const ip = getClientIp(req);
    const rate = checkRateLimit(apiRequestsByIp, ip, 120, 60_000, true);
    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfterSec));
      res.status(429).json({error: 'Too many requests. Please wait a moment and try again.'});
      return;
    }
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && !isSameOriginMutation(req)) {
      res.status(403).json({error: 'Cross-origin mutation blocked.'});
      return;
    }
    next();
  });

  const initialBookings = readBookings();
  if (!fs.existsSync(EXCEL_FILE_PATH)) {
    writeExcelWorkbook(initialBookings);
  }

  app.get('/api/state', (_req, res) => {
    const bookings = readBookings();
    res.json(buildPublicState(bookings));
  });

  app.get('/api/my-usage', (req, res) => {
    const firstName = cleanPlainText(req.query.firstName, 60);
    const lastNameRaw = cleanPlainText(req.query.lastName, 60);
    const department = req.query.department;
    const initials = toInitials(firstName);
    const lastName = cleanLastName(lastNameRaw);
    if (!initials || !lastName || !isValidDepartment(department)) {
      const empty: PersonnelUsagePayload = {
        formattedName: '',
        usedByYear: {},
        limit: ANNUAL_WELLNESS_LIMIT,
      };
      res.json(empty);
      return;
    }
    const formattedName = `${initials} ${lastName}`;
    const bookings = readBookings();
    const payload: PersonnelUsagePayload = {
      formattedName,
      usedByYear: computePersonnelUsageByYear(bookings, formattedName, department),
      limit: ANNUAL_WELLNESS_LIMIT,
    };
    res.json(payload);
  });

  app.post('/api/bookings', (req, res) => {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      res.status(400).json({error: 'Invalid booking request.'});
      return;
    }

    const firstName = cleanPlainText(req.body.firstName, 60);
    const lastNameRaw = cleanPlainText(req.body.lastName, 60);
    const department = req.body.department;
    const rawDates: unknown[] = Array.isArray(req.body.dates)
      ? req.body.dates.slice(0, 31)
      : req.body.startDate
        ? expandDateRange(
            String(req.body.startDate),
            String(req.body.endDate ?? req.body.startDate)
          )
        : [];

    const initials = toInitials(firstName);
    const lastName = cleanLastName(lastNameRaw);

    if (!initials) {
      res.status(400).json({error: 'Please enter your first name.'});
      return;
    }
    if (!lastName) {
      res.status(400).json({error: 'Please enter your last name.'});
      return;
    }
    if (!isValidDepartment(department)) {
      res.status(400).json({error: 'Please select a valid department.'});
      return;
    }

    const dates: string[] = Array.from(new Set(rawDates.filter(isValidDateString))).sort();
    if (dates.length === 0) {
      res.status(400).json({error: 'Please choose at least one wellness leave date.'});
      return;
    }

    const todayStr = getTodayManilaStr();
    const pastDate = dates.find((d) => d < todayStr);
    if (pastDate) {
      res.status(400).json({
        pastDate: true,
        error: `Past dates (${pastDate}) cannot be booked.`,
      });
      return;
    }

    const minAdvanceDateStr = addDaysStr(todayStr, 14);
    const tooSoonDate = dates.find((d) => d < minAdvanceDateStr);
    if (tooSoonDate) {
      res.status(400).json({
        advanceNoticeViolation: true,
        invalidDate: tooSoonDate,
        minAdvanceDate: minAdvanceDateStr,
        error: `Wellness leave requests must be submitted at least 2 weeks before the applied date (earliest: ${minAdvanceDateStr}).`,
      });
      return;
    }

    const bookings = readBookings();
    const settings = readSettings();
    const deptCountsByDate = buildDailyCountsByDepartment(bookings)[department] ?? {};
    const isAdminDepartment = department === 'Administration';

    // Check per-level/department daily capacity (default 2/day, or admin exception; Administration exempt except closed day 0)
    const fullDate = dates.find((d) => {
      const limit = settings.dailyLimits[d] ?? DEFAULT_DAILY_BOOKING_LIMIT;
      if (limit === 0) return true;
      if (isAdminDepartment) return false;
      return (deptCountsByDate[d] ?? 0) >= limit;
    });

    if (fullDate) {
      const limit = settings.dailyLimits[fullDate] ?? DEFAULT_DAILY_BOOKING_LIMIT;
      res.status(409).json({
        occupied: true,
        dailyLimitReached: true,
        occupiedDate: fullDate,
        dailyLimit: limit,
        error:
          limit === 0
            ? `Bookings are closed on ${fullDate}.`
            : `Daily booking limit (${limit}) for ${department} has already been reached for ${fullDate}.`,
      });
      return;
    }

    const formattedName = `${initials} ${lastName}`;
    const selfBookedDates = new Set<string>();
    for (const b of bookings) {
      if (
        b.department === department &&
        b.formattedName.trim().toLowerCase() === formattedName.trim().toLowerCase()
      ) {
        for (const d of b.dates) selfBookedDates.add(d);
      }
    }
    const selfDupDate = dates.find((d) => selfBookedDates.has(d));
    if (selfDupDate) {
      res.status(409).json({
        error: `You already have a booked wellness leave on ${selfDupDate}.`,
      });
      return;
    }

    const existingByYear = computePersonnelUsageByYear(bookings, formattedName, department);
    const requestedByYear: Record<string, number> = {};
    for (const d of dates) {
      const yr = d.slice(0, 4);
      requestedByYear[yr] = (requestedByYear[yr] ?? 0) + 1;
    }

    for (const [yr, addCount] of Object.entries(requestedByYear)) {
      const used = existingByYear[yr] ?? 0;
      if (used + addCount > ANNUAL_WELLNESS_LIMIT) {
        res.status(400).json({
          limitExceeded: true,
          year: yr,
          usedDays: used,
          requestedDays: addCount,
          limit: ANNUAL_WELLNESS_LIMIT,
          error: `You have reached the ${ANNUAL_WELLNESS_LIMIT}-day wellness leave limit for ${yr}.`,
        });
        return;
      }
    }

    const middleInitial = cleanPlainText(req.body.middleInitial, 40);
    const position = cleanPlainText(req.body.position, 60);
    const salary = cleanPlainText(req.body.salary, 40);

    const now = new Date();
    const timestamp = now.toLocaleString('en-PH', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });

    const rawForm6Token = crypto.randomBytes(24).toString('hex');
    const form6TokenHash = crypto.createHash('sha256').update(rawForm6Token).digest('hex');

    const recordToSave: BookingRecord = {
      id: crypto.randomUUID(),
      timestamp,
      filingDate: formatManilaFilingDate(),
      formattedName,
      firstName,
      firstInitials: initials,
      lastName,
      ...(middleInitial ? {middleInitial} : {}),
      ...(position ? {position} : {}),
      ...(salary ? {salary} : {}),
      department,
      dates,
      daysCount: dates.length,
      dateLabel: dates.join(', '),
      form6TokenHash,
    };

    bookings.push(recordToSave);
    saveBookings(bookings);

    const clientRecord: BookingRecord = {
      ...recordToSave,
      form6Token: rawForm6Token,
    };
    delete clientRecord.form6TokenHash;

    res.status(201).json({
      record: clientRecord,
      usedByYear: computePersonnelUsageByYear(bookings, formattedName, department),
      publicState: buildPublicState(bookings),
    });
  });

  // Administration Portal Endpoints (scrypt hashed password + HMAC Bearer session)
  app.get('/api/admin/status', (_req, res) => {
    res.json(getAdminStatus());
  });

  app.post('/api/admin/setup', (req, res) => {
    const status = getAdminStatus();
    if (status.configured) {
      res.status(409).json({error: 'Administration Portal password is already configured.'});
      return;
    }

    const password = typeof req.body?.password === 'string' ? req.body.password.trim() : '';
    const confirmPassword =
      typeof req.body?.confirmPassword === 'string' ? req.body.confirmPassword.trim() : '';

    if (password.length < 8 || password.length > 72) {
      res.status(400).json({error: 'Password must be between 8 and 72 characters.'});
      return;
    }
    if (password !== confirmPassword) {
      res.status(400).json({error: 'Passwords do not match.'});
      return;
    }

    const {salt, hash} = hashPasswordScrypt(password);
    const authRecord: AdminAuthRecord = {
      salt,
      passwordHash: hash,
      createdAt: new Date().toISOString(),
    };
    writeFileSecure(ADMIN_AUTH_JSON_PATH, JSON.stringify(authRecord, null, 2));

    const {token, expiresAt} = issueAdminSessionToken();
    const bookings = readBookings();
    res.status(201).json(buildAdminPayload(bookings, token, expiresAt));
  });

  app.post('/api/admin/unlock', (req, res) => {
    const status = getAdminStatus();
    if (!status.configured) {
      res.status(409).json({
        needsSetup: true,
        error: 'Please create the Administration Portal password first.',
      });
      return;
    }

    const ip = getClientIp(req);
    const lockCheck = checkRateLimit(authFailuresByIp, ip, 6, 15 * 60_000, false);
    if (!lockCheck.allowed) {
      res.setHeader('Retry-After', String(lockCheck.retryAfterSec));
      res.status(429).json({
        error: `Too many failed attempts. Try again in ${Math.ceil(lockCheck.retryAfterSec / 60)} minute(s).`,
      });
      return;
    }

    const password = typeof req.body?.password === 'string' ? req.body.password.trim() : '';
    if (!verifyAdminPassword(password)) {
      checkRateLimit(authFailuresByIp, ip, 6, 15 * 60_000, true);
      res.status(401).json({error: 'Incorrect Administration Portal password.'});
      return;
    }

    authFailuresByIp.delete(ip);
    const {token, expiresAt} = issueAdminSessionToken();
    const bookings = readBookings();
    res.json(buildAdminPayload(bookings, token, expiresAt));
  });

  app.get('/api/admin/bookings', (req, res) => {
    if (!isAuthorizedAdmin(req)) {
      res.status(401).json({error: 'Administration Portal session required.'});
      return;
    }
    const bookings = readBookings();
    res.json(buildAdminPayload(bookings));
  });

  app.delete('/api/admin/bookings/:id', (req, res) => {
    if (!isAuthorizedAdmin(req)) {
      res.status(401).json({error: 'Administration Portal session required.'});
      return;
    }
    const id = cleanPlainText(req.params.id, 80);
    const bookings = readBookings();
    const next = bookings.filter((b) => b.id !== id);
    if (next.length === bookings.length) {
      res.status(404).json({error: 'Booking not found.'});
      return;
    }
    saveBookings(next);
    res.json({
      bookings: next,
      publicState: buildPublicState(next),
    });
  });

  app.put('/api/admin/school-logo', (req, res) => {
    if (!isAuthorizedAdmin(req)) {
      res.status(401).json({error: 'Administration Portal session required.'});
      return;
    }
    const safeLogo = sanitizeSchoolLogoUrl(req.body?.schoolLogoUrl);
    if (!safeLogo) {
      res.status(400).json({
        error: 'Logo must be a valid PNG, JPEG, or WebP image under 1MB.',
      });
      return;
    }
    const current = readSettings();
    const settings: PortalSettings = {
      ...current,
      schoolLogoUrl: safeLogo,
    };
    saveSettings(settings);
    const bookings = readBookings();
    res.json({
      schoolLogoUrl: settings.schoolLogoUrl,
      publicState: buildPublicState(bookings),
    });
  });

  app.put('/api/admin/daily-limit', (req, res) => {
    if (!isAuthorizedAdmin(req)) {
      res.status(401).json({error: 'Administration Portal session required.'});
      return;
    }
    const date = typeof req.body?.date === 'string' ? req.body.date.trim() : '';
    const maxTeachers = Number(req.body?.maxTeachers);
    if (!isValidDateString(date)) {
      res.status(400).json({error: 'Please pick a valid YYYY-MM-DD date.'});
      return;
    }
    if (!Number.isInteger(maxTeachers) || maxTeachers < 0 || maxTeachers > 100) {
      res.status(400).json({error: 'Teacher limit must be a whole number from 0 to 100.'});
      return;
    }
    const current = readSettings();
    const nextLimits = {...current.dailyLimits, [date]: maxTeachers};
    const settings: PortalSettings = {...current, dailyLimits: nextLimits};
    saveSettings(settings);
    const bookings = readBookings();
    res.json({
      dailyLimits: nextLimits,
      publicState: buildPublicState(bookings),
    });
  });

  app.delete('/api/admin/daily-limit/:date', (req, res) => {
    if (!isAuthorizedAdmin(req)) {
      res.status(401).json({error: 'Administration Portal session required.'});
      return;
    }
    const {date} = req.params;
    if (!isValidDateString(date)) {
      res.status(400).json({error: 'Invalid date.'});
      return;
    }
    const current = readSettings();
    const nextLimits = {...current.dailyLimits};
    delete nextLimits[date];
    const settings: PortalSettings = {...current, dailyLimits: nextLimits};
    saveSettings(settings);
    const bookings = readBookings();
    res.json({
      dailyLimits: nextLimits,
      publicState: buildPublicState(bookings),
    });
  });

  app.get('/api/bookings/:id/form6.pdf', async (req, res) => {
    const id = cleanPlainText(req.params.id, 80);
    const token = String(req.headers['x-form6-token'] ?? '').trim();

    const bookings = readBookings();
    const record = bookings.find((b) => b.id === id);
    if (!record) {
      res.status(404).json({error: 'Booking record not found.'});
      return;
    }

    const tokenHash = token ? crypto.createHash('sha256').update(token).digest('hex') : '';
    const tokenAuthorized = Boolean(
      record.form6TokenHash && tokenHash && constantTimeEqualStrings(tokenHash, record.form6TokenHash)
    );
    if (!tokenAuthorized && !isAuthorizedAdmin(req)) {
      res.status(401).json({error: 'Authorization required to download Form 6.'});
      return;
    }

    try {
      const pdfBytes = await generateFilledForm6Pdf(record);
      const safeLast = record.lastName.replace(/[^a-zA-Z0-9_-]+/g, '_') || 'Personnel';
      const filename = `Form6-Wellness-Leave-${safeLast}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(Buffer.from(pdfBytes));
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to generate Form 6 PDF.',
      });
    }
  });

  app.get('/api/export.xlsx', (req, res) => {
    if (!isAuthorizedAdmin(req)) {
      res.status(401).json({error: 'Administration Portal session required.'});
      return;
    }
    const bookings = readBookings();
    writeExcelWorkbook(bookings);
    res.download(EXCEL_FILE_PATH, 'NCCS-Wellness-Leave-Bookings.xlsx');
  });

  // Never allow direct static/Vite middleware access to server data, secrets, or backend files
  app.use((req, res, next) => {
    const lower = req.path.toLowerCase();
    if (
      lower === '/data' ||
      lower.startsWith('/data/') ||
      lower.startsWith('/.env') ||
      lower.startsWith('/.git') ||
      lower.startsWith('/server')
    ) {
      res.status(403).json({error: 'Access denied.'});
      return;
    }
    next();
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {middlewareMode: true},
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NCCS Wellness Leave Booking listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
