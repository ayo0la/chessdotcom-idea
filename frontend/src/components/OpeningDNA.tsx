import { useEffect, useState } from "react";
import {
  getOpenings,
  compareOpenings,
  type OpeningDnaResponse,
} from "../api.js";

interface OpeningDNAProps {
  me: string;
  friends: string[];
}

export default function OpeningDNA({ me, friends }: OpeningDNAProps) {
  const [dna, setDna] = useState<OpeningDnaResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [friend, setFriend] = useState("");
  const [narrative, setNarrative] = useState<string | null>(null);
  const [compareError, setCompareError] = useState(false);
  const [comparing, setComparing] = useState(false);

  useEffect(() => {
    setDna(null);
    getOpenings(me)
      .then(setDna)
      .catch(() => setFailed(true));
  }, [me]);

  async function handleCompare() {
    if (!friend) return;
    setComparing(true);
    setCompareError(false);
    setNarrative(null);
    try {
      const result = await compareOpenings(friend);
      setNarrative(result.narrative);
    } catch {
      setCompareError(true);
    } finally {
      setComparing(false);
    }
  }

  if (failed) return null;

  return (
    <section className="card mt-6 p-4 sm:p-5 animate-rise">
      <p className="kicker">Your repertoire</p>
      <h2 className="mb-1 font-display text-lg font-bold">Opening DNA</h2>
      {!dna ? (
        <p className="text-sm text-gray-500">Analyzing your games...</p>
      ) : dna.openings.length === 0 ? (
        <p className="text-sm text-gray-500">
          No games analyzed yet. Play some rated games on Chess.com and check back.
        </p>
      ) : (
        <>
          <p className="mb-4 text-xs text-gray-400">
            Win rate in your most played openings ({dna.totalGames} recent games)
          </p>
          <ul className="space-y-3">
            {dna.openings.slice(0, 5).map((o) => (
              <li key={o.eco}>
                <div className="mb-1 flex items-baseline justify-between text-sm">
                  <span className="truncate pr-2 text-gray-200">{o.name}</span>
                  <span className="whitespace-nowrap text-xs tabular-nums text-gray-400">
                    {o.winRate}% · {o.games} games
                  </span>
                </div>
                <div className="bar-track">
                  <div
                    role="meter"
                    aria-label={`${o.name} win rate`}
                    aria-valuenow={o.winRate}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className="bar-fill"
                    style={{ width: `${o.winRate}%` }}
                    title={`${o.wins}W / ${o.losses}L / ${o.draws}D`}
                  />
                </div>
              </li>
            ))}
          </ul>
          {friends.length > 0 && (
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <select
                value={friend}
                onChange={(e) => setFriend(e.target.value)}
                className="input-field flex-1 py-1.5 text-sm sm:flex-none"
              >
                <option value="">Compare with...</option>
                {friends.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
              <button
                onClick={handleCompare}
                disabled={!friend || comparing}
                className="btn-primary px-4 py-1.5 text-sm disabled:cursor-not-allowed"
              >
                {comparing ? "Comparing..." : "Compare"}
              </button>
            </div>
          )}
          {narrative && (
            <p className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3 text-sm leading-relaxed text-gray-200">
              {narrative}
            </p>
          )}
          {compareError && (
            <p className="mt-4 text-sm text-red-400">
              Comparison failed. Try again in a moment.
            </p>
          )}
        </>
      )}
    </section>
  );
}
