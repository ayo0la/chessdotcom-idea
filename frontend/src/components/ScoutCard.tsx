import { useEffect, useState } from "react";
import { getScout, type ScoutReport } from "../api.js";

interface ScoutCardProps {
  username: string;
}

export default function ScoutCard({ username }: ScoutCardProps) {
  const [report, setReport] = useState<ScoutReport | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setReport(null);
    setFailed(false);
    getScout(username)
      .then(setReport)
      .catch(() => setFailed(true));
  }, [username]);

  if (failed) return null;
  if (!report) return null;

  const { recentForm, weapons, weaknesses, style } = report;
  const streakText =
    recentForm.streak >= 2
      ? `on a ${recentForm.streak}-win streak`
      : recentForm.streak <= -2
        ? `on a ${-recentForm.streak}-loss streak`
        : null;

  return (
    <section className="mt-6 rounded-lg border border-gray-800 bg-gray-900/60 p-4">
      <h2 className="text-lg font-bold mb-1">Scouting Report</h2>
      <p className="text-sm text-gray-300 mb-4">
        {recentForm.wins}W-{recentForm.losses}L-{recentForm.draws}D in their
        last {recentForm.games} games
        {streakText && (
          <span
            className={
              recentForm.streak > 0 ? "text-green-400" : "text-amber-400"
            }
          >
            {" "}
            · {streakText}
          </span>
        )}
      </p>

      {weaknesses.length > 0 && (
        <div className="mb-3">
          <h3 className="text-xs uppercase tracking-wide text-gray-500 mb-1.5">
            Target these openings
          </h3>
          <ul className="space-y-1">
            {weaknesses.map((o) => (
              <li key={o.eco} className="text-sm flex justify-between gap-2">
                <span className="text-gray-200 truncate">{o.name}</span>
                <span className="text-red-400 whitespace-nowrap">
                  {o.winRate}% · {o.games} games
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {weapons.length > 0 && (
        <div className="mb-3">
          <h3 className="text-xs uppercase tracking-wide text-gray-500 mb-1.5">
            Avoid their weapons
          </h3>
          <ul className="space-y-1">
            {weapons.map((o) => (
              <li key={o.eco} className="text-sm flex justify-between gap-2">
                <span className="text-gray-200 truncate">{o.name}</span>
                <span className="text-green-400 whitespace-nowrap">
                  {o.winRate}% · {o.games} games
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {style && (
        <div className="flex flex-wrap gap-2 mt-2">
          {[style.labels.style, style.labels.approach, style.labels.clock].map(
            (label) => (
              <span
                key={label}
                className="text-xs font-medium px-2 py-0.5 rounded-full border border-gray-700 text-gray-300"
              >
                {label}
              </span>
            )
          )}
        </div>
      )}
    </section>
  );
}
