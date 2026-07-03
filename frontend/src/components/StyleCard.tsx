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
    <section className="mt-10 rounded-lg border border-gray-800 bg-gray-900/60 p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">Play Style</h2>
        <span className="text-gray-500 text-xs">
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
                active ? "text-green-400 font-semibold" : "text-gray-500"
              }
            >
              {text}
            </span>
          );
          return (
            <li key={axis.key}>
              <div className="flex justify-between text-xs mb-1.5">
                {pole(axis.low, !highActive)}
                {pole(axis.high, highActive)}
              </div>
              <div className="relative h-2 rounded-full bg-gray-800">
                <div
                  role="meter"
                  aria-label={`${axis.label}: ${axis.low} to ${axis.high}`}
                  aria-valuenow={value}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full bg-green-600 ring-2 ring-gray-950"
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
