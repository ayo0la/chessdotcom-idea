import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase.js";

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
    <main className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-6 px-4">
      <h1 className="text-3xl font-bold text-white tracking-tight">Chess Rivals</h1>
      <p className="text-gray-400 text-sm text-center">
        Your Chess.com improvement coach. Tilt alerts, loss debriefs, opening DNA.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 w-full max-w-sm">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          className="bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          minLength={8}
          className="bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-green-600 hover:bg-green-500 text-white font-semibold py-2 rounded disabled:opacity-50"
        >
          {loading ? "One moment…" : mode === "signin" ? "Sign in" : "Sign up"}
        </button>
        {error && <p className="text-red-400 text-sm">{error}</p>}
      </form>
      {mode === "signin" ? (
        <p className="text-gray-500 text-sm">
          No account?{" "}
          <button
            onClick={() => setMode("signup")}
            className="text-green-400 hover:underline"
          >
            Create one
          </button>
        </p>
      ) : (
        <p className="text-gray-500 text-sm">
          Already have an account?{" "}
          <button
            onClick={() => setMode("signin")}
            className="text-green-400 hover:underline"
          >
            Sign in
          </button>
        </p>
      )}
    </main>
  );
}
