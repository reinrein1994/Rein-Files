import {useState, useEffect, useRef, useMemo} from 'react';
import {
  ANNUAL_WELLNESS_LIMIT,
  DEFAULT_DAILY_BOOKING_LIMIT,
  DEPARTMENTS,
  type AdminBookingsPayload,
  type BookingRecord,
  type Department,
  type PersonnelUsagePayload,
  type PublicAppState,
} from './types';
import {Calendar3D} from './components/Calendar3D';
import {OccupiedModal} from './components/OccupiedModal';
import {LimitWarningModal} from './components/LimitWarningModal';
import {AdvanceNoticeModal} from './components/AdvanceNoticeModal';
import {Form6ReadyModal} from './components/Form6ReadyModal';
import {AdminPortalView} from './components/AdminPortalView';
import {PixelSealCelebration} from './components/PixelSealCelebration';

type Tab = 'Book' | 'Admin';

function formatAutoInitials(firstName: string): string {
  const parts = firstName
    .trim()
    .split(/[\s.-]+/)
    .map((p) => p.replace(/[^a-zA-Z]/g, ''))
    .filter(Boolean);
  if (parts.length === 0) return '';
  return parts.map((p) => `${p[0].toUpperCase()}.`).join(' ');
}

function getLocalTodayStr(): string {
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

export default function App() {
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());

  const [tab, setTab] = useState<Tab>('Book');
  const [publicState, setPublicState] = useState<PublicAppState | null>(null);
  const [loading, setLoading] = useState(true);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [middleInitial, setMiddleInitial] = useState('');
  const [position, setPosition] = useState('');
  const [salary, setSalary] = useState('');
  const [department, setDepartment] = useState<Department | ''>('');
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [usedByYear, setUsedByYear] = useState<Record<string, number>>({});
  const [form6Record, setForm6Record] = useState<BookingRecord | null>(null);
  const [sealCelebrationKey, setSealCelebrationKey] = useState(0);

  const [occupiedModal, setOccupiedModal] = useState<{
    dateStr: string;
    isRangeConflict?: boolean;
    dailyLimitReached?: boolean;
    dailyLimit?: number;
  } | null>(null);

  const [limitModal, setLimitModal] = useState<{
    year: string;
    usedDays: number;
    selectedDaysInYear: number;
    alreadyExhausted: boolean;
  } | null>(null);

  const [advanceModal, setAdvanceModal] = useState<{
    dateStr: string;
    minAdvanceDateStr: string;
  } | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  // Admin session Bearer token kept strictly in React memory (never localStorage/sessionStorage)
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [adminData, setAdminData] = useState<AdminBookingsPayload | null>(null);

  const deptSelectRef = useRef<HTMLSelectElement>(null);
  const toastTimer = useRef<number | null>(null);
  const form6DelayTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
      if (form6DelayTimer.current) window.clearTimeout(form6DelayTimer.current);
    };
  }, []);

  function toast(msg: string) {
    setToastMsg(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(''), 3200);
  }

  useEffect(() => {
    fetch('/api/state')
      .then((res) => {
        if (!res.ok) throw new Error('Could not load booking calendar.');
        return res.json();
      })
      .then((data: PublicAppState) => setPublicState(data))
      .catch((err: Error) => toast(err.message))
      .finally(() => setLoading(false));
  }, []);

  const firstInitials = useMemo(() => formatAutoInitials(firstName), [firstName]);
  const cleanLast = lastName.trim().replace(/\s+/g, ' ');
  const recordedNamePreview =
    firstInitials && cleanLast
      ? `${firstInitials} ${cleanLast}`
      : firstInitials || cleanLast || '';

  useEffect(() => {
    if (!firstInitials || !cleanLast || !department) {
      setUsedByYear({});
      return;
    }
    const timer = window.setTimeout(() => {
      const qs = new URLSearchParams({
        firstName,
        lastName: cleanLast,
        department,
      });
      fetch(`/api/my-usage?${qs.toString()}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((payload: PersonnelUsagePayload | null) => {
          if (payload) {
            setUsedByYear(payload.usedByYear ?? {});
          }
        })
        .catch(() => {});
    }, 300);
    return () => window.clearTimeout(timer);
  }, [firstName, firstInitials, cleanLast, department]);

  const todayStr = publicState?.todayStr || getLocalTodayStr();
  const minAdvanceDateStr = publicState?.minAdvanceDateStr || addDaysStr(todayStr, 14);

  function handleDepartmentChange(nextDept: Department | '') {
    setDepartment(nextDept);
    if (nextDept && nextDept !== 'Administration' && selectedDates.length > 0 && publicState) {
      const deptCounts = publicState.dailyCountsByDepartment?.[nextDept] ?? {};
      const baseLimit = publicState.defaultDailyLimit ?? DEFAULT_DAILY_BOOKING_LIMIT;
      const fullConflict = selectedDates.find((d) => {
        const limit = publicState.dailyLimits?.[d] ?? baseLimit;
        return (deptCounts[d] ?? 0) >= limit;
      });
      if (fullConflict) {
        const limit = publicState.dailyLimits?.[fullConflict] ?? baseLimit;
        setSelectedDates((prev) =>
          prev.filter((d) => (deptCounts[d] ?? 0) < (publicState.dailyLimits?.[d] ?? baseLimit))
        );
        setOccupiedModal({
          dateStr: fullConflict,
          dailyLimitReached: true,
          dailyLimit: limit,
        });
      }
    }
  }

  function handleSelectDate(
    dateStr: string,
    isOccupied: boolean,
    isPast: boolean,
    isTooSoon: boolean,
    dailyLimitReached: boolean,
    dailyLimit: number
  ) {
    if (isPast) {
      toast('Past dates cannot be booked.');
      return;
    }
    if (isTooSoon) {
      setAdvanceModal({dateStr, minAdvanceDateStr});
      return;
    }
    if (isOccupied) {
      setOccupiedModal({
        dateStr,
        isRangeConflict: false,
        dailyLimitReached,
        dailyLimit,
      });
      return;
    }
    if (!department) {
      toast('Please select your department first.');
      deptSelectRef.current?.focus();
      return;
    }

    if (selectedDates.includes(dateStr)) {
      setSelectedDates((prev) => prev.filter((d) => d !== dateStr));
      return;
    }

    const yr = dateStr.slice(0, 4);
    const alreadyUsed = usedByYear[yr] ?? 0;
    const currentlySelectedInYear = selectedDates.filter((d) => d.startsWith(`${yr}-`)).length;

    if (alreadyUsed >= ANNUAL_WELLNESS_LIMIT) {
      setLimitModal({
        year: yr,
        usedDays: alreadyUsed,
        selectedDaysInYear: currentlySelectedInYear,
        alreadyExhausted: true,
      });
      return;
    }

    if (alreadyUsed + currentlySelectedInYear + 1 > ANNUAL_WELLNESS_LIMIT) {
      setLimitModal({
        year: yr,
        usedDays: alreadyUsed,
        selectedDaysInYear: currentlySelectedInYear,
        alreadyExhausted: false,
      });
      return;
    }

    setSelectedDates((prev) => [...prev, dateStr].sort());
  }

  async function refreshAdminIfUnlocked(token: string | null) {
    if (!token) return;
    try {
      const res = await fetch('/api/admin/bookings', {
        headers: {Authorization: `Bearer ${token}`},
      });
      if (res.status === 401) {
        setAdminToken(null);
        setAdminData(null);
        return;
      }
      if (res.ok) {
        const json = (await res.json()) as AdminBookingsPayload;
        setAdminData(json);
      }
    } catch {
      // Ignore background admin refresh error
    }
  }

  async function triggerForm6Download(record: BookingRecord) {
    try {
      const res = await fetch(`/api/bookings/${encodeURIComponent(record.id)}/form6.pdf`, {
        headers: {
          'X-Form6-Token': record.form6Token || '',
        },
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const safeLast = record.lastName.replace(/[^a-zA-Z0-9_-]+/g, '_') || 'Personnel';
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `Form6-Wellness-Leave-${safeLast}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    } catch {
      // Fallback: user can click Download Form 6 (PDF) inside Form6ReadyModal
    }
  }

  async function handleSubmitBooking() {
    if (!department) {
      toast('Please choose your department.');
      deptSelectRef.current?.focus();
      return;
    }
    if (!firstInitials) {
      toast('Please type your first name.');
      return;
    }
    if (!cleanLast) {
      toast('Please enter your last name.');
      return;
    }
    if (selectedDates.length === 0) {
      toast('Please choose at least one available date.');
      return;
    }

    const tooSoon = selectedDates.find((d) => d < minAdvanceDateStr);
    if (tooSoon) {
      setAdvanceModal({dateStr: tooSoon, minAdvanceDateStr});
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          firstName,
          lastName: cleanLast,
          middleInitial: middleInitial.trim(),
          position: position.trim(),
          salary: salary.trim(),
          department,
          dates: selectedDates,
        }),
      });
      const json = await res.json();
      if (res.status === 409 && json.occupied) {
        setOccupiedModal({
          dateStr: json.occupiedDate || selectedDates[0],
          isRangeConflict: selectedDates.length > 1 && !json.dailyLimitReached,
          dailyLimitReached: Boolean(json.dailyLimitReached),
          dailyLimit: typeof json.dailyLimit === 'number' ? json.dailyLimit : undefined,
        });
        setSelectedDates((prev) => prev.filter((d) => d !== json.occupiedDate));
        return;
      }
      if (res.status === 400 && json.advanceNoticeViolation) {
        setAdvanceModal({
          dateStr: String(json.invalidDate || selectedDates[0]),
          minAdvanceDateStr: String(json.minAdvanceDate || minAdvanceDateStr),
        });
        return;
      }
      if (res.status === 400 && json.limitExceeded) {
        setLimitModal({
          year: String(json.year),
          usedDays: Number(json.usedDays ?? 0),
          selectedDaysInYear: Number(json.requestedDays ?? 0),
          alreadyExhausted: Number(json.usedDays ?? 0) >= ANNUAL_WELLNESS_LIMIT,
        });
        return;
      }
      if (!res.ok) {
        throw new Error(json.error || 'Could not save wellness leave booking.');
      }

      const savedRecord = json.record as BookingRecord;
      setPublicState(json.publicState as PublicAppState);
      if (json.usedByYear) {
        setUsedByYear(json.usedByYear as Record<string, number>);
      }
      await refreshAdminIfUnlocked(adminToken);
      setSelectedDates([]);

      // Trigger playful unboxed 16-bit pixel animation of the uploaded school seal + start PDF download
      setSealCelebrationKey((k) => k + 1);
      toast(`Booked ${savedRecord.daysCount} day(s) & downloading Form 6 PDF ✓`);
      void triggerForm6Download(savedRecord);

      if (form6DelayTimer.current) window.clearTimeout(form6DelayTimer.current);
      form6DelayTimer.current = window.setTimeout(() => {
        setForm6Record(savedRecord);
      }, 2100);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to submit booking.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAdminSetup(password: string, confirmPassword: string) {
    const res = await fetch('/api/admin/setup', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({password, confirmPassword}),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || 'Could not save administrator password.');
    }
    const payload = json as AdminBookingsPayload;
    setAdminToken(payload.token || null);
    setAdminData(payload);
  }

  async function handleAdminUnlock(password: string) {
    const res = await fetch('/api/admin/unlock', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({password}),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || 'Incorrect password.');
    }
    const payload = json as AdminBookingsPayload;
    setAdminToken(payload.token || null);
    setAdminData(payload);
  }

  async function handleDeleteBooking(id: string) {
    if (!adminToken) return;
    const res = await fetch(`/api/admin/bookings/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: {Authorization: `Bearer ${adminToken}`},
    });
    if (res.status === 401) {
      setAdminToken(null);
      setAdminData(null);
      toast('Admin session expired. Please unlock again.');
      return;
    }
    const json = await res.json();
    if (!res.ok) {
      toast(json.error || 'Could not remove booking.');
      return;
    }
    setPublicState(json.publicState as PublicAppState);
    setAdminData((prev) => (prev ? {...prev, bookings: json.bookings} : prev));
    toast('Booking removed ✓');
  }

  async function handleUpdateSchoolLogo(schoolLogoUrl: string) {
    if (!adminToken) return;
    const res = await fetch('/api/admin/school-logo', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({schoolLogoUrl}),
    });
    if (res.status === 401) {
      setAdminToken(null);
      setAdminData(null);
      throw new Error('Session expired. Please unlock again.');
    }
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || 'Could not update school logo.');
    }
    setPublicState(json.publicState as PublicAppState);
    setAdminData((prev) =>
      prev ? {...prev, schoolLogoUrl: json.schoolLogoUrl} : prev
    );
  }

  async function handleSetDailyLimit(date: string, maxTeachers: number) {
    if (!adminToken) return;
    const res = await fetch('/api/admin/daily-limit', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({date, maxTeachers}),
    });
    if (res.status === 401) {
      setAdminToken(null);
      setAdminData(null);
      throw new Error('Session expired. Please unlock again.');
    }
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || 'Could not update daily limit.');
    }
    setPublicState(json.publicState as PublicAppState);
    setAdminData((prev) => (prev ? {...prev, dailyLimits: json.dailyLimits} : prev));
    toast(`Limit for ${date} set to ${maxTeachers} teacher(s) ✓`);
  }

  async function handleRemoveDailyLimit(date: string) {
    if (!adminToken) return;
    const res = await fetch(`/api/admin/daily-limit/${encodeURIComponent(date)}`, {
      method: 'DELETE',
      headers: {Authorization: `Bearer ${adminToken}`},
    });
    if (res.status === 401) {
      setAdminToken(null);
      setAdminData(null);
      toast('Admin session expired. Please unlock again.');
      return;
    }
    const json = await res.json();
    if (!res.ok) {
      toast(json.error || 'Could not reset daily limit.');
      return;
    }
    setPublicState(json.publicState as PublicAppState);
    setAdminData((prev) => (prev ? {...prev, dailyLimits: json.dailyLimits} : prev));
    toast(`Limit for ${date} reset to default (${DEFAULT_DAILY_BOOKING_LIMIT}) ✓`);
  }

  const canSubmit = Boolean(
    department && firstInitials && cleanLast && selectedDates.length > 0 && !submitting
  );

  const displayedYearKey = String(calYear);
  const usedInDisplayedYear = usedByYear[displayedYearKey] ?? 0;

  return (
    <>
      <div className="orb o1" />
      <div className="orb o2" />

      <div className="relative z-1 max-w-[480px] lg:max-w-[1040px] mx-auto h-full lg:h-auto lg:min-h-dvh flex flex-col lg:px-6 lg:pb-8">
        <header className="pt-[calc(env(safe-area-inset-top)+14px)] lg:pt-6 px-4 lg:px-0 pb-2.5 lg:pb-5 shrink-0 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="text-center lg:text-left lg:flex lg:items-center lg:gap-4">
            <div className="flex items-center justify-center lg:justify-start gap-3.5 mb-2 lg:mb-0 shrink-0">
              <img
                src={publicState?.depedLogoUrl || '/logos/deped.svg'}
                alt="Department of Education (DepEd) Logo"
                className="h-11 lg:h-12 w-auto object-contain"
              />

              <img
                src={publicState?.schoolLogoUrl || '/logos/nccs-seal.png'}
                alt="North City Central School - Cagayan de Oro Seal"
                className="h-12 lg:h-14 w-auto object-contain drop-shadow-[0_4px_10px_rgba(31,39,64,0.16)]"
              />
            </div>

            <div>
              <h1 className="m-0 text-[1.42rem] sm:text-[1.58rem] lg:text-[1.85rem] font-extrabold tracking-[-0.35px] text-[#1f2740] leading-tight">
                Wellness Leave Personnel Booking
              </h1>
              <p className="mt-0.5 mb-0 text-[#5a6684] text-[0.86rem] lg:text-[0.95rem] font-bold">
                North City Central School - Cagayan de Oro
              </p>
            </div>
          </div>

          {/* Desktop Navigation Bar */}
          <nav className="hidden lg:flex glass gap-2 p-2 shrink-0">
            <button
              type="button"
              onClick={() => setTab('Book')}
              className={`py-2.5 px-4 text-[0.88rem] whitespace-nowrap ${
                tab === 'Book'
                  ? 'btn-3d-active-green'
                  : 'btn-3d-white !bg-[#eef2fb] !text-[#7a849c] !border-[#d2dbec]'
              }`}
            >
              🗓️ Book Leave
            </button>
            <button
              type="button"
              onClick={() => setTab('Admin')}
              className={`py-2.5 px-4 text-[0.88rem] whitespace-nowrap ${
                tab === 'Admin'
                  ? 'btn-3d-active-green'
                  : 'btn-3d-white !bg-[#eef2fb] !text-[#7a849c] !border-[#d2dbec]'
              }`}
            >
              🔐 Administration Portal
            </button>
          </nav>
        </header>

        <main className="flex-1 lg:flex-none overflow-y-auto lg:overflow-visible px-4 lg:px-0 pt-1.5 pb-5 lg:pb-0">
          {tab === 'Book' ? (
            <div className="lg:grid lg:grid-cols-12 lg:gap-5 lg:items-start">
              {/* Left Column on Desktop (Top Card on Phone): Personnel Details & Desktop Submit */}
              <div className="lg:col-span-5 space-y-4">
                <div className="glass px-4 py-4 sm:p-5 space-y-3">
                  <div>
                    <label
                      htmlFor="dept"
                      className="block font-extrabold text-[0.83rem] text-[#7a849c] mb-1.5"
                    >
                      Department
                    </label>
                    <select
                      ref={deptSelectRef}
                      id="dept"
                      value={department}
                      onChange={(e) =>
                        handleDepartmentChange(e.target.value as Department | '')
                      }
                      className="w-full px-4 py-[12px] rounded-[16px] border-[1.5px] border-[#788cbe]/25 bg-white/85 text-[0.96rem] font-bold text-[#1f2740] outline-none focus:border-[#2fbf7f] focus:shadow-[0_0_0_4px_rgba(47,191,127,0.18)]"
                    >
                      <option value="">Select department</option>
                      {DEPARTMENTS.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label
                        htmlFor="first-name"
                        className="block font-extrabold text-[0.83rem] text-[#7a849c] mb-1.5"
                      >
                        First name (full)
                      </label>
                      <input
                        id="first-name"
                        type="text"
                        maxLength={60}
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="e.g. Juan Carlos"
                        className="w-full px-3.5 py-[12px] rounded-[16px] border-[1.5px] border-[#788cbe]/25 bg-white/85 text-[0.95rem] font-bold text-[#1f2740] outline-none focus:border-[#2fbf7f] focus:shadow-[0_0_0_4px_rgba(47,191,127,0.18)]"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="last-name"
                        className="block font-extrabold text-[0.83rem] text-[#7a849c] mb-1.5"
                      >
                        Last name
                      </label>
                      <input
                        id="last-name"
                        type="text"
                        maxLength={60}
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="e.g. Dela Cruz"
                        className="w-full px-3.5 py-[12px] rounded-[16px] border-[1.5px] border-[#788cbe]/25 bg-white/85 text-[0.95rem] font-bold text-[#1f2740] outline-none focus:border-[#2fbf7f] focus:shadow-[0_0_0_4px_rgba(47,191,127,0.18)]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label
                        htmlFor="middle-initial"
                        className="block font-extrabold text-[0.76rem] text-[#7a849c] mb-1"
                      >
                        Middle (opt.)
                      </label>
                      <input
                        id="middle-initial"
                        type="text"
                        maxLength={40}
                        value={middleInitial}
                        onChange={(e) => setMiddleInitial(e.target.value)}
                        placeholder="Mendoza"
                        className="w-full px-3 py-[10px] rounded-[14px] border-[1.5px] border-[#788cbe]/25 bg-white/85 text-[0.88rem] font-bold text-[#1f2740] outline-none focus:border-[#2fbf7f] focus:shadow-[0_0_0_4px_rgba(47,191,127,0.18)]"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="position"
                        className="block font-extrabold text-[0.76rem] text-[#7a849c] mb-1"
                      >
                        Position (opt.)
                      </label>
                      <input
                        id="position"
                        type="text"
                        maxLength={60}
                        value={position}
                        onChange={(e) => setPosition(e.target.value)}
                        placeholder="Teacher III"
                        className="w-full px-3 py-[10px] rounded-[14px] border-[1.5px] border-[#788cbe]/25 bg-white/85 text-[0.88rem] font-bold text-[#1f2740] outline-none focus:border-[#2fbf7f] focus:shadow-[0_0_0_4px_rgba(47,191,127,0.18)]"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="salary"
                        className="block font-extrabold text-[0.76rem] text-[#7a849c] mb-1"
                      >
                        Salary (opt.)
                      </label>
                      <input
                        id="salary"
                        type="text"
                        maxLength={40}
                        value={salary}
                        onChange={(e) => setSalary(e.target.value)}
                        placeholder="SG 13"
                        className="w-full px-3 py-[10px] rounded-[14px] border-[1.5px] border-[#788cbe]/25 bg-white/85 text-[0.88rem] font-bold text-[#1f2740] outline-none focus:border-[#2fbf7f] focus:shadow-[0_0_0_4px_rgba(47,191,127,0.18)]"
                      />
                    </div>
                  </div>

                  {recordedNamePreview && (
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[0.82rem] font-extrabold text-[#1fa76b]">
                      <span>Public log: {recordedNamePreview}</span>
                      {department && firstInitials && cleanLast && (
                        <span className="text-[#5a6684]">
                          {calYear} used: {usedInDisplayedYear}/{ANNUAL_WELLNESS_LIMIT} days
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {selectedDates.length > 0 && (
                  <div className="hidden lg:block glass px-4 py-3 text-center text-[0.86rem] font-extrabold text-[#1fa76b]">
                    Selected ({selectedDates.length} {selectedDates.length === 1 ? 'day' : 'days'}):{' '}
                    {selectedDates.join(', ')}
                  </div>
                )}

                {/* Desktop Submit Button */}
                <div className="hidden lg:block">
                  <button
                    type="button"
                    onClick={() => void handleSubmitBooking()}
                    disabled={!canSubmit}
                    className="cam-btn text-[1rem] py-[15px]"
                  >
                    {submitting ? 'Saving…' : 'Submit Wellness Leave'}
                  </button>
                </div>
              </div>

              {/* Right Column on Desktop (Below Form on Phone): 3D Calendar */}
              <div className="lg:col-span-7 mt-4 lg:mt-0">
                {loading ? (
                  <div className="glass p-6 text-center text-[0.9rem] font-bold text-[#7a849c]">
                    Loading 3D booking calendar…
                  </div>
                ) : (
                  <Calendar3D
                    year={calYear}
                    month={calMonth}
                    todayStr={todayStr}
                    minAdvanceDateStr={minAdvanceDateStr}
                    selectedDates={selectedDates}
                    department={department}
                    dailyCountsByDepartment={publicState?.dailyCountsByDepartment}
                    dailyLimits={publicState?.dailyLimits ?? {}}
                    defaultDailyLimit={publicState?.defaultDailyLimit ?? DEFAULT_DAILY_BOOKING_LIMIT}
                    usedDaysInDisplayedYear={usedInDisplayedYear}
                    onChangeMonth={(y, m) => {
                      setCalYear(y);
                      setCalMonth(m);
                    }}
                    onSelectDate={handleSelectDate}
                    onClearDates={() => setSelectedDates([])}
                  />
                )}

                {selectedDates.length > 0 && (
                  <div className="lg:hidden glass px-4 py-3 text-center text-[0.84rem] font-extrabold text-[#1fa76b]">
                    Selected ({selectedDates.length} {selectedDates.length === 1 ? 'day' : 'days'}):{' '}
                    {selectedDates.join(', ')}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <AdminPortalView
              adminToken={adminToken}
              adminData={adminData}
              dailyCounts={publicState?.dailyCounts ?? {}}
              onSetupPassword={handleAdminSetup}
              onUnlock={handleAdminUnlock}
              onLock={() => {
                setAdminToken(null);
                setAdminData(null);
              }}
              onDeleteBooking={handleDeleteBooking}
              onUpdateSchoolLogo={handleUpdateSchoolLogo}
              onSetDailyLimit={handleSetDailyLimit}
              onRemoveDailyLimit={handleRemoveDailyLimit}
            />
          )}
        </main>

        {/* Mobile Sticky Submit & Bottom Navigation */}
        {tab === 'Book' && (
          <div className="lg:hidden px-4 pt-2 pb-[calc(env(safe-area-inset-bottom)+8px)] shrink-0">
            <button
              type="button"
              onClick={() => void handleSubmitBooking()}
              disabled={!canSubmit}
              className="cam-btn text-[1rem] py-[15px]"
            >
              {submitting ? 'Saving…' : 'Submit Wellness Leave'}
            </button>
          </div>
        )}

        <nav className="lg:hidden glass flex gap-2.5 mx-3.5 mb-[calc(env(safe-area-inset-bottom)+12px)] p-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setTab('Book')}
            className={`flex-1 py-[10px] px-2 text-[0.88rem] whitespace-nowrap ${
              tab === 'Book'
                ? 'btn-3d-active-green'
                : 'btn-3d-white !bg-[#eef2fb] !text-[#7a849c] !border-[#d2dbec]'
            }`}
          >
            🗓️ Book Leave
          </button>
          <button
            type="button"
            onClick={() => setTab('Admin')}
            className={`flex-1 py-[10px] px-2 text-[0.88rem] whitespace-nowrap ${
              tab === 'Admin'
                ? 'btn-3d-active-green'
                : 'btn-3d-white !bg-[#eef2fb] !text-[#7a849c] !border-[#d2dbec]'
            }`}
          >
            🔐 Administration Portal
          </button>
        </nav>
      </div>

      {toastMsg && (
        <div className="glass fixed top-[calc(env(safe-area-inset-top)+14px)] left-1/2 -translate-x-1/2 z-[60] px-5 py-3 font-extrabold text-[0.9rem] max-w-[90%] text-center text-[#1f2740]">
          {toastMsg}
        </div>
      )}

      {/* Unboxed 16-bit Pixel Animation of the School Seal on Submit */}
      <PixelSealCelebration
        triggerKey={sealCelebrationKey}
        logoUrl={publicState?.schoolLogoUrl || '/logos/nccs-seal.png'}
      />

      <OccupiedModal
        info={occupiedModal}
        department={department}
        onClose={() => setOccupiedModal(null)}
      />

      <LimitWarningModal
        info={limitModal}
        onClose={() => setLimitModal(null)}
      />

      <AdvanceNoticeModal
        info={advanceModal}
        onClose={() => setAdvanceModal(null)}
      />

      <Form6ReadyModal
        record={form6Record}
        onClose={() => setForm6Record(null)}
      />
    </>
  );
}
