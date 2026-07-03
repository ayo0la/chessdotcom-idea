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
    <section className="mt-10">
      <h2 className="text-lg font-bold mb-1">Loss Patterns</h2>
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
            <p className="text-sm text-gray-300 border border-gray-800 rounded-lg bg-gray-900/60 px-4 py-3">
              {narrative}
            </p>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="text-sm px-3 py-1.5 rounded bg-green-600 hover:bg-green-500 disabled:opacity-50 font-medium"
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
