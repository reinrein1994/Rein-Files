import {ChevronLeft, ChevronRight, RotateCcw} from 'lucide-react';
import {
  ANNUAL_WELLNESS_LIMIT,
  DEFAULT_DAILY_BOOKING_LIMIT,
  type Department,
} from '../types';

interface Calendar3DProps {
  year: number;
  month: number;
  todayStr: string;
  minAdvanceDateStr: string;
  selectedDates: string[];
  department: Department | '';
  dailyCountsByDepartment?: Record<Department, Record<string, number>>;
  dailyLimits: Record<string, number>;
  defaultDailyLimit: number;
  usedDaysInDisplayedYear: number;
  onChangeMonth: (year: number, month: number) => void;
  onSelectDate: (
    dateStr: string,
    isOccupied: boolean,
    isPast: boolean,
    isTooSoon: boolean,
    dailyLimitReached: boolean,
    dailyLimit: number
  ) => void;
  onClearDates: () => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function Calendar3D({
  year,
  month,
  todayStr,
  minAdvanceDateStr,
  selectedDates,
  department,
  dailyCountsByDepartment,
  dailyLimits,
  defaultDailyLimit,
  usedDaysInDisplayedYear,
  onChangeMonth,
  onSelectDate,
  onClearDates,
}: Calendar3DProps) {
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const selectedSet = new Set(selectedDates);
  const baseLimit = defaultDailyLimit || DEFAULT_DAILY_BOOKING_LIMIT;
  const isAdminDepartment = department === 'Administration';
  const activeDeptCounts =
    department && dailyCountsByDepartment ? dailyCountsByDepartment[department] ?? {} : {};

  const cells: Array<{day: number; dateStr: string} | null> = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    cells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      day: d,
      dateStr: `${year}-${pad2(month + 1)}-${pad2(d)}`,
    });
  }

  function prevMonth() {
    if (month === 0) {
      onChangeMonth(year - 1, 11);
    } else {
      onChangeMonth(year, month - 1);
    }
  }

  function nextMonth() {
    if (month === 11) {
      onChangeMonth(year + 1, 0);
    } else {
      onChangeMonth(year, month + 1);
    }
  }

  const remainingInYear = Math.max(0, ANNUAL_WELLNESS_LIMIT - usedDaysInDisplayedYear);

  return (
    <div className="glass p-3.5 sm:p-4 lg:p-5 mb-4 lg:mb-0">
      <div className="flex items-center justify-between gap-2 mb-3">
        <button
          type="button"
          onClick={prevMonth}
          className="keycap-nav-3d w-10 h-10 lg:w-11 lg:h-11 flex items-center justify-center"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="text-center">
          <div className="text-[1.06rem] lg:text-[1.18rem] font-extrabold text-[#1f2740]">
            {MONTH_NAMES[month]} {year}
          </div>
          <div className="text-[0.72rem] sm:text-[0.76rem] font-bold text-[#7a849c]">
            {!department
              ? `Select department · Max ${baseLimit}/day per grade level`
              : isAdminDepartment
                ? 'Administration · Exempt from 2/day teacher limit'
                : `${department} · Max ${baseLimit} teachers/day`}
          </div>
        </div>

        <button
          type="button"
          onClick={nextMonth}
          className="keycap-nav-3d w-10 h-10 lg:w-11 lg:h-11 flex items-center justify-center"
          aria-label="Next month"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 mb-2 px-0.5">
        <span className="text-[0.72rem] sm:text-[0.75rem] font-bold text-[#7a849c]">
          Book 2+ weeks ahead (from {minAdvanceDateStr}) · {remainingInYear}/{ANNUAL_WELLNESS_LIMIT} left in {year}
        </span>
        {selectedDates.length > 0 && (
          <button
            type="button"
            onClick={onClearDates}
            className="text-[0.74rem] font-extrabold text-[#1fa76b] inline-flex items-center gap-1 cursor-pointer shrink-0 hover:underline"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Clear</span>
          </button>
        )}
      </div>

      <div className="cal-tray-3d">
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mb-2">
          {WEEKDAYS.map((wd) => (
            <div
              key={wd}
              className="text-center text-[0.7rem] sm:text-[0.74rem] font-extrabold text-[#7a849c] py-0.5"
            >
              {wd}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1.5 sm:gap-2 pb-1">
          {cells.map((cell, idx) => {
            if (!cell) {
              return <div key={`empty-${idx}`} className="h-[44px] sm:h-[50px] lg:h-[54px]" />;
            }

            const isPast = cell.dateStr < todayStr;
            const isTooSoon = !isPast && cell.dateStr < minAdvanceDateStr;
            const hasCustomLimit = dailyLimits[cell.dateStr] !== undefined;
            const dayLimit = hasCustomLimit ? dailyLimits[cell.dateStr] : baseLimit;
            const bookedCount = department ? activeDeptCounts[cell.dateStr] ?? 0 : 0;
            const isClosedDay = !isPast && !isTooSoon && dayLimit === 0;
            const isLevelFull =
              !isPast &&
              !isTooSoon &&
              Boolean(department) &&
              !isAdminDepartment &&
              bookedCount >= dayLimit;
            const isOccupied = isClosedDay || isLevelFull;
            const isChosen = !isPast && !isTooSoon && !isOccupied && selectedSet.has(cell.dateStr);

            const stateClass = isPast
              ? 'keycap-past'
              : isTooSoon
                ? 'keycap-too-soon'
                : isOccupied
                  ? 'keycap-red'
                  : isChosen
                    ? 'keycap-green'
                    : 'keycap-gray';

            const showSlotBadge =
              !isPast &&
              !isTooSoon &&
              (isClosedDay ||
                (Boolean(department) &&
                  !isAdminDepartment &&
                  (bookedCount > 0 || hasCustomLimit)));

            return (
              <button
                key={cell.dateStr}
                type="button"
                disabled={isPast}
                onClick={() =>
                  onSelectDate(
                    cell.dateStr,
                    isOccupied,
                    isPast,
                    isTooSoon,
                    isOccupied,
                    dayLimit
                  )
                }
                className={`keycap-3d ${stateClass} h-[44px] sm:h-[50px] lg:h-[54px] flex flex-col items-center justify-center text-[0.88rem] sm:text-[0.94rem] leading-none`}
                aria-label={`${cell.dateStr}${
                  isPast
                    ? ' (Past date unavailable)'
                    : isTooSoon
                      ? ' (Less than 2 weeks advance notice)'
                      : isOccupied
                        ? ` (Occupied ${bookedCount}/${dayLimit})`
                        : isChosen
                          ? ' (Selected)'
                          : isAdminDepartment
                            ? ' (Available)'
                            : ` (Available ${bookedCount}/${dayLimit})`
                }`}
                aria-pressed={isChosen}
              >
                <span>{cell.day}</span>
                {showSlotBadge && (
                  <span className="text-[0.55rem] sm:text-[0.6rem] font-extrabold opacity-85 mt-0.5 leading-none">
                    {isClosedDay ? 'Closed' : `${bookedCount}/${dayLimit}`}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tactile 3D Legend */}
      <div className="flex flex-wrap items-center justify-center gap-x-3.5 gap-y-1.5 mt-3 text-[0.72rem] font-bold text-[#7a849c]">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="w-3.5 h-3.5 rounded-[4px] inline-block border border-[#c9d2e3]"
            style={{
              background: '#e2e7f0',
              boxShadow: '0 2px 0 #adb8ce',
            }}
          />
          <span>Available</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="w-3.5 h-3.5 rounded-[4px] inline-block border border-[#23a96d]"
            style={{
              background: '#2fbf7f',
              boxShadow: '0 2px 0 #178252',
            }}
          />
          <span>Chosen</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="w-3.5 h-3.5 rounded-[4px] inline-block border border-[#dc2626]"
            style={{
              background: '#ef4444',
              boxShadow: '0 2px 0 #a81b1b',
            }}
          />
          <span>Occupied</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="w-3.5 h-3.5 rounded-[4px] inline-block border border-dashed border-[#d99b26]"
            style={{
              background: '#fdf4dc',
              boxShadow: '0 2px 0 #cfa95f',
            }}
          />
          <span>&lt; 2 wks</span>
        </span>
      </div>
    </div>
  );
}
