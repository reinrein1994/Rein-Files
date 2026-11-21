import {useEffect, useState} from 'react';
import {CheckCircle2, Download, FileText, X} from 'lucide-react';
import type {BookingRecord} from '../types';

interface Form6ReadyModalProps {
  record: BookingRecord | null;
  onClose: () => void;
}

export function Form6ReadyModal({record, onClose}: Form6ReadyModalProps) {
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!record) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [record, onClose]);

  if (!record) return null;

  const safeLast = record.lastName.replace(/[^a-zA-Z0-9_-]+/g, '_') || 'Personnel';
  const downloadFilename = `Form6-Wellness-Leave-${safeLast}.pdf`;

  async function handleDownloadClick() {
    if (!record || downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(`/api/bookings/${encodeURIComponent(record.id)}/form6.pdf`, {
        headers: {
          'X-Form6-Token': record.form6Token || '',
        },
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = downloadFilename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1f2740]/50 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="form6-ready-title"
      onClick={onClose}
    >
      <div
        className="glass relative w-full max-w-[390px] p-6 text-center bg-white/95"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="btn-3d-white absolute top-3.5 right-3.5 w-8 h-8 flex items-center justify-center"
          aria-label="Close confirmation"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex justify-center mt-1 mb-3">
          <div
            className="w-16 h-16 rounded-[14px] bg-[#2fbf7f] border border-[#23a96d] flex items-center justify-center text-white"
            style={{boxShadow: '0 5px 0 #178252'}}
          >
            <CheckCircle2 className="w-9 h-9" />
          </div>
        </div>

        <h2
          id="form6-ready-title"
          className="m-0 text-[1.25rem] font-extrabold tracking-tight text-[#1f2740]"
        >
          Wellness Leave Recorded
        </h2>

        <p className="mt-2 mb-3 text-[0.86rem] font-bold text-[#5a6684] leading-relaxed">
          Your details have been automatically reflected on{' '}
          <span className="text-[#1f2740] font-extrabold">Civil Service Form No. 6</span>{' '}
          and the PDF download has started.
        </p>

        <div className="rounded-[12px] bg-[#eef2fb] border border-[#cfd8e8] p-3 text-left text-[0.8rem] font-bold text-[#1f2740] space-y-1 mb-4">
          <div className="flex items-center gap-1.5 text-[#1fa76b] font-extrabold mb-1">
            <FileText className="w-4 h-4 shrink-0" />
            <span>Form 6 Details Applied</span>
          </div>
          <div>
            <span className="text-[#7a849c]">Name:</span> {record.lastName.toUpperCase()},{' '}
            {(record.firstName || record.firstInitials).toUpperCase()}
            {record.middleInitial ? ` ${record.middleInitial.toUpperCase()}` : ''}
          </div>
          <div>
            <span className="text-[#7a849c]">Department:</span> {record.department}
          </div>
          {(record.position || record.salary) && (
            <div>
              <span className="text-[#7a849c]">Position / Salary:</span>{' '}
              {[record.position, record.salary].filter(Boolean).join(' · ')}
            </div>
          )}
          <div>
            <span className="text-[#7a849c]">Leave Type (6A):</span> Wellness Leave
          </div>
          <div>
            <span className="text-[#7a849c]">Dates ({record.daysCount} {record.daysCount === 1 ? 'day' : 'days'}):</span>{' '}
            {record.dateLabel}
          </div>
        </div>

        <div className="space-y-2.5">
          <button
            type="button"
            disabled={downloading}
            onClick={() => void handleDownloadClick()}
            className="cam-btn flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span>{downloading ? 'Preparing PDF…' : 'Download Form 6 (PDF)'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="btn-3d-white w-full py-2.5 px-4 text-[0.86rem]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
