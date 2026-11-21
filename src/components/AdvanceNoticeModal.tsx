import {useEffect} from 'react';
import {Clock, X} from 'lucide-react';

interface AdvanceNoticeModalProps {
  info: {
    dateStr: string;
    minAdvanceDateStr: string;
  } | null;
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

export function AdvanceNoticeModal({info, onClose}: AdvanceNoticeModalProps) {
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
      aria-labelledby="advance-modal-title"
      aria-describedby="advance-modal-desc"
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
          aria-label="Close advance notice warning"
        >
          <X className="w-4 h-4" />
        </button>

        {/* 3D Warning Sign Emblem */}
        <div className="flex justify-center mt-1 mb-4">
          <div className="icon-3d-warning-sign w-20 h-20 rounded-full flex items-center justify-center">
            <Clock className="w-10 h-10 text-[#991b1b]" />
          </div>
        </div>

        <h2
          id="advance-modal-title"
          className="m-0 text-[1.25rem] font-extrabold tracking-tight text-white"
        >
          2-Week Notice Required
        </h2>

        <p
          id="advance-modal-desc"
          className="mt-2.5 mb-5 text-[0.9rem] font-bold text-amber-50 leading-relaxed"
        >
          Wellness leave requests must be submitted at least{' '}
          <span className="underline decoration-white decoration-2 underline-offset-2">
            2 weeks (14 days)
          </span>{' '}
          before the applied date.{' '}
          <span className="block mt-2">
            {formatReadableDate(info.dateStr)} is not allowed. Earliest bookable date is{' '}
            <span className="underline decoration-white decoration-2 underline-offset-2">
              {formatReadableDate(info.minAdvanceDateStr)}
            </span>
            .
          </span>
        </p>

        <button
          type="button"
          onClick={onClose}
          className="btn-3d-red w-full py-3 px-4 text-[0.92rem]"
        >
          Choose Date 2+ Weeks Ahead
        </button>
      </div>
    </div>
  );
}
