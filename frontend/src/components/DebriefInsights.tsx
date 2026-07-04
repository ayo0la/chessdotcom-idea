import { useState } from "react";
import { getDebriefSummary } from "../api.js";

interface DebriefInsightsProps {
  count: number;
}

export default function DebriefInsights({ count }: DebriefInsightsProps) {
  const [narrative, setNarrative] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);

  if (count === 0) return null;

  async function handleGenerate() {
    setLoading(true);
    setFailed(false);
    try {
      const summary = await getDebriefSummary(true);
      setNarrative(summary.narrative);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card mt-6 p-4 sm:p-5 animate-rise">
      <p className="kicker">From your debriefs</p>
      <h2 className="mb-1 font-display text-lg font-bold">Loss Patterns</h2>
      {count < 10 ? (
        <p className="text-gray-500 text-sm">
          {count} of 10 debriefs collected. Keep debriefing your losses to
          unlock a pattern diagnosis.
        </p>
      ) : (
        <>
          <p className="text-gray-400 text-xs mb-3">
            Based on your last {Math.min(count, 30)} loss debriefs
          </p>
          {narrative ? (
            <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3 text-sm leading-relaxed text-gray-200">
              {narrative}
            </p>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="btn-primary px-4 py-2 text-sm"
            >
              {loading ? "Analyzing..." : "Generate diagnosis"}
            </button>
          )}
          {failed && (
            <p className="mt-3 text-sm text-red-400">
              Could not generate the diagnosis. Try again in a moment.
            </p>
          )}
        </>
      )}
    </section>
  );
}
