import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import fontkit from '@pdf-lib/fontkit';
import {PDFDocument, rgb, type PDFFont} from 'pdf-lib';
import type {BookingRecord} from './src/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FORM6_TEMPLATE_PATH = path.resolve(
  __dirname,
  'public/assets/aistudio/2026.07.14_FORM-6-SHORT-LEAVE_LATEST_c367031c.pdf'
);

const FONT_BOLD_PATH = path.resolve(__dirname, 'public/fonts/DejaVuSans-Bold.ttf');
const FALLBACK_FONT_BOLD_PATH = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';

function formatReadableShortDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatInclusiveDates(dates: string[]): string {
  if (dates.length === 0) return '';
  if (dates.length === 1) return formatReadableShortDate(dates[0]);

  // Group nicely if all dates share the same month & year
  const parsed = dates.map((d) => {
    const [y, m, day] = d.split('-').map(Number);
    return {raw: d, y, m, day};
  });

  const allSameMonthYear = parsed.every(
    (p) => p.y === parsed[0].y && p.m === parsed[0].m
  );

  if (allSameMonthYear) {
    const monthLabel = new Date(Date.UTC(parsed[0].y, parsed[0].m - 1, 1)).toLocaleDateString(
      'en-US',
      {timeZone: 'UTC', month: 'short'}
    );
    return `${monthLabel} ${parsed.map((p) => p.day).join(', ')}, ${parsed[0].y}`;
  }

  return dates.map(formatReadableShortDate).join('; ');
}

function fitFontSize(
  text: string,
  font: PDFFont,
  maxWidth: number,
  preferredSize: number,
  minSize = 5.4
): number {
  let size = preferredSize;
  while (size > minSize && font.widthOfTextAtSize(text, size) > maxWidth) {
    size -= 0.3;
  }
  return size;
}

function drawFittedNameCell(
  page: ReturnType<PDFDocument['getPages']>[number],
  text: string,
  font: PDFFont,
  x: number,
  y: number,
  maxWidth: number,
  color: ReturnType<typeof rgb>
): void {
  const clean = text.trim().toUpperCase();
  if (!clean) return;
  const preferredSize = 8.5;
  if (font.widthOfTextAtSize(clean, preferredSize) <= maxWidth) {
    page.drawText(clean, {x, y, size: preferredSize, font, color});
    return;
  }

  // Try shrinking down to 6.5pt on one line first
  const singleSize = fitFontSize(clean, font, maxWidth, preferredSize, 6.5);
  if (font.widthOfTextAtSize(clean, singleSize) <= maxWidth) {
    page.drawText(clean, {x, y, size: singleSize, font, color});
    return;
  }

  // Otherwise split cleanly across two lines within the cell box
  const words = clean.split(/\s+/);
  if (words.length >= 2) {
    const mid = Math.ceil(words.length / 2);
    const line1 = words.slice(0, mid).join(' ');
    const line2 = words.slice(mid).join(' ');
    const lineSize = Math.min(
      fitFontSize(line1, font, maxWidth, 6.8, 4.8),
      fitFontSize(line2, font, maxWidth, 6.8, 4.8)
    );
    page.drawText(line1, {x, y: y + 3.2, size: lineSize, font, color});
    page.drawText(line2, {x, y: y - 4.0, size: lineSize, font, color});
    return;
  }

  const fallbackSize = fitFontSize(clean, font, maxWidth, 6.5, 4.5);
  page.drawText(clean, {x, y, size: fallbackSize, font, color});
}

export async function generateFilledForm6Pdf(record: BookingRecord): Promise<Uint8Array> {
  if (!fs.existsSync(FORM6_TEMPLATE_PATH)) {
    throw new Error('Form 6 PDF template file could not be found.');
  }

  const templateBytes = fs.readFileSync(FORM6_TEMPLATE_PATH);
  const doc = await PDFDocument.load(templateBytes);
  doc.registerFontkit(fontkit);

  const fontPath = fs.existsSync(FONT_BOLD_PATH) ? FONT_BOLD_PATH : FALLBACK_FONT_BOLD_PATH;
  const fontBytes = fs.readFileSync(fontPath);
  const fontBold = await doc.embedFont(fontBytes);

  const page = doc.getPages()[0];
  const ink = rgb(0.05, 0.1, 0.25);

  // 1. OFFICE/DEPARTMENT (keep printed "DEPED - NORTH CITY CENTRAL SCHOOL" intact; show department neatly in Box 1 header gap)
  const deptTag = `(${record.department})`;
  const deptSize = fitFontSize(deptTag, fontBold, 56, 6.0, 4.8);
  page.drawText(deptTag, {
    x: 146,
    y: 698.6,
    size: deptSize,
    font: fontBold,
    color: ink,
  });

  // 2. NAME: (Last) (First) (Middle) — FULL UNSHORTENED NAMES
  drawFittedNameCell(page, record.lastName, fontBold, 262.37, 684.5, 74, ink);
  drawFittedNameCell(
    page,
    record.firstName || record.firstInitials,
    fontBold,
    339,
    684.5,
    64,
    ink
  );

  if (record.middleInitial) {
    drawFittedNameCell(page, record.middleInitial, fontBold, 406, 684.5, 118, ink);
  }

  // 3. DATE OF FILING
  const filingText = record.filingDate || formatReadableShortDate(record.dates[0] ?? '');
  const filingSize = fitFontSize(filingText, fontBold, 74, 7.2, 5.5);
  page.drawText(filingText, {
    x: 124,
    y: 668.4,
    size: filingSize,
    font: fontBold,
    color: ink,
  });

  // 4. POSITION (if supplied)
  if (record.position) {
    const posSize = fitFontSize(record.position, fontBold, 72, 7.2, 5.4);
    page.drawText(record.position, {
      x: 260,
      y: 668.4,
      size: posSize,
      font: fontBold,
      color: ink,
    });
  }

  // 5. SALARY (if supplied)
  if (record.salary) {
    const salSize = fitFontSize(record.salary, fontBold, 70, 7.2, 5.4);
    page.drawText(record.salary, {
      x: 382,
      y: 668.4,
      size: salSize,
      font: fontBold,
      color: ink,
    });
  }

  // 6A. TYPE OF LEAVE TO BE AVAILED OF -> Others: Wellness Leave
  page.drawText('Wellness Leave', {
    x: 64,
    y: 410.5,
    size: 8.5,
    font: fontBold,
    color: ink,
  });

  // 6C. NUMBER OF WORKING DAYS APPLIED FOR
  const daysText = `${record.daysCount} Working ${record.daysCount === 1 ? 'Day' : 'Days'}`;
  page.drawText(daysText, {
    x: 72,
    y: 385.2,
    size: 8.5,
    font: fontBold,
    color: ink,
  });

  // 6C. INCLUSIVE DATES
  const inclusiveText = formatInclusiveDates(record.dates);
  const inclusiveSize = fitFontSize(inclusiveText, fontBold, 215, 8.0, 5.8);
  page.drawText(inclusiveText, {
    x: 72,
    y: 356.2,
    size: inclusiveSize,
    font: fontBold,
    color: ink,
  });

  return await doc.save();
}
