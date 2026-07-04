import { useEffect, useState } from "react";
import {
  getFingerprint,
  getMyLosses,
  saveFingerprint,
  type StoredFingerprint,
} from "../api.js";
import {
  analyzeLosses,
  summarizeFingerprint,
  MISTAKE_LABELS,
  MISTAKE_ADVICE,
  type MistakeType,
} from "../lib/blunders.js";
import { createEngine } from "../lib/engine.js";

type Fingerprint = NonNullable<StoredFingerprint["fingerprint"]>;

export default function BlunderFingerprint() {
  const [fingerprint, setFingerprint] = useState<Fingerprint | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    getFingerprint()
      .then((stored) => setFingerprint(stored.fingerprint))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  async function handleAnalyze() {
    setRunning(true);
    setNotice(null);
    setProgress(null);
    let engine: Awaited<ReturnType<typeof createEngine>> | null = null;
    try {
      const losses = await getMyLosses(8);
      if (losses.length === 0) {
        setNotice("No recent losses found. Nice. Come back after a rough session.");
        return;
      }
      engine = await createEngine();
      const mistakes = await analyzeLosses(
        losses,
        (fen) => engine!.evalFen(fen),
        (done, total) => setProgress([done, total])
      );
      const summary = summarizeFingerprint(mistakes, losses.length);
      setFingerprint(summary);
      await saveFingerprint(summary);
    } catch {
      setNotice("Analysis failed. Reload the page and try again.");
    } finally {
      engine?.quit();
      setRunning(false);
      setProgress(null);
    }
  }

  if (!loaded) return null;

  const total = fingerprint
    ? Math.max(...Object.values(fingerprint.byType), 1)
    : 1;
  const sortedTypes = fingerprint
    ? (Object.entries(fingerprint.byType) as Array<[MistakeType, number]>).sort(
        (a, b) => b[1] - a[1]
      )
    : [];

  return (
    <section className="card mt-6 p-4 sm:p-5 animate-rise">
      <div className="mb-1 flex items-start justify-between">
        <div>
          <p className="kicker">Where you lose</p>
          <h2 className="font-display text-lg font-bold">Blunder Fingerprint</h2>
        </div>
        {fingerprint && !running && (
          <button
            onClick={handleAnalyze}
            className="text-sm text-emerald-400 transition-colors hover:text-emerald-300"
          >
            Re-analyze
          </button>
        )}
      </div>

      {!fingerprint && !running && (
        <>
          <p className="text-gray-400 text-sm mb-3">
            Stockfish replays your recent losses in your browser and finds where
            you actually lose games.
          </p>
          <button onClick={handleAnalyze} className="btn-primary px-4 py-2 text-sm">
            Analyze my recent losses
          </button>
        </>
      )}

      {running && (
        <p className="text-gray-400 text-sm">
          Analyzing{progress ? ` game ${progress[0]} of ${progress[1]}` : ""}…
          this runs locally and takes a minute or two.
        </p>
      )}

      {notice && <p className="text-gray-400 text-sm mt-2">{notice}</p>}

      {fingerprint && !running && (
        <div className="mt-2">
          <p className="text-gray-400 text-xs mb-3">
            {fingerprint.mistakes} costly mistakes across your last{" "}
            {fingerprint.gamesAnalyzed} losses
          </p>
          <ul className="space-y-3">
            {sortedTypes.map(([type, count]) => (
              <li key={type}>
                <div className="flex items-baseline justify-between text-sm mb-1">
                  <span className="text-gray-200">
                    {MISTAKE_LABELS[type] ?? type}
                  </span>
                  <span className="text-gray-400 text-xs">{count}</span>
                </div>
                <div className="bar-track">
                  <div
                    role="meter"
                    aria-label={`${MISTAKE_LABELS[type] ?? type} count`}
                    aria-valuenow={count}
                    aria-valuemin={0}
                    aria-valuemax={total}
                    className="bar-fill"
                    style={{ width: `${(count / total) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
          {sortedTypes[0] && (
            <p className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3 text-sm leading-relaxed text-gray-200">
              <span className="font-semibold text-emerald-400">Fix first: </span>
              {MISTAKE_ADVICE[sortedTypes[0][0]] ??
                "Review the sample games below."}
            </p>
          )}
          {fingerprint.examples.length > 0 && (
            <div className="mt-4">
              <h3 className="text-xs uppercase tracking-wide text-gray-500 mb-1.5">
                Worst moments
              </h3>
              <ul className="space-y-1">
                {fingerprint.examples.map((ex) => (
                  <li key={`${ex.gameId}-${ex.moveNumber}`} className="text-sm">
                    <a
                      href={ex.gameId}
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-400 transition-colors hover:text-emerald-300 hover:underline"
                    >
                      Move {ex.moveNumber}: {ex.san}
                    </a>{" "}
                    <span className="text-gray-500 text-xs">
                      {MISTAKE_LABELS[ex.type as MistakeType] ?? ex.type} · lost{" "}
                      {(ex.dropCp / 100).toFixed(1)} pawns
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
