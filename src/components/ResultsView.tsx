import type {Place, VoteResults} from '../types';

interface ResultsViewProps {
  places: Place[];
  results: VoteResults;
}

export function ResultsView({places, results}: ResultsViewProps) {
  const total = results.total || 0;
  const sorted = [...places].sort(
    (a, b) => (results.counts[b.id] ?? 0) - (results.counts[a.id] ?? 0)
  );

  return (
    <div>
      <div className="text-center mt-1 mb-3.5 font-extrabold text-[#7a849c]">
        {total} vote{total === 1 ? '' : 's'} so far
      </div>

      {sorted.map((place) => {
        const n = results.counts[place.id] ?? 0;
        const pct = total ? Math.round((n / total) * 100) : 0;
        const voters = results.voters[place.id] ?? [];

        return (
          <div key={place.id} className="glass px-[18px] py-4 mb-3">
            <b className="font-extrabold text-[#1f2740]">{place.name}</b>
            <div className="h-[10px] rounded-[10px] bg-[#788cbe]/18 my-2.5 mb-1.5 overflow-hidden">
              <i
                className="block h-full rounded-[10px] transition-[width] duration-600"
                style={{
                  width: `${pct}%`,
                  background: 'linear-gradient(90deg,#4bd69b,#1fa76b)',
                }}
              />
            </div>
            <div className="text-[0.82rem] text-[#7a849c] font-semibold">
              {n} vote{n === 1 ? '' : 's'} · {pct}%
            </div>
            {voters.length > 0 && (
              <div className="text-[0.82rem] text-[#7a849c] font-semibold mt-1.5">
                {voters.join(', ')}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
