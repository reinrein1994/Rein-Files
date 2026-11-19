import {useState, useEffect} from 'react';
import type {ChangeEvent, FormEvent} from 'react';
import {X, Plus, Trash2, Upload, ArrowLeftRight, Pencil} from 'lucide-react';
import type {Place, PlaceInput} from '../types';
import {CAMIGUIN_GALLERY_PRESETS} from '../data/galleryPresets';
import {ResilientImage} from './ResilientImage';

interface EditReplaceModalProps {
  isOpen: boolean;
  mode: 'edit' | 'replace' | 'add';
  place: Place | null;
  canDelete: boolean;
  onClose: () => void;
  onSaveEdit: (id: string, input: PlaceInput) => Promise<void>;
  onReplacePlace: (id: string, input: PlaceInput, keepVotes: boolean) => Promise<void>;
  onAddPlace: (input: PlaceInput) => Promise<void>;
  onDeletePlace: (id: string) => Promise<void>;
}

const EMPTY_FORM: PlaceInput = {
  name: '',
  url: '',
  location: '',
  coordinates: {lat: '9.2400', lng: '124.7000'},
  rateForTwoNights: '',
  rateNote: '2 nights estimate',
  pax: '',
  amenities: ['Air-conditioning', 'Free Wi-Fi'],
  photos: [CAMIGUIN_GALLERY_PRESETS[0].url],
};

