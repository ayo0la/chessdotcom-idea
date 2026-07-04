import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase.js";

const FEATURES = [
  ["♞", "Opening DNA", "Win rates in every opening you play"],
  ["⚡", "Tilt alerts", "A warning before you burn rating"],
  ["🔬", "Blunder analysis", "Stockfish finds where you lose"],
] as const;

export default function Landing() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error } =
        mode === "signin"
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
        return;
      }
      navigate("/link");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page-shell flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm animate-rise">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-3xl shadow-glow-sm">
            ♞
          </div>
          <h1 className="font-display text-4xl font-bold tracking-tight text-white">
            Chess Rivals
          </h1>
          <p className="mt-2 text-sm text-gray-400">
            Your Chess.com improvement coach.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="card flex flex-col gap-3 p-5"
        >
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="input-field"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            minLength={8}
            className="input-field"
            required
          />
          <button type="submit" disabled={loading} className="btn-primary py-2.5">
            {loading ? "One moment…" : mode === "signin" ? "Sign in" : "Sign up"}
          </button>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </form>

        <p className="mt-4 text-center text-sm text-gray-500">
          {mode === "signin" ? (
            <>
              No account?{" "}
              <button
                onClick={() => setMode("signup")}
                className="font-medium text-emerald-400 transition-colors hover:text-emerald-300"
              >
                Create one
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                onClick={() => setMode("signin")}
                className="font-medium text-emerald-400 transition-colors hover:text-emerald-300"
              >
                Sign in
              </button>
            </>
          )}
        </p>

        <ul className="mt-10 space-y-3">
          {FEATURES.map(([icon, title, blurb]) => (
            <li key={title} className="flex items-center gap-3 text-sm">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04]">
                {icon}
              </span>
              <span>
                <span className="font-medium text-gray-200">{title}</span>
                <span className="text-gray-500"> — {blurb}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
