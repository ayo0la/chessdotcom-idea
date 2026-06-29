import { useState } from "react";
import { Link } from "react-router-dom";
import { searchPlayer, followPlayer } from "../api";

interface SearchResult {
  username: string;
  ratings: Array<{ timeControl: string; rating: number }>;
}

export default function Search() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [followed, setFollowed] = useState(false);
  const [searching, setSearching] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setFollowed(false);
    setSearching(true);
    try {
      const data = await searchPlayer(query.trim());
      setResult(data);
    } catch {
      setError("Player not found on Chess.com.");
    } finally {
      setSearching(false);
    }
  }

  async function handleFollow() {
    if (!result) return;
    await followPlayer(result.username);
    setFollowed(true);
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white px-4 py-8 max-w-xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Find Players</h1>
        <Link to="/dashboard" className="text-green-400 text-sm hover:underline">
          ← Back
        </Link>
      </div>
      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <input
          type="text"
          placeholder="Chess.com username"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
          required
        />
        <button
          type="submit"
          disabled={searching}
          className="bg-green-600 hover:bg-green-500 text-white font-semibold px-4 py-2 rounded disabled:opacity-50"
        >
          {searching ? "…" : "Search"}
        </button>
      </form>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {result && (
        <div className="bg-gray-900 rounded p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold text-lg">{result.username}</span>
            <button
              onClick={handleFollow}
              disabled={followed}
              className="bg-green-600 hover:bg-green-500 text-white text-sm font-medium px-3 py-1 rounded disabled:opacity-50"
            >
              {followed ? "Following ✓" : "Follow"}
            </button>
          </div>
          <div className="flex flex-wrap gap-3">
            {result.ratings.map((r) => (
              <div key={r.timeControl} className="text-sm">
                <span className="text-gray-400 capitalize">{r.timeControl}</span>{" "}
                <span className="font-medium">{r.rating}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
