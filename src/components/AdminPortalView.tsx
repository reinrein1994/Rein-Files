import {useEffect, useState} from 'react';
import type {ChangeEvent, FormEvent} from 'react';
import {
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Download,
  Copy,
  Check,
  FileSpreadsheet,
  Upload,
  Trash2,
  Users,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import type {AdminBookingsPayload, AdminStatusPayload, BookingRecord} from '../types';

interface AdminPortalViewProps {
  adminToken: string | null;
  adminData: AdminBookingsPayload | null;
  dailyCounts: Record<string, number>;
  onSetupPassword: (password: string, confirmPassword: string) => Promise<void>;
  onUnlock: (password: string) => Promise<void>;
  onLock: () => void;
  onDeleteBooking: (id: string) => Promise<void>;
  onUpdateSchoolLogo: (logoUrl: string) => Promise<void>;
  onSetDailyLimit: (date: string, maxTeachers: number) => Promise<void>;
  onRemoveDailyLimit: (date: string) => Promise<void>;
}

function compressLogoFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      reject(new Error('Please upload a PNG, JPEG, or WebP image file.'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read logo file.'));
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const img = new window.Image();
      img.onerror = () => reject(new Error('Invalid image file.'));
      img.onload = () => {
        const maxDim = 360;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

async function authenticatedDownload(
  url: string,
  token: string,
  fallbackFilename: string
): Promise<void> {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(json?.error || 'Download failed. Please unlock the portal again.');
  }
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = fallbackFilename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
}

export function AdminPortalView({
  adminToken,
  adminData,
  dailyCounts,
  onSetupPassword,
  onUnlock,
  onLock,
  onDeleteBooking,
  onUpdateSchoolLogo,
  onSetDailyLimit,
  onRemoveDailyLimit,
}: AdminPortalViewProps) {
  const [adminStatus, setAdminStatus] = useState<AdminStatusPayload | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [confirmInput, setConfirmInput] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [authError, setAuthError] = useState('');

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [logoStatus, setLogoStatus] = useState('');
  const [exportStatus, setExportStatus] = useState('');
  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const [downloadingForm6Id, setDownloadingForm6Id] = useState<string | null>(null);

  const [exceptionDate, setExceptionDate] = useState('');
  const [exceptionMax, setExceptionMax] = useState('3');
  const [savingLimit, setSavingLimit] = useState(false);
  const [limitStatus, setLimitStatus] = useState('');

  useEffect(() => {
    if (adminToken && adminData) return;
    fetch('/api/admin/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((status: AdminStatusPayload | null) => {
        if (status) setAdminStatus(status);
      })
      .catch(() => {});
  }, [adminToken, adminData]);

  async function handleSetupSubmit(e: FormEvent) {
    e.preventDefault();
    setAuthError('');
    if (passwordInput.trim().length < 8) {
      setAuthError('Password must be at least 8 characters long.');
      return;
    }
    if (passwordInput.trim() !== confirmInput.trim()) {
      setAuthError('Passwords do not match.');
      return;
    }
    setUnlocking(true);
    try {
      await onSetupPassword(passwordInput.trim(), confirmInput.trim());
      setPasswordInput('');
      setConfirmInput('');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Failed to configure password.');
    } finally {
      setUnlocking(false);
    }
  }

  async function handleUnlockSubmit(e: FormEvent) {
    e.preventDefault();
    setAuthError('');
    if (!passwordInput.trim()) {
      setAuthError('Please enter the Administration Portal password.');
      return;
    }
    setUnlocking(true);
    try {
      await onUnlock(passwordInput.trim());
      setPasswordInput('');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Invalid password.');
    } finally {
      setUnlocking(false);
    }
  }

  if (!adminToken || !adminData) {
    const needsSetup = adminStatus !== null && !adminStatus.configured;

    return (
      <div className="max-w-[460px] mx-auto">
        <div className="glass p-5 sm:p-6 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-full bg-white/85 border border-white flex items-center justify-center text-[#1fa76b] shadow-[0_10px_20px_rgba(60,80,130,0.14)]">
            {needsSetup ? <ShieldCheck className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
          </div>

          <div>
            <h2 className="m-0 text-[1.15rem] font-extrabold text-[#1f2740]">
              {needsSetup ? 'Set Administration Password' : 'Administration Portal'}
            </h2>
            <p className="m-0 mt-1 text-[0.83rem] font-semibold text-[#7a849c]">
              {needsSetup
                ? 'First-time setup: create a secure administrator password (8+ characters) to protect Excel records and portal controls.'
                : 'Enter the administrator password to access self-stored Excel records, daily limits, and booking controls.'}
            </p>
          </div>

          <form
            onSubmit={(e) => void (needsSetup ? handleSetupSubmit(e) : handleUnlockSubmit(e))}
            className="space-y-3 text-left"
          >
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder={needsSetup ? 'Create password (min. 8 chars)' : 'Enter password'}
                autoComplete={needsSetup ? 'new-password' : 'current-password'}
                className="w-full px-4 py-3 pr-11 rounded-[16px] border-[1.5px] border-[#788cbe]/25 bg-white/85 text-[0.96rem] font-bold text-[#1f2740] outline-none focus:border-[#2fbf7f] focus:shadow-[0_0_0_4px_rgba(47,191,127,0.18)]"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7a849c] hover:text-[#1f2740] p-1 cursor-pointer"
                aria-label={showPass ? 'Hide password' : 'Show password'}
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {needsSetup && (
              <input
                type={showPass ? 'text' : 'password'}
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                placeholder="Confirm administrator password"
                autoComplete="new-password"
                className="w-full px-4 py-3 rounded-[16px] border-[1.5px] border-[#788cbe]/25 bg-white/85 text-[0.96rem] font-bold text-[#1f2740] outline-none focus:border-[#2fbf7f] focus:shadow-[0_0_0_4px_rgba(47,191,127,0.18)]"
              />
            )}

            {authError && (
              <div className="p-2.5 rounded-[12px] bg-red-50 border border-red-200 text-[0.8rem] font-bold text-red-600 text-center">
                {authError}
              </div>
            )}

            <button type="submit" disabled={unlocking} className="cam-btn">
              {unlocking
                ? 'Securing…'
                : needsSetup
                  ? 'Save Password & Unlock Portal'
                  : 'Unlock Administration Portal'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const bookings = adminData.bookings;
  const reversed = [...bookings].reverse();

  async function handleDownloadExcel() {
    if (!adminToken || downloadingExcel) return;
    setDownloadingExcel(true);
    setExportStatus('');
    try {
      await authenticatedDownload(
        '/api/export.xlsx',
        adminToken,
        'NCCS-Wellness-Leave-Bookings.xlsx'
      );
      setExportStatus('Excel records (.xlsx) downloaded ✓');
    } catch (err) {
      setExportStatus(err instanceof Error ? err.message : 'Failed to download Excel file.');
    } finally {
      setDownloadingExcel(false);
    }
  }

  async function handleDownloadAdminForm6(record: BookingRecord) {
    if (!adminToken || downloadingForm6Id) return;
    setDownloadingForm6Id(record.id);
    try {
      const safeLast = record.lastName.replace(/[^a-zA-Z0-9_-]+/g, '_') || 'Personnel';
      await authenticatedDownload(
        `/api/bookings/${encodeURIComponent(record.id)}/form6.pdf`,
        adminToken,
        `Form6-Wellness-Leave-${safeLast}.pdf`
      );
    } catch (err) {
      setExportStatus(err instanceof Error ? err.message : 'Could not download Form 6 PDF.');
    } finally {
      setDownloadingForm6Id(null);
    }
  }

  async function copySingleRow(record: BookingRecord) {
    const tsv = `${record.timestamp}\t${record.formattedName}\t${record.department}\t${record.dateLabel}\t${record.daysCount}`;
    try {
      await navigator.clipboard.writeText(tsv);
      setCopiedId(record.id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      setCopiedId(null);
    }
  }

  async function handleLogoUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoStatus('Updating school logo…');
    try {
      const dataUrl = await compressLogoFile(file);
      await onUpdateSchoolLogo(dataUrl);
      setLogoStatus('School logo updated ✓');
    } catch (err) {
      setLogoStatus(err instanceof Error ? err.message : 'Failed to update logo.');
    }
    e.target.value = '';
  }

  return (
    <div className="space-y-4">
      {/* Top Grid on Desktop: Excel Download + School Logo + Daily Limits */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="space-y-4">
          {/* Header + Built-in Self-Maintained Excel Records Download */}
          <div className="glass p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-[14px] bg-[#2fbf7f]/15 text-[#1fa76b] flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="m-0 text-[1rem] font-extrabold text-[#1f2740]">
                    Administration Portal
                  </h2>
                  <p className="m-0 text-[0.76rem] font-bold text-[#1fa76b]">
                    Encrypted Session · Built-In Excel Records
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onLock}
                className="btn-3d-white px-3 py-1.5 text-[0.76rem] !text-[#7a849c] hover:!text-[#1f2740] inline-flex items-center gap-1"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>Lock</span>
              </button>
            </div>

            <p className="m-0 text-[0.78rem] font-semibold text-[#5a6684] leading-relaxed">
              The system automatically builds and updates the official Excel workbook (
              <strong>{bookings.length}</strong>{' '}
              {bookings.length === 1 ? 'record' : 'records'}) on the server. Download it anytime you need a copy.
            </p>

            <button
              type="button"
              disabled={downloadingExcel}
              onClick={() => void handleDownloadExcel()}
              className="cam-btn flex items-center justify-center gap-2 text-[0.9rem] py-3.5"
            >
              <Download className="w-4 h-4" />
              <span>
                {downloadingExcel ? 'Preparing Excel Workbook…' : 'Download Excel Records (.xlsx)'}
              </span>
            </button>

            {exportStatus && (
              <p className="m-0 text-[0.76rem] font-bold text-[#1fa76b] text-center">
                {exportStatus}
              </p>
            )}
          </div>

          {/* School Logo Setting */}
          <div className="glass p-4 sm:p-5 space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="m-0 text-[0.92rem] font-extrabold text-[#1f2740]">
                  School Logo Emblem
                </h3>
                <p className="m-0 text-[0.75rem] font-semibold text-[#7a849c]">
                  Upload an official PNG, JPEG, or WebP seal image to update the header and 16-bit submit animation.
                </p>
              </div>
              <img
                src={adminData.schoolLogoUrl}
                alt="School logo preview"
                className="h-12 w-auto object-contain shrink-0"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <label className="btn-3d-active-green px-3.5 py-2 text-[0.78rem] inline-flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload School Logo</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => void handleLogoUpload(e)}
                />
              </label>
            </div>

            {logoStatus && (
              <p className="m-0 text-[0.76rem] font-bold text-[#1fa76b]">{logoStatus}</p>
            )}
          </div>
        </div>

        {/* Daily Teacher Capacity Exceptions */}
        <div className="glass p-4 sm:p-5 space-y-3">
          <div className="flex items-start gap-2.5">
            <div className="w-9 h-9 rounded-[10px] bg-[#2fbf7f]/15 text-[#1fa76b] flex items-center justify-center shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="m-0 text-[0.92rem] font-extrabold text-[#1f2740]">
                Daily Teacher Limit Exceptions
              </h3>
              <p className="m-0 text-[0.75rem] font-semibold text-[#7a849c]">
                Default is <strong>{adminData.defaultDailyLimit} teachers/day</strong> per grade level or department (Administration exempt). Set a custom limit (e.g. 0 to close, or 3–10) for specific dates.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
            <div className="sm:col-span-6">
              <label
                htmlFor="exception-date"
                className="block text-[0.74rem] font-extrabold text-[#7a849c] mb-1"
              >
                Date
              </label>
              <input
                id="exception-date"
                type="date"
                value={exceptionDate}
                onChange={(e) => setExceptionDate(e.target.value)}
                className="w-full px-3 py-2 rounded-[10px] border-[1.5px] border-[#788cbe]/25 bg-white/90 text-[0.84rem] font-bold text-[#1f2740] outline-none focus:border-[#2fbf7f]"
              />
            </div>

            <div className="sm:col-span-3">
              <label
                htmlFor="exception-max"
                className="block text-[0.74rem] font-extrabold text-[#7a849c] mb-1"
              >
                Max Teachers
              </label>
              <input
                id="exception-max"
                type="number"
                min={0}
                max={100}
                step={1}
                value={exceptionMax}
                onChange={(e) => setExceptionMax(e.target.value)}
                className="w-full px-3 py-2 rounded-[10px] border-[1.5px] border-[#788cbe]/25 bg-white/90 text-[0.84rem] font-bold text-[#1f2740] outline-none focus:border-[#2fbf7f]"
              />
            </div>

            <div className="sm:col-span-3">
              <button
                type="button"
                disabled={savingLimit || !exceptionDate}
                onClick={() => {
                  const parsed = Number(exceptionMax);
                  if (!exceptionDate || !Number.isInteger(parsed) || parsed < 0 || parsed > 100) {
                    setLimitStatus('Enter a date and whole number (0–100).');
                    return;
                  }
                  setSavingLimit(true);
                  setLimitStatus('');
                  void onSetDailyLimit(exceptionDate, parsed)
                    .then(() => {
                      setLimitStatus(`Saved limit: ${parsed} teacher(s) on ${exceptionDate} ✓`);
                    })
                    .catch((err: Error) => setLimitStatus(err.message))
                    .finally(() => setSavingLimit(false));
                }}
                className="cam-btn !py-2.5 !px-3 text-[0.8rem]"
              >
                {savingLimit ? 'Saving…' : 'Set Limit'}
              </button>
            </div>
          </div>

          {limitStatus && (
            <p className="m-0 text-[0.76rem] font-bold text-[#1fa76b]">{limitStatus}</p>
          )}

          {Object.keys(adminData.dailyLimits || {}).length > 0 && (
            <div className="space-y-1.5 pt-1">
              {Object.entries(adminData.dailyLimits)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([dateKey, limitVal]) => {
                  const booked = dailyCounts[dateKey] ?? 0;
                  return (
                    <div
                      key={dateKey}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-[10px] bg-white/85 border border-[#cfd8e8]"
                    >
                      <div className="text-[0.78rem] font-extrabold text-[#1f2740]">
                        <span>{dateKey}</span>
                        <span className="ml-2 text-[#1fa76b]">
                          Max {limitVal} {limitVal === 1 ? 'teacher' : 'teachers'}
                        </span>
                        <span className="ml-2 text-[#7a849c] font-bold">
                          ({booked} booked)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => void onRemoveDailyLimit(dateKey)}
                        className="btn-3d-white px-2.5 py-1 text-[0.72rem] inline-flex items-center gap-1"
                        title="Reset to default 2 teachers"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Reset (2)</span>
                      </button>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      {/* Booking Records */}
      <div className="text-center lg:text-left font-extrabold text-[0.86rem] text-[#7a849c] px-1">
        {bookings.length} booking{bookings.length === 1 ? '' : 's'} recorded
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {reversed.map((b) => (
          <div
            key={b.id}
            className="glass px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
          >
            <div className="min-w-0">
              <div className="text-[0.95rem] font-extrabold text-[#1f2740] truncate">
                {b.lastName}, {b.firstName || b.firstInitials}
                {b.middleInitial ? ` ${b.middleInitial}` : ''}
              </div>
              <div className="text-[0.8rem] font-bold text-[#1fa76b] break-words">
                {b.department} · {b.dateLabel} ({b.daysCount} {b.daysCount === 1 ? 'day' : 'days'})
              </div>
              <div className="text-[0.74rem] font-semibold text-[#7a849c] mt-0.5">
                {b.timestamp}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              <button
                type="button"
                disabled={downloadingForm6Id === b.id}
                onClick={() => void handleDownloadAdminForm6(b)}
                className="btn-3d-active-green px-2.5 py-2 text-[0.74rem] inline-flex items-center gap-1"
                title="Download filled Form 6 PDF"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{downloadingForm6Id === b.id ? '…' : 'Form 6'}</span>
              </button>

              <button
                type="button"
                onClick={() => void copySingleRow(b)}
                className="btn-3d-white px-2.5 py-2 text-[0.74rem] inline-flex items-center gap-1"
                title="Copy row"
              >
                {copiedId === b.id ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#1fa76b]" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-[#7a849c]" />
                    <span>Copy</span>
                  </>
                )}
              </button>

              {confirmDeleteId === b.id ? (
                <button
                  type="button"
                  onClick={() => {
                    void onDeleteBooking(b.id);
                    setConfirmDeleteId(null);
                  }}
                  className="btn-3d-red px-2.5 py-2 text-[0.74rem]"
                >
                  Confirm
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(b.id)}
                  className="btn-3d-white p-2 !text-red-500"
                  title="Remove booking"
                  aria-label="Remove booking"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
