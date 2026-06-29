import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import TimeControlTabs, { type TimeControl } from "../components/TimeControlTabs";
import LeaderboardTable from "../components/LeaderboardTable";
import { useLeaderboard } from "../hooks/useLeaderboard";
import { useWebSocket } from "../hooks/useWebSocket";
import { getMe, unfollowPlayer, type UserSession } from "../api";

export default function Dashboard() {
  const navigate = useNavigate();
  const [tc, setTc] = useState<TimeControl>("blitz");
  const { entries, loading, update, remove } = useLeaderboard(tc);
  const [deltas, setDeltas] = useState<Record<string, number>>({});
  const [me, setMe] = useState<UserSession | null>(null);

  useEffect(() => {
    getMe()
      .then(setMe)
      .catch(() => navigate("/"));
  }, [navigate]);

  useWebSocket((msg) => {
    if (msg.type === "rating_update" && "timeControl" in msg && msg.timeControl === tc) {
      const m = msg as { type: string; timeControl: string; username: string; rating: number; delta: number };
      update(m.username, m.rating);
      setDeltas((prev) => ({ ...prev, [m.username]: m.delta }));
      setTimeout(() => {
        setDeltas((prev) => {
          const next = { ...prev };
          delete next[m.username];
          return next;
        });
      }, 3000);
    }
  });

  async function handleUnfollow(username: string) {
    await unfollowPlayer(username);
    remove(username);
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white px-4 py-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Leaderboard</h1>
          {me && (
            <p className="text-gray-400 text-sm mt-1">Signed in as {me.chesscomUsername}</p>
          )}
        </div>
        <Link to="/search" className="text-green-400 text-sm hover:underline">
          + Follow players
        </Link>
      </div>
      <TimeControlTabs active={tc} onChange={setTc} />
      {loading ? (
        <p className="text-gray-500 text-sm">Loading...</p>
      ) : entries.length === 0 ? (
        <p className="text-gray-500 text-sm">
          No players yet.{" "}
          <Link to="/search" className="text-green-400 hover:underline">
            Follow someone to get started.
          </Link>
        </p>
      ) : (
        <LeaderboardTable entries={entries} deltas={deltas} onUnfollow={handleUnfollow} />
      )}
    </main>
  );
}