function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read selected image file.'));
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const img = new window.Image();
      img.onerror = () => reject(new Error('Invalid image format.'));
      img.onload = () => {
        const maxWidth = 1200;
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

export function EditReplaceModal({
  isOpen,
  mode: initialMode,
  place,
  canDelete,
  onClose,
  onSaveEdit,
  onReplacePlace,
  onAddPlace,
  onDeletePlace,
}: EditReplaceModalProps) {
  const [activeMode, setActiveMode] = useState<'edit' | 'replace' | 'add'>(initialMode);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [rateForTwoNights, setRateForTwoNights] = useState('');
  const [rateNote, setRateNote] = useState('');
  const [pax, setPax] = useState('');
  const [url, setUrl] = useState('');
  const [amenitiesText, setAmenitiesText] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const [keepVotes, setKeepVotes] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setActiveMode(initialMode);
    setConfirmDelete(false);
    setError('');
    setNewPhotoUrl('');
    setKeepVotes(false);

    if (initialMode === 'edit' && place) {
      setName(place.name);
      setLocation(place.location);
      setLat(place.coordinates.lat);
      setLng(place.coordinates.lng);
      setRateForTwoNights(place.rateForTwoNights);
      setRateNote(place.rateNote);
      setPax(place.pax);
      setUrl(place.url);
      setAmenitiesText(place.amenities.join('\n'));
      setPhotos([...place.photos]);
    } else if (initialMode === 'replace') {
      setName('');
      setLocation('');
      setLat('9.2400');
      setLng('124.7000');
      setRateForTwoNights('');
      setRateNote('2 nights estimate');
      setPax('');
      setUrl('');
      setAmenitiesText('Air-conditioning\nFree Wi-Fi');
      setPhotos([CAMIGUIN_GALLERY_PRESETS[5].url]);
    } else {
      setName(EMPTY_FORM.name);
      setLocation(EMPTY_FORM.location);
      setLat(EMPTY_FORM.coordinates.lat);
      setLng(EMPTY_FORM.coordinates.lng);
      setRateForTwoNights(EMPTY_FORM.rateForTwoNights);
      setRateNote(EMPTY_FORM.rateNote);
      setPax(EMPTY_FORM.pax);
      setUrl(EMPTY_FORM.url);
      setAmenitiesText(EMPTY_FORM.amenities.join('\n'));
      setPhotos([...EMPTY_FORM.photos]);
    }
  }, [isOpen, initialMode, place]);

  function switchEditorTab(nextTab: 'edit' | 'replace') {
    setActiveMode(nextTab);
    setError('');
    if (nextTab === 'edit' && place) {
      setName(place.name);
      setLocation(place.location);
      setLat(place.coordinates.lat);
      setLng(place.coordinates.lng);
      setRateForTwoNights(place.rateForTwoNights);
      setRateNote(place.rateNote);
      setPax(place.pax);
      setUrl(place.url);
      setAmenitiesText(place.amenities.join('\n'));
      setPhotos([...place.photos]);
    } else {
      setName('');
      setLocation('');
      setLat('9.2400');
      setLng('124.7000');
      setRateForTwoNights('');
      setRateNote('2 nights estimate');
      setPax('');
      setUrl('');
      setAmenitiesText('Air-conditioning\nFree Wi-Fi');
      setPhotos([CAMIGUIN_GALLERY_PRESETS[5].url]);
    }
  }

  if (!isOpen) return null;

  async function handleFileUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file);
      setPhotos((prev) => [...prev, compressed]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload image.');
    }
    e.target.value = '';
  }

  function handleAddPhotoUrl() {
    const trimmed = newPhotoUrl.trim();
    if (!trimmed) return;
    setPhotos((prev) => [...prev, trimmed]);
    setNewPhotoUrl('');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('Please enter a place name.');
      return;
    }

    const input: PlaceInput = {
      name: name.trim(),
      location: location.trim() || 'Camiguin, Philippines',
      coordinates: {
        lat: lat.trim() || '9.2400',
        lng: lng.trim() || '124.7000',
      },
      rateForTwoNights: rateForTwoNights.trim() || 'Rate TBD',
      rateNote: rateNote.trim(),
      pax: pax.trim() || '2 – 4 pax',
      url: url.trim(),
      amenities: amenitiesText
        .split(/\n|,/)
        .map((item) => item.trim())
        .filter(Boolean),
      photos: photos.length > 0 ? photos : [CAMIGUIN_GALLERY_PRESETS[5].url],
    };

    setSubmitting(true);
    try {
      if (activeMode === 'add') {
        await onAddPlace(input);
      } else if (activeMode === 'replace' && place) {
        await onReplacePlace(place.id, input, keepVotes);
      } else if (place) {
        await onSaveEdit(place.id, input);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save changes.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!place) return;
    setSubmitting(true);
    setError('');
    try {
      await onDeletePlace(place.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to remove place.');
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls =
    'w-full px-3.5 py-2.5 rounded-[14px] border-[1.5px] border-[#788cbe]/25 bg-white/85 text-[0.92rem] font-bold text-[#1f2740] outline-none focus:border-[#2fbf7f]';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#1f2740]/45 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-place-title"
      onClick={onClose}
    >
      <div
        className="glass-modal w-full sm:max-w-[460px] max-h-[90dvh] rounded-b-none sm:rounded-[26px] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-white/70 shrink-0">
          <div className="min-w-0">
            <h2 id="edit-place-title" className="m-0 text-[1.1rem] font-extrabold text-[#1f2740]">
              {activeMode === 'add'
                ? 'Add a new place'
                : activeMode === 'replace'
                  ? `Replace "${place?.name}"`
                  : `Edit "${place?.name}"`}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/80 text-[#7a849c] hover:text-[#1f2740] flex items-center justify-center shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {activeMode !== 'add' && place && (
          <div className="px-5 pt-3 pb-2 flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => switchEditorTab('edit')}
              className={`flex-1 py-2 px-3 rounded-[14px] text-[0.82rem] font-extrabold inline-flex items-center justify-center gap-1.5 transition-all ${
                activeMode === 'edit'
                  ? 'bg-white text-[#1fa76b] shadow-sm'
                  : 'bg-white/40 text-[#7a849c]'
              }`}
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Edit details</span>
            </button>
            <button
              type="button"
              onClick={() => switchEditorTab('replace')}
              className={`flex-1 py-2 px-3 rounded-[14px] text-[0.82rem] font-extrabold inline-flex items-center justify-center gap-1.5 transition-all ${
                activeMode === 'replace'
                  ? 'bg-white text-[#1fa76b] shadow-sm'
                  : 'bg-white/40 text-[#7a849c]'
              }`}
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>Replace place</span>
            </button>
          </div>
        )}

        <form onSubmit={(e) => void handleSubmit(e)} className="flex-1 overflow-y-auto px-5 py-4 space-y-3.5">
          {error && (
            <div className="p-3 rounded-[14px] bg-red-50 border border-red-200 text-[0.82rem] font-bold text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-[0.8rem] font-extrabold text-[#7a849c] mb-1" htmlFor="ed-name">
              Place name *
            </label>
            <input
              id="ed-name"
              type="text"
              required
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter place name"
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-[0.8rem] font-extrabold text-[#7a849c] mb-1" htmlFor="ed-loc">
              Location
            </label>
            <input
              id="ed-loc"
              type="text"
              maxLength={200}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Barangay Yumbing, Mambajao, Camiguin"
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[0.8rem] font-extrabold text-[#7a849c] mb-1" htmlFor="ed-lat">
                Latitude (° N)
              </label>
              <input
                id="ed-lat"
                type="text"
                maxLength={32}
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="9.2450"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-[0.8rem] font-extrabold text-[#7a849c] mb-1" htmlFor="ed-lng">
                Longitude (° E)
              </label>
              <input
                id="ed-lng"
                type="text"
                maxLength={32}
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                placeholder="124.6750"
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[0.8rem] font-extrabold text-[#7a849c] mb-1" htmlFor="ed-rate">
                Room rates (2 nights)
              </label>
              <input
                id="ed-rate"
                type="text"
                maxLength={100}
                value={rateForTwoNights}
                onChange={(e) => setRateForTwoNights(e.target.value)}
                placeholder="₱6,000 – ₱9,000"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-[0.8rem] font-extrabold text-[#7a849c] mb-1" htmlFor="ed-pax">
                Number of pax
              </label>
              <input
                id="ed-pax"
                type="text"
                maxLength={80}
                value={pax}
                onChange={(e) => setPax(e.target.value)}
                placeholder="4 – 6 pax"
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className="block text-[0.8rem] font-extrabold text-[#7a849c] mb-1" htmlFor="ed-note">
              Rate details note
            </label>
            <input
              id="ed-note"
              type="text"
              maxLength={180}
              value={rateNote}
              onChange={(e) => setRateNote(e.target.value)}
              placeholder="2 nights · breakfast included"
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-[0.8rem] font-extrabold text-[#7a849c] mb-1" htmlFor="ed-amenities">
              Amenities (one per line or comma-separated)
            </label>
            <textarea
              id="ed-amenities"
              rows={3}
              value={amenitiesText}
              onChange={(e) => setAmenitiesText(e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-[0.8rem] font-extrabold text-[#7a849c] mb-1" htmlFor="ed-url">
              Booking link (optional)
            </label>
            <input
              id="ed-url"
              type="url"
              maxLength={500}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.agoda.com/..."
              className={inputCls}
            />
          </div>

          {/* Photos */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[0.8rem] font-extrabold text-[#7a849c]">
                Photos ({photos.length})
              </span>
              <label className="cursor-pointer px-2.5 py-1 rounded-[10px] bg-white text-[0.75rem] font-extrabold text-[#1fa76b] border border-[#2fbf7f]/40 inline-flex items-center gap-1">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => void handleFileUpload(e)}
                />
              </label>
            </div>

            {photos.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {photos.map((photoUrl, idx) => (
                  <div
                    key={`${photoUrl.slice(0, 24)}-${idx}`}
                    className="relative aspect-[4/3] rounded-[12px] overflow-hidden border border-white bg-white/60"
                  >
                    <ResilientImage
                      src={photoUrl}
                      alt={`Photo ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setPhotos((prev) => prev.filter((_, i) => i !== idx))}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-[#1f2740]/75 text-white flex items-center justify-center"
                      aria-label="Remove photo"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-1.5">
              <input
                type="url"
                value={newPhotoUrl}
                onChange={(e) => setNewPhotoUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddPhotoUrl();
                  }
                }}
                placeholder="Paste photo URL"
                className="flex-1 px-3 py-2 rounded-[12px] border-[1.5px] border-[#788cbe]/25 bg-white/85 text-[0.82rem] font-bold text-[#1f2740] outline-none focus:border-[#2fbf7f]"
              />
              <button
                type="button"
                onClick={handleAddPhotoUrl}
                className="px-3 py-2 rounded-[12px] bg-white text-[0.78rem] font-extrabold text-[#1f2740] border border-[#788cbe]/25 inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>
          </div>

          {activeMode === 'replace' && (
            <label className="flex items-start gap-2 p-3 rounded-[14px] bg-white/75 border border-[#2fbf7f]/35 text-[0.78rem] font-bold text-[#1f2740] cursor-pointer">
              <input
                type="checkbox"
                checked={keepVotes}
                onChange={(e) => setKeepVotes(e.target.checked)}
                className="mt-0.5 accent-[#1fa76b]"
              />
              <span>Keep existing votes for this slot when replacing</span>
            </label>
          )}

          <div className="pt-2 space-y-2">
            <button type="submit" disabled={submitting} className="cam-btn">
              {submitting
                ? 'Saving…'
                : activeMode === 'add'
                  ? 'Add place'
                  : activeMode === 'replace'
                    ? 'Replace place'
                    : 'Save changes'}
            </button>

            {activeMode !== 'add' && place && canDelete && (
              <div className="text-center pt-1">
                {confirmDelete ? (
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => void handleDelete()}
                      className="px-3.5 py-1.5 rounded-[12px] bg-red-500 text-white text-[0.78rem] font-extrabold"
                    >
                      Confirm remove
                    </button>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => setConfirmDelete(false)}
                      className="px-3.5 py-1.5 rounded-[12px] bg-white text-[#7a849c] text-[0.78rem] font-extrabold"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="inline-flex items-center gap-1 text-[0.78rem] font-extrabold text-red-500 hover:text-red-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove this place</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
