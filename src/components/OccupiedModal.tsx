import {useEffect} from 'react';
import {AlertTriangle, X} from 'lucide-react';
import type {Department} from '../types';

interface OccupiedModalProps {
  info: {
    dateStr: string;
    isRangeConflict?: boolean;
    dailyLimitReached?: boolean;
    dailyLimit?: number;
  } | null;
  department: Department | '';
  onClose: () => void;
}

function formatReadableDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function OccupiedModal({info, department, onClose}: OccupiedModalProps) {
  useEffect(() => {
    if (!info) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [info, onClose]);

  if (!info) return null;

  const limitNum = info.dailyLimit ?? 2;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1f2740]/50 backdrop-blur-xs p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="occupied-modal-title"
      aria-describedby="occupied-modal-desc"
      onClick={onClose}
    >
      <div
        className="glass-red-3d-modal relative w-full max-w-[380px] p-6 text-center text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors cursor-pointer"
          aria-label="Close occupied alert"
        >
          <X className="w-4 h-4" />
        </button>

        {/* 3D Red Modal Icon Blinking Glowing Yellow */}
        <div className="flex justify-center mt-1 mb-4">
          <div className="icon-3d-red-glow-yellow w-20 h-20 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-10 h-10 text-[#fef08a] drop-shadow-[0_0_8px_rgba(250,204,21,0.9)]" />
          </div>
        </div>

        <h2
          id="occupied-modal-title"
          className="m-0 text-[1.3rem] font-extrabold tracking-tight text-white"
        >
          {info.dailyLimitReached ? 'Daily Slots Full' : 'Date Is Occupied'}
        </h2>

        <p
          id="occupied-modal-desc"
          className="mt-2.5 mb-5 text-[0.92rem] font-bold text-red-50/95 leading-relaxed"
        >
          {info.dailyLimitReached ? (
            limitNum === 0 ? (
              <>
                <span className="underline decoration-[#fde047] decoration-2 underline-offset-2">
                  {formatReadableDate(info.dateStr)}
                </span>{' '}
                is currently closed for wellness leave bookings by the administration.
              </>
            ) : (
              <>
                <span className="underline decoration-[#fde047] decoration-2 underline-offset-2">
                  {formatReadableDate(info.dateStr)}
                </span>{' '}
                has already reached the maximum of{' '}
                <span className="underline decoration-[#fde047] decoration-2 underline-offset-2">
                  {limitNum} {limitNum === 1 ? 'teacher' : 'teachers'}
                </span>{' '}
                allowed for {department || 'this department'} on that day.
              </>
            )
          ) : info.isRangeConflict ? (
            <>
              Your chosen range includes{' '}
              <span className="underline decoration-[#fde047] decoration-2 underline-offset-2">
                {formatReadableDate(info.dateStr)}
              </span>
              , which is already occupied by a personnel in {department || 'your department'}.
            </>
          ) : (
            <>
              <span className="underline decoration-[#fde047] decoration-2 underline-offset-2">
                {formatReadableDate(info.dateStr)}
              </span>{' '}
              is already occupied by a personnel in {department || 'your department'}.
            </>
          )}{' '}
          Please choose an available date.
        </p>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 px-4 rounded-[10px] font-extrabold text-[0.92rem] text-[#7f1d1d] bg-[#facc15] hover:bg-[#fde047] border border-[#eab308] cursor-pointer transition-all hover:-translate-y-[1.5px] active:translate-y-[3px]"
          style={{
            boxShadow: '0 5px 0 #b45309',
          }}
        >
          Choose Another Date
        </button>
      </div>
    </div>
  );
}
