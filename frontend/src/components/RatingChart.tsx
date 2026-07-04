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
    <section className="card mt-6 p-4 sm:p-5 animate-rise">
      <p className="kicker">Progress</p>
      <h2 className="mb-2 font-display text-lg font-bold">Rating Progress</h2>
      {points.length < 2 ? (
        <p className="text-sm text-gray-500">
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

  const areaCoords = `${PAD},${H - PAD} ${coords} ${W - PAD},${H - PAD}`;

  return (
    <div>
      <div className="mb-2 flex items-baseline gap-2">
        <span className="font-display text-3xl font-bold tabular-nums text-gray-100">
          {latest.rating}
        </span>
        <span
          className={
            delta >= 0 ? "text-sm text-emerald-400" : "text-sm text-red-400"
          }
        >
          {delta >= 0 ? "+" : ""}
          {delta} over {points.length} updates
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-28 w-full rounded-xl border border-white/[0.06] bg-black/20"
        role="img"
        aria-label={`Rating over time, from ${first.rating} to ${latest.rating}`}
      >
        <defs>
          <linearGradient id="rating-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={areaCoords} fill="url(#rating-fill)" />
        <polyline
          points={coords}
          fill="none"
          stroke="#16a34a"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          style={{ strokeWidth: 2 }}
        />
      </svg>
    </div>
  );
}
