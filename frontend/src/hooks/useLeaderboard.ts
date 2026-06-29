import { useState, useEffect, useCallback } from "react";
import { getLeaderboard, type LeaderboardEntry } from "../api";
import type { TimeControl } from "../components/TimeControlTabs";

export function useLeaderboard(tc: TimeControl) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getLeaderboard(tc)
      .then(setEntries)
      .finally(() => setLoading(false));
  }, [tc]);

  const update = useCallback((username: string, rating: number) => {
    setEntries((prev) =>
      prev
        .map((e) => (e.username === username ? { ...e, rating } : e))
        .sort((a, b) => b.rating - a.rating)
        .map((e, i) => ({ ...e, rank: i + 1 }))
    );
  }, []);

  const remove = useCallback((username: string) => {
    setEntries((prev) =>
      prev
        .filter((e) => e.username !== username)
        .map((e, i) => ({ ...e, rank: i + 1 }))
    );
  }, []);

  return { entries, loading, update, remove };
}
