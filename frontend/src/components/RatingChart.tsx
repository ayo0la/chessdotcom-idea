import { useEffect, useState } from "react";
import { getRatingHistory, type RatingPoint } from "../api.js";

interface RatingChartProps {
  tc: string;
}

export default function RatingChart({ tc }: RatingChartProps) {
  const [points, setPoints] = useState<RatingPoint[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setPoints(null);
    setFailed(false);
    getRatingHistory(tc)
      .then(setPoints)
      .catch(() => setFailed(true));
  }, [tc]);

  if (failed || points === null) return null;

  return (
    <section className="mt-10">
      <h2 className="text-lg font-bold mb-1">Rating Progress</h2>
      {points.length < 2 ? (
        <p className="text-gray-500 text-sm">
          Tracking your rating from here on. Play a few games and the graph
          will fill in.
        </p>
      ) : (
        <Chart points={points} />
      )}
    </section>
  );
}

function Chart({ points }: { points: RatingPoint[] }) {
  const W = 100;
  const H = 36;
  const PAD = 2;
  const ratings = points.map((p) => p.rating);
  const min = Math.min(...ratings);
  const max = Math.max(...ratings);
  const span = Math.max(max - min, 10);

  const coords = points
    .map((p, i) => {
      const x = PAD + (i / (points.length - 1)) * (W - PAD * 2);
      const y = PAD + (1 - (p.rating - min) / span) * (H - PAD * 2);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  const latest = points[points.length - 1];
  const first = points[0];
  const delta = latest.rating - first.rating;

  return (
    <div>
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-2xl font-bold text-gray-100">{latest.rating}</span>
        <span className={delta >= 0 ? "text-green-400 text-sm" : "text-red-400 text-sm"}>
          {delta >= 0 ? "+" : ""}
          {delta} over {points.length} updates
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full h-24 rounded-lg border border-gray-800 bg-gray-900/40"
        role="img"
        aria-label={`Rating over time, from ${first.rating} to ${latest.rating}`}
      >
        <polyline
          points={coords}
          fill="none"
          stroke="#16a34a"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          style={{ strokeWidth: 2 }}
        />
      </svg>
    </div>
  );
}
