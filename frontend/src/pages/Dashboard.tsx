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
    <main className="page-shell mx-auto max-w-3xl px-4 py-8 text-white">
      <header className="mb-8 flex items-start justify-between gap-4 animate-rise">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xl shadow-glow-sm">
              ♞
            </span>
            <h1 className="font-display text-2xl font-bold tracking-tight">
              Chess Rivals
            </h1>
          </div>
          {me && (
            <p className="mt-2 text-sm text-gray-400">
              Signed in as{" "}
              <span className="font-medium text-gray-200">{me.chesscomUsername}</span>
              {debriefSummary && debriefSummary.streak > 0 && (
                <span className="ml-2 text-amber-400">
                  🔥 {debriefSummary.streak}-day debrief streak
                </span>
              )}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link to="/search" className="btn-ghost px-3 py-1.5 text-sm">
            + Follow players
          </Link>
          <button
            onClick={handleSignOut}
            className="px-2 py-1.5 text-sm text-gray-500 transition-colors hover:text-gray-300"
          >
            Sign out
          </button>
        </div>
      </header>
      {me && <TiltBanner userId={me.userId} />}
      <section className="card p-4 sm:p-5 animate-rise">
        <p className="kicker mb-3">Friends Leaderboard</p>
        <TimeControlTabs active={tc} onChange={setTc} />
        {loading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-gray-500">
            No players yet.{" "}
            <Link to="/search" className="text-emerald-400 hover:underline">
              Follow someone to get started.
            </Link>
          </p>
        ) : (
          <LeaderboardTable entries={entries} deltas={deltas} onUnfollow={handleUnfollow} />
        )}
      </section>
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
