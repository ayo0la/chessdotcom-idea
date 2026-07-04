import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import TimeControlTabs, { type TimeControl } from "../components/TimeControlTabs";
import LeaderboardTable from "../components/LeaderboardTable";
import TiltBanner from "../components/TiltBanner";
import OpeningDNA from "../components/OpeningDNA";
import StyleCard from "../components/StyleCard";
import RatingChart from "../components/RatingChart";
import BlunderFingerprint from "../components/BlunderFingerprint";
import DebriefModal from "../components/DebriefModal";
import DebriefInsights from "../components/DebriefInsights";
import { useLeaderboard } from "../hooks/useLeaderboard";
import { useRealtime } from "../hooks/useRealtime";
import { supabase } from "../lib/supabase";
import {
  ApiError,
  getMe,
  getDebriefSummary,
  unfollowPlayer,
  type DebriefSummary,
  type UserSession,
} from "../api";

export default function Dashboard() {
  const navigate = useNavigate();
  const [tc, setTc] = useState<TimeControl>("blitz");
  const { entries, loading, update, remove } = useLeaderboard(tc);
  const [deltas, setDeltas] = useState<Record<string, number>>({});
  const [me, setMe] = useState<UserSession | null>(null);
  const [debriefSummary, setDebriefSummary] = useState<DebriefSummary | null>(null);

  useEffect(() => {
    getMe()
      .then(setMe)
      .catch((err) => {
        navigate(err instanceof ApiError && err.status === 403 ? "/link" : "/");
      });
  }, [navigate]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate("/");
  }

  useEffect(() => {
    if (!me) return;
    getDebriefSummary()
      .then(setDebriefSummary)
      .catch(() => {});
  }, [me]);

  function refreshDebriefSummary() {
    getDebriefSummary()
      .then(setDebriefSummary)
      .catch(() => {});
  }

  useRealtime(entries, tc, (ratingUpdate) => {
    update(ratingUpdate.username, ratingUpdate.rating);
    setDeltas((prev) => ({ ...prev, [ratingUpdate.username]: ratingUpdate.delta }));
    setTimeout(() => {
      setDeltas((prev) => {
        const next = { ...prev };
        delete next[ratingUpdate.username];
        return next;
      });
    }, 3000);
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
            <p className="text-gray-400 text-sm mt-1">
              Signed in as {me.chesscomUsername}
              {debriefSummary && debriefSummary.streak > 0 && (
                <span className="ml-2 text-amber-400">
                  🔥 {debriefSummary.streak}-day debrief streak
                </span>
              )}
            </p>
          )}
        </div>
        <div className="flex items-center gap-4">
          <Link to="/search" className="text-green-400 text-sm hover:underline">
            + Follow players
          </Link>
          <button
            onClick={handleSignOut}
            className="text-gray-500 text-sm hover:text-gray-300"
          >
            Sign out
          </button>
        </div>
      </div>
      {me && <TiltBanner userId={me.userId} />}
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
      {me && <RatingChart tc={tc} />}
      {me && <StyleCard username={me.chesscomUsername} />}
      {me && (
        <OpeningDNA
          me={me.chesscomUsername}
          friends={entries.filter((e) => !e.isMe).map((e) => e.username)}
        />
      )}
      {me && <BlunderFingerprint />}
      {debriefSummary && <DebriefInsights count={debriefSummary.count} />}
      {me && <DebriefModal userId={me.userId} onSubmitted={refreshDebriefSummary} />}
    </main>
  );
}
