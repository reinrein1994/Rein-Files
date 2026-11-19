import {useState, useEffect, useRef} from 'react';
import {Plus} from 'lucide-react';
import type {AppData, Place, PlaceInput} from './types';
import {PlaceCard} from './components/PlaceCard';
import {PlaceDetailsModal} from './components/PlaceDetailsModal';
import {EditReplaceModal} from './components/EditReplaceModal';
import {ResultsView} from './components/ResultsView';

type Tab = 'Vote' | 'Res';

export default function App() {
  const [data, setData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('Vote');
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [savingVote, setSavingVote] = useState(false);

  const [detailsPlace, setDetailsPlace] = useState<Place | null>(null);
  const [editor, setEditor] = useState<{
    isOpen: boolean;
    mode: 'edit' | 'replace' | 'add';
    place: Place | null;
  }>({
    isOpen: false,
    mode: 'edit',
    place: null,
  });

  const [toastMsg, setToastMsg] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<number | null>(null);

  function toast(msg: string) {
    setToastMsg(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(''), 2800);
  }

  useEffect(() => {
    fetch('/api/data')
      .then((res) => {
        if (!res.ok) throw new Error('Could not load places.');
        return res.json();
      })
      .then((d: AppData) => {
        setData(d);
      })
      .catch((e: Error) => toast(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const trimmed = name.trim();
    if (!trimmed) {
      setSaved(null);
      return;
    }
    const timer = window.setTimeout(() => {
      fetch(`/api/my-vote?name=${encodeURIComponent(trimmed)}`)
        .then((r) => r.json())
        .then((res: {placeId: string | null}) => {
          setSaved(res.placeId);
          if (res.placeId) {
            setSelected((prev) => prev ?? res.placeId);
          }
        })
        .catch(() => {});
    }, 450);

    return () => window.clearTimeout(timer);
  }, [name]);

  async function submitVote() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast('Please type your name first.');
      nameInputRef.current?.focus();
      return;
    }
    if (!selected) {
      toast('Please choose a place first.');
      return;
    }
    setSavingVote(true);
    try {
      const res = await fetch('/api/vote', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({name: trimmed, placeId: selected}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not save vote.');
      setData((prev) => (prev ? {...prev, results: json.results} : prev));
      setSaved(selected);
      toast(json.changed ? 'Vote updated ✓' : `Thanks, ${trimmed}! Vote saved ✓`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error saving vote.');
    } finally {
      setSavingVote(false);
    }
  }

  async function handleQuickRename(id: string, newName: string) {
    const existing = data?.places.find((p) => p.id === id);
    if (!existing) return;
    const res = await fetch(`/api/places/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({...existing, name: newName}),
    });
    const json = await res.json();
    if (!res.ok) {
      toast(json.error || 'Could not rename place.');
      throw new Error(json.error);
    }
    setData(json as AppData);
    toast('Place name updated ✓');
  }

  async function handleSaveEdit(id: string, input: PlaceInput) {
    const res = await fetch(`/api/places/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(input),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Could not update place.');
    setData(json as AppData);
    toast('Place updated ✓');
  }

  async function handleReplacePlace(id: string, input: PlaceInput, keepVotes: boolean) {
    const res = await fetch(`/api/places/${encodeURIComponent(id)}/replace`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({...input, keepVotes}),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Could not replace place.');
    setData(json.data as AppData);
    const newId = json.newId as string;
    if (selected === id) setSelected(keepVotes ? newId : null);
    if (saved === id) setSaved(keepVotes ? newId : null);
    toast('Place replaced ✓');
  }

  async function handleAddPlace(input: PlaceInput) {
    const res = await fetch('/api/places', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(input),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Could not add place.');
    setData(json.data as AppData);
    toast('New place added ✓');
  }

  async function handleDeletePlace(id: string) {
    const res = await fetch(`/api/places/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Could not remove place.');
    setData(json as AppData);
    if (selected === id) setSelected(null);
    if (saved === id) setSaved(null);
    toast('Place removed ✓');
  }

  const places = data?.places ?? [];
  const results = data?.results ?? {counts: {}, voters: {}, total: 0};
  const savedPlaceName = places.find((p) => p.id === saved)?.name;

  return (
    <>
      <div className="orb o1" />
      <div className="orb o2" />

      <div className="relative z-1 max-w-[480px] mx-auto h-full flex flex-col">
        <header className="pt-[calc(env(safe-area-inset-top)+18px)] px-5 pb-3 text-center shrink-0">
          <h1 className="m-0 text-[1.45rem] font-extrabold tracking-[-0.3px] text-[#1f2740]">
            {data?.title || 'Grade 5 in Camiguin 2026'}
          </h1>
          <p className="mt-1 mb-0 text-[#7a849c] text-[0.85rem] font-semibold">
            Pick where we should stay 🏝️
          </p>
        </header>

        <main className="flex-1 overflow-y-auto px-4 pt-1.5 pb-5">
          {tab === 'Vote' ? (
            <div>
              <div className="glass px-4 py-3.5 mb-4">
                <label
                  htmlFor="name"
                  className="block font-extrabold text-[0.85rem] text-[#7a849c] mb-1.5"
                >
                  Your name
                </label>
                <input
                  ref={nameInputRef}
                  id="name"
                  type="text"
                  maxLength={60}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Type your name"
                  autoComplete="name"
                  className="w-full px-4 py-[13px] rounded-[16px] border-[1.5px] border-[#788cbe]/25 bg-white/80 text-[1rem] font-bold text-[#1f2740] outline-none focus:border-[#2fbf7f] focus:shadow-[0_0_0_4px_rgba(47,191,127,0.18)]"
                />
                {savedPlaceName && (
                  <div className="mt-2.5 text-[0.85rem] font-bold text-[#1fa76b]">
                    You voted for {savedPlaceName}. Choose another place to change your vote.
                  </div>
                )}
              </div>

              {loading ? (
                <div className="glass p-6 text-center text-[0.9rem] font-bold text-[#7a849c]">
                  Loading places…
                </div>
              ) : (
                <>
                  <div>
                    {places.map((p) => (
                      <PlaceCard
                        key={p.id}
                        place={p}
                        isSelected={selected === p.id}
                        isSavedVote={saved === p.id}
                        onSelect={(id) => setSelected(id)}
                        onSeeDetails={(pl) => setDetailsPlace(pl)}
                        onEditOrReplace={(pl, mode) =>
                          setEditor({isOpen: true, mode, place: pl})
                        }
                        onQuickRename={handleQuickRename}
                      />
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setEditor({isOpen: true, mode: 'add', place: null})}
                    className="glass w-full py-3.5 px-4 text-[0.88rem] font-extrabold text-[#1fa76b] hover:bg-white/80 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add another place</span>
                  </button>
                </>
              )}
            </div>
          ) : (
            <ResultsView places={places} results={results} />
          )}
        </main>

        {tab === 'Vote' && (
          <div className="px-4 pt-2.5 pb-[calc(env(safe-area-inset-bottom)+8px)] shrink-0">
            <button
              type="button"
              onClick={() => void submitVote()}
              disabled={!selected || selected === saved || savingVote}
              className="cam-btn text-[1rem] py-[15px]"
              style={{marginTop: 0}}
            >
              {savingVote
                ? 'Saving…'
                : saved
                  ? 'Update my vote'
                  : 'Submit my vote'}
            </button>
          </div>
        )}

        <nav className="glass flex gap-2 mx-3.5 mb-[calc(env(safe-area-inset-bottom)+12px)] p-2 shrink-0">
          <button
            type="button"
            onClick={() => setTab('Vote')}
            className={`flex-1 py-[11px] rounded-[16px] font-extrabold text-[0.92rem] cursor-pointer transition-all ${
              tab === 'Vote'
                ? 'bg-white text-[#1fa76b] shadow-[0_6px_14px_rgba(60,80,130,0.15)]'
                : 'bg-transparent text-[#7a849c]'
            }`}
          >
            🗳️ Vote
          </button>
          <button
            type="button"
            onClick={() => setTab('Res')}
            className={`flex-1 py-[11px] rounded-[16px] font-extrabold text-[0.92rem] cursor-pointer transition-all ${
              tab === 'Res'
                ? 'bg-white text-[#1fa76b] shadow-[0_6px_14px_rgba(60,80,130,0.15)]'
                : 'bg-transparent text-[#7a849c]'
            }`}
          >
            📊 Results
          </button>
        </nav>
      </div>

      {toastMsg && (
        <div className="glass fixed top-[calc(env(safe-area-inset-top)+14px)] left-1/2 -translate-x-1/2 z-[60] px-5 py-3 font-extrabold text-[0.9rem] max-w-[90%] text-center text-[#1f2740]">
          {toastMsg}
        </div>
      )}

      <PlaceDetailsModal
        place={detailsPlace}
        isSelected={Boolean(detailsPlace && selected === detailsPlace.id)}
        onClose={() => setDetailsPlace(null)}
        onChoose={(id) => setSelected(id)}
        onEditOrReplace={(p) => setEditor({isOpen: true, mode: 'edit', place: p})}
      />

      <EditReplaceModal
        isOpen={editor.isOpen}
        mode={editor.mode}
        place={editor.place}
        canDelete={places.length > 1}
        onClose={() => setEditor((prev) => ({...prev, isOpen: false}))}
        onSaveEdit={handleSaveEdit}
        onReplacePlace={handleReplacePlace}
        onAddPlace={handleAddPlace}
        onDeletePlace={handleDeletePlace}
      />
    </>
  );
}
