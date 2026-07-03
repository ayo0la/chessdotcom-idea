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
    <section className="mt-10">
      <h2 className="text-lg font-bold mb-1">Opening DNA</h2>
      {!dna ? (
        <p className="text-gray-500 text-sm">Analyzing your games...</p>
      ) : dna.openings.length === 0 ? (
        <p className="text-gray-500 text-sm">
          No games analyzed yet. Play some rated games on Chess.com and check back.
        </p>
      ) : (
        <>
          <p className="text-gray-400 text-xs mb-4">
            Win rate in your most played openings ({dna.totalGames} recent games)
          </p>
          <ul className="space-y-3">
            {dna.openings.slice(0, 5).map((o) => (
              <li key={o.eco}>
                <div className="flex items-baseline justify-between text-sm mb-1">
                  <span className="text-gray-200 truncate pr-2">{o.name}</span>
                  <span className="text-gray-400 text-xs whitespace-nowrap">
                    {o.winRate}% · {o.games} games
                  </span>
                </div>
                <div className="h-2 rounded-full bg-gray-800">
                  <div
                    role="meter"
                    aria-label={`${o.name} win rate`}
                    aria-valuenow={o.winRate}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className="h-2 rounded-full bg-green-600"
                    style={{ width: `${o.winRate}%` }}
                    title={`${o.wins}W / ${o.losses}L / ${o.draws}D`}
                  />
                </div>
              </li>
            ))}
          </ul>
          {friends.length > 0 && (
            <div className="mt-5 flex items-center gap-2">
              <select
                value={friend}
                onChange={(e) => setFriend(e.target.value)}
                className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200"
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
                className="text-sm px-3 py-1.5 rounded bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {comparing ? "Comparing..." : "Compare"}
              </button>
            </div>
          )}
          {narrative && (
            <p className="mt-4 text-sm text-gray-300 border border-gray-800 rounded-lg bg-gray-900/60 px-4 py-3">
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
