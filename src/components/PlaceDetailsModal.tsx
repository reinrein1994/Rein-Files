import {useState, useEffect} from 'react';
import {
  X,
  MapPin,
  Users,
  Banknote,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Copy,
  Pencil,
} from 'lucide-react';
import type {Place} from '../types';
import {ResilientImage} from './ResilientImage';

interface PlaceDetailsModalProps {
  place: Place | null;
  isSelected: boolean;
  onClose: () => void;
  onChoose: (id: string) => void;
  onEditOrReplace: (place: Place) => void;
}

export function PlaceDetailsModal({
  place,
  isSelected,
  onClose,
  onChoose,
  onEditOrReplace,
}: PlaceDetailsModalProps) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [copiedCoords, setCopiedCoords] = useState(false);

  useEffect(() => {
    setPhotoIndex(0);
    setCopiedCoords(false);
  }, [place?.id]);

  useEffect(() => {
    if (!place) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [place, onClose]);

  if (!place) return null;

  const photos = place.photos.length > 0 ? place.photos : [''];
  const currentPhoto = photos[Math.min(photoIndex, photos.length - 1)] ?? '';
  const coordsText = `${place.coordinates.lat}, ${place.coordinates.lng}`;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coordsText)}`;

  async function copyCoords() {
    try {
      await navigator.clipboard.writeText(coordsText);
      setCopiedCoords(true);
      setTimeout(() => setCopiedCoords(false), 2000);
    } catch {
      setCopiedCoords(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#1f2740]/45 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="details-title"
      onClick={onClose}
    >
      <div
        className="glass-modal w-full sm:max-w-[460px] max-h-[90dvh] rounded-b-none sm:rounded-[26px] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-white/70 shrink-0">
          <div className="min-w-0">
            <h2
              id="details-title"
              className="m-0 text-[1.15rem] font-extrabold text-[#1f2740] leading-snug"
            >
              {place.name}
            </h2>
            <p className="m-0 mt-0.5 text-[0.78rem] font-bold text-[#7a849c]">
              Rooms, rates &amp; details
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                onClose();
                onEditOrReplace(place);
              }}
              className="px-2.5 py-1.5 rounded-[12px] bg-white/80 text-[#1f2740] text-[0.76rem] font-extrabold hover:bg-white inline-flex items-center gap-1 shadow-xs"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/80 text-[#7a849c] hover:text-[#1f2740] flex items-center justify-center"
              aria-label="Close details"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Photos */}
          <div>
            <div className="relative aspect-[4/3] rounded-[18px] overflow-hidden bg-white/70 border border-white">
              <ResilientImage
                src={currentPhoto}
                alt={`${place.name} photo ${photoIndex + 1}`}
                fallbackLabel={place.name}
                className="w-full h-full object-cover"
              />
              {photos.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setPhotoIndex((p) => (p - 1 + photos.length) % photos.length)
                    }
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-[#1f2740]/60 text-white flex items-center justify-center hover:bg-[#1f2740]/80"
                    aria-label="Previous photo"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPhotoIndex((p) => (p + 1) % photos.length)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-[#1f2740]/60 text-white flex items-center justify-center hover:bg-[#1f2740]/80"
                    aria-label="Next photo"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  <span className="absolute bottom-2.5 right-2.5 px-2.5 py-0.5 rounded-full bg-[#1f2740]/70 text-white text-[0.72rem] font-bold">
                    {photoIndex + 1} / {photos.length}
                  </span>
                </>
              )}
            </div>

            {photos.length > 1 && (
              <div className="grid grid-cols-4 gap-2 mt-2">
                {photos.map((url, idx) => (
                  <button
                    key={`${url}-${idx}`}
                    type="button"
                    onClick={() => setPhotoIndex(idx)}
                    className={`aspect-[4/3] rounded-[12px] overflow-hidden border-2 transition-all ${
                      idx === photoIndex ? 'border-[#2fbf7f]' : 'border-transparent opacity-70'
                    }`}
                    aria-label={`Select photo ${idx + 1}`}
                  >
                    <ResilientImage
                      src={url}
                      alt={`${place.name} thumbnail ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Location + Coordinates */}
          <div className="p-3.5 rounded-[18px] bg-white/75 border border-white space-y-2">
            <div className="flex items-center gap-1.5 text-[0.78rem] font-extrabold text-[#7a849c]">
              <MapPin className="w-4 h-4 text-[#1fa76b]" />
              <span>Location &amp; Coordinates</span>
            </div>
            <p className="m-0 text-[0.92rem] font-bold text-[#1f2740]">{place.location}</p>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-[#7a849c]/15">
              <span className="text-[0.82rem] font-bold text-[#1f2740]">
                {place.coordinates.lat}° N, {place.coordinates.lng}° E
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void copyCoords()}
                  className="px-2.5 py-1 rounded-[10px] bg-white text-[0.75rem] font-extrabold text-[#1f2740] border border-[#7a849c]/25 inline-flex items-center gap-1"
                >
                  {copiedCoords ? (
                    <>
                      <Check className="w-3 h-3 text-[#1fa76b]" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded-[10px] bg-[#2fbf7f]/15 text-[0.75rem] font-extrabold text-[#1fa76b] inline-flex items-center gap-1"
                >
                  <span>Map</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>

          {/* Room Rates for 2 Nights + Number of Pax */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-[18px] bg-white/75 border border-white">
              <div className="flex items-center gap-1.5 text-[0.78rem] font-extrabold text-[#7a849c] mb-1">
                <Banknote className="w-4 h-4 text-[#1fa76b]" />
                <span>Room Rates (2 Nights)</span>
              </div>
              <p className="m-0 text-[1rem] font-extrabold text-[#1f2740]">
                {place.rateForTwoNights}
              </p>
              {place.rateNote && (
                <p className="m-0 mt-1 text-[0.75rem] font-semibold text-[#7a849c] leading-snug">
                  {place.rateNote}
                </p>
              )}
            </div>

            <div className="p-3.5 rounded-[18px] bg-white/75 border border-white">
              <div className="flex items-center gap-1.5 text-[0.78rem] font-extrabold text-[#7a849c] mb-1">
                <Users className="w-4 h-4 text-[#1fa76b]" />
                <span>Number of Pax</span>
              </div>
              <p className="m-0 text-[1rem] font-extrabold text-[#1f2740]">{place.pax}</p>
            </div>
          </div>

          {/* Amenities */}
          <div className="p-3.5 rounded-[18px] bg-white/75 border border-white">
            <p className="m-0 mb-2 text-[0.78rem] font-extrabold text-[#7a849c]">Amenities</p>
            {place.amenities.length === 0 ? (
              <p className="m-0 text-[0.85rem] font-semibold text-[#7a849c]">
                No amenities listed yet.
              </p>
            ) : (
              <ul className="m-0 p-0 list-none space-y-1.5">
                {place.amenities.map((amenity, idx) => (
                  <li
                    key={`${amenity}-${idx}`}
                    className="flex items-start gap-2 text-[0.86rem] font-bold text-[#1f2740]"
                  >
                    <Check className="w-4 h-4 text-[#1fa76b] mt-0.5 shrink-0" />
                    <span>{amenity}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {place.url && (
            <a
              href={place.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 text-[0.82rem] font-extrabold text-[#1fa76b] py-1"
            >
              <span>Open booking link</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>

        <div className="px-5 py-3.5 border-t border-white/70 bg-white/40 shrink-0">
          <button
            type="button"
            onClick={() => {
              onChoose(place.id);
              onClose();
            }}
            className="cam-btn"
          >
            {isSelected ? '✓ Selected for your vote' : 'Choose this place'}
          </button>
        </div>
      </div>
    </div>
  );
}
