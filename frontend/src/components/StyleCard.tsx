import { useEffect, useState } from "react";
import { getStyleProfile, type StyleProfile } from "../api.js";

interface StyleCardProps {
  username: string;
}

interface Axis {
  key: "tactical" | "aggressive" | "timeManagement";
  low: string;
  high: string;
  label: string;
}

const AXES: Axis[] = [
  { key: "tactical", low: "Positional", high: "Tactical", label: "Style" },
  { key: "aggressive", low: "Defensive", high: "Aggressive", label: "Approach" },
  { key: "timeManagement", low: "Scrambler", high: "Time Manager", label: "Clock" },
];

export default function StyleCard({ username }: StyleCardProps) {
  const [profile, setProfile] = useState<StyleProfile | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setProfile(null);
    setFailed(false);
    getStyleProfile(username)
      .then(setProfile)
      .catch(() => setFailed(true));
  }, [username]);

  if (failed || !profile) return null;

  return (
    <section className="card mt-6 p-4 sm:p-5 animate-rise">
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <p className="kicker">How you play</p>
          <h2 className="font-display text-lg font-bold">Play Style</h2>
        </div>
        <span className="text-xs text-gray-500">
          {profile.gamesAnalyzed} games analyzed
        </span>
      </div>
      <ul className="space-y-4">
        {AXES.map((axis) => {
          const value = profile[axis.key];
          const highActive = value >= 50;
          const pole = (text: string, active: boolean) => (
            <span
              data-active={active || undefined}
              className={
                active ? "font-semibold text-emerald-400" : "text-gray-500"
              }
            >
              {text}
            </span>
          );
          return (
            <li key={axis.key}>
              <div className="mb-1.5 flex justify-between text-xs">
                {pole(axis.low, !highActive)}
                {pole(axis.high, highActive)}
              </div>
              <div className="relative h-2 rounded-full bg-white/[0.06]">
                <div
                  role="meter"
                  aria-label={`${axis.label}: ${axis.low} to ${axis.high}`}
                  aria-valuenow={value}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-gradient-to-b from-emerald-400 to-emerald-600 shadow-glow-sm ring-2 ring-black/60 transition-all duration-700 ease-swift"
                  style={{ left: `calc(${value}% - 7px)` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
