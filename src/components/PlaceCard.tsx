import {useState, useEffect, useRef} from 'react';
import {Pencil, ArrowLeftRight, Check, X} from 'lucide-react';
import type {Place} from '../types';

interface PlaceCardProps {
  place: Place;
  isSelected: boolean;
  isSavedVote: boolean;
  onSelect: (id: string) => void;
  onSeeDetails: (place: Place) => void;
  onEditOrReplace: (place: Place, initialMode: 'edit' | 'replace') => void;
  onQuickRename: (id: string, newName: string) => Promise<void>;
}

export function PlaceCard({
  place,
  isSelected,
  isSavedVote,
  onSelect,
  onSeeDetails,
  onEditOrReplace,
  onQuickRename,
}: PlaceCardProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftName, setDraftName] = useState(place.name);
  const [savingName, setSavingName] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraftName(place.name);
  }, [place.name]);

  useEffect(() => {
    if (isRenaming) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isRenaming]);

  async function commitRename() {
    const trimmed = draftName.trim();
    if (!trimmed || trimmed === place.name) {
      setDraftName(place.name);
      setIsRenaming(false);
      return;
    }
    setSavingName(true);
    try {
      await onQuickRename(place.id, trimmed);
      setIsRenaming(false);
    } finally {
      setSavingName(false);
    }
  }

  return (
    <div
      className={`glass cam-card p-[18px] mb-4 transition-[transform,outline-color] duration-200 ${
        isSelected ? 'sel' : ''
      }`}
    >
      {isSavedVote && (
        <span
          className="inline-block text-[0.72rem] font-extrabold px-2.5 py-1 rounded-[20px] mb-2.5"
          style={{color: 'var(--green2)', background: 'rgba(47,191,127,.14)'}}
        >
          ✓ Your current vote
        </span>
      )}

      {isRenaming ? (
        <div className="mb-3 flex items-center gap-1.5">
          <input
            ref={inputRef}
            type="text"
            value={draftName}
            maxLength={120}
            disabled={savingName}
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void commitRename();
              } else if (e.key === 'Escape') {
                setDraftName(place.name);
                setIsRenaming(false);
              }
            }}
            aria-label="Edit place name"
            className="flex-1 min-w-0 px-3 py-2 rounded-[14px] border-[1.5px] border-[#2fbf7f] bg-white/90 text-[1rem] font-extrabold text-[#1f2740] outline-none"
          />
          <button
            type="button"
            disabled={savingName}
            onClick={() => void commitRename()}
            className="w-9 h-9 rounded-[12px] flex items-center justify-center text-white shrink-0"
            style={{background: 'linear-gradient(135deg,#4bd69b,var(--green2))'}}
            aria-label="Save place name"
            title="Save name"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={savingName}
            onClick={() => {
              setDraftName(place.name);
              setIsRenaming(false);
            }}
            className="w-9 h-9 rounded-[12px] flex items-center justify-center bg-white/80 text-[#7a849c] shrink-0"
            aria-label="Cancel rename"
            title="Cancel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-2 mb-3">
          <h3 className="m-0 text-[1.08rem] font-extrabold text-[#1f2740] leading-snug">
            {place.name}
          </h3>
          <div className="flex items-center gap-1 shrink-0 -mt-0.5">
            <button
              type="button"
              onClick={() => setIsRenaming(true)}
              className="w-7 h-7 rounded-full flex items-center justify-center bg-white/75 text-[#7a849c] hover:text-[#1f2740] hover:bg-white transition-colors"
              title="Rename place"
              aria-label={`Rename ${place.name}`}
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onEditOrReplace(place, 'replace')}
              className="w-7 h-7 rounded-full flex items-center justify-center bg-white/75 text-[#7a849c] hover:text-[#1fa76b] hover:bg-white transition-colors"
              title="Edit details or replace place"
              aria-label={`Edit or replace ${place.name}`}
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => onSeeDetails(place)}
        className="cam-btn"
      >
        See details
      </button>

      <div className="flex items-center gap-2.5 mt-2.5">
        <button
          type="button"
          onClick={() => onSelect(place.id)}
          className="cam-btn cam-choose flex-1"
          style={{marginTop: 0}}
        >
          {isSelected ? '✓ Selected' : 'Choose this place'}
        </button>

        {isSelected && (
          <div
            className={`w-[46px] h-[46px] rounded-full flex items-center justify-center shrink-0 avatar-pop border-2 ${
              isSavedVote
                ? 'text-white border-white'
                : 'bg-white/90 text-[#1fa76b] border-[#2fbf7f]'
            }`}
            style={
              isSavedVote
                ? {
                    background: 'linear-gradient(135deg,#4bd69b,var(--green2))',
                    boxShadow: '0 8px 16px rgba(47,191,127,.3)',
                  }
                : {
                    boxShadow:
                      '0 8px 16px rgba(47,191,127,.3), inset 0 1px 0 #fff',
                  }
            }
            title={isSavedVote ? 'Your saved vote' : 'Your pick'}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <circle cx="12" cy="8" r="4.2" />
              <path d="M4 21c0-4.4 3.6-7.5 8-7.5s8 3.1 8 7.5z" />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}
