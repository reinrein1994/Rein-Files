import {useEffect} from 'react';
import {AlertOctagon, X} from 'lucide-react';
import {ANNUAL_WELLNESS_LIMIT} from '../types';

interface LimitWarningModalProps {
  info: {
    year: string;
    usedDays: number;
    selectedDaysInYear: number;
    alreadyExhausted: boolean;
  } | null;
  onClose: () => void;
}

export function LimitWarningModal({info, onClose}: LimitWarningModalProps) {
  useEffect(() => {
    if (!info) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [info, onClose]);

  if (!info) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1f2740]/50 backdrop-blur-xs p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="limit-modal-title"
      aria-describedby="limit-modal-desc"
      onClick={onClose}
    >
      <div
        className="glass-warning-3d-modal relative w-full max-w-[380px] p-6 text-center text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors cursor-pointer"
          aria-label="Close warning"
        >
          <X className="w-4 h-4" />
        </button>

        {/* 3D Warning Sign Emblem */}
        <div className="flex justify-center mt-1 mb-4">
          <div className="icon-3d-warning-sign w-20 h-20 rounded-full flex items-center justify-center">
            <AlertOctagon className="w-10 h-10 text-[#991b1b]" />
          </div>
        </div>

        <h2
          id="limit-modal-title"
          className="m-0 text-[1.28rem] font-extrabold tracking-tight text-white"
        >
          {info.alreadyExhausted
            ? `5-Day Limit Used Up (${info.year})`
            : `5-Day Annual Limit Exceeded`}
        </h2>

        <p
          id="limit-modal-desc"
          className="mt-2.5 mb-5 text-[0.92rem] font-bold text-amber-50 leading-relaxed"
        >
          {info.alreadyExhausted ? (
            <>
              You have already used all{' '}
              <span className="underline decoration-white decoration-2 underline-offset-2">
                {info.usedDays} of {ANNUAL_WELLNESS_LIMIT}
              </span>{' '}
              wellness leave days allowed for {info.year}. You cannot book more dates for {info.year}.
            </>
          ) : (
            <>
              Each personnel is limited to a maximum of{' '}
              <span className="underline decoration-white decoration-2 underline-offset-2">
                {ANNUAL_WELLNESS_LIMIT} wellness leave days
              </span>{' '}
              per year. ({info.usedDays} already booked + {info.selectedDaysInYear} selected in{' '}
              {info.year}).
            </>
          )}
        </p>

        <button
          type="button"
          onClick={onClose}
          className="btn-3d-red w-full py-3 px-4 text-[0.92rem]"
        >
          Understood
        </button>
      </div>
    </div>
  );
}
