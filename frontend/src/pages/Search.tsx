import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { searchPlayer, followPlayer } from "../api";
import ScoutCard from "../components/ScoutCard";

interface SearchResult {
  username: string;
  ratings: Array<{ timeControl: string; rating: number }>;
}

export default function Search() {
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get("u") ?? "");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [followed, setFollowed] = useState(false);
  const [searching, setSearching] = useState(false);

  async function runSearch(username: string) {
    setError(null);
    setResult(null);
    setFollowed(false);
    setSearching(true);
    try {
      const data = await searchPlayer(username);
      setResult(data);
    } catch {
      setError("Player not found on Chess.com.");
    } finally {
      setSearching(false);
    }
  }

  useEffect(() => {
    const preset = params.get("u");
    if (preset) void runSearch(preset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    await runSearch(query.trim());
  }

  async function handleFollow() {
    if (!result) return;
    await followPlayer(result.username);
    setFollowed(true);
  }

  return (
    <main className="page-shell mx-auto max-w-xl px-4 py-8 text-white">
      <div className="mb-6 flex items-center justify-between animate-rise">
        <div>
          <p className="kicker">Scout &amp; follow</p>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Find Players
          </h1>
        </div>
        <Link to="/dashboard" className="btn-ghost px-3 py-1.5 text-sm">
          ← Back
        </Link>
      </div>
      <form onSubmit={handleSearch} className="mb-6 flex gap-2 animate-rise">
        <input
          type="text"
          placeholder="Chess.com username"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="input-field flex-1"
          required
        />
        <button
          type="submit"
          disabled={searching}
          className="btn-primary px-5 py-2"
        >
          {searching ? "…" : "Search"}
        </button>
      </form>

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      {result && (
        <div className="card p-4 sm:p-5 animate-rise">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-display text-lg font-semibold">
              {result.username}
            </span>
            <button
              onClick={handleFollow}
              disabled={followed}
              className="btn-primary px-4 py-1.5 text-sm"
            >
              {followed ? "Following ✓" : "Follow"}
            </button>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            {result.ratings.map((r) => (
              <div key={r.timeControl} className="text-sm">
                <span className="capitalize text-gray-400">{r.timeControl}</span>{" "}
                <span className="font-semibold tabular-nums">{r.rating}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {result && <ScoutCard username={result.username} />}
    </main>
  );
}
