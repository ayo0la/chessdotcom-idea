import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase.js";
import { getAccountStatus, linkUsername, verifyUsername } from "../api.js";

export default function LinkAccount() {
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState(false);
  const [username, setUsername] = useState("");
  const [pending, setPending] = useState<{ username: string; code: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getAccountStatus()
      .then((status) => {
        if (status.user) {
          navigate("/dashboard");
          return;
        }
        setPending(status.pending);
        setLoaded(true);
      })
      .catch(() => navigate("/"));
  }, [navigate]);

  async function handleLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await linkUsername(username.trim());
      setPending(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start verification");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify() {
    setError(null);
    setBusy(true);
    try {
      await verifyUsername();
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate("/");
  }

  if (!loaded) {
    return (
      <main className="page-shell flex items-center justify-center">
        <p className="text-sm text-gray-500">Loading…</p>
      </main>
    );
  }

  return (
    <main className="page-shell flex flex-col items-center justify-center gap-6 px-4 py-12">
      <div className="w-full max-w-sm animate-rise">
        <p className="kicker mb-2 text-center">One-time setup</p>
        <h1 className="mb-6 text-center font-display text-2xl font-bold text-white">
          Link your Chess.com account
        </h1>

        {!pending ? (
          <div className="card p-5">
            <p className="mb-4 text-sm leading-relaxed text-gray-400">
              Prove the account is yours so nobody else can claim it. Enter your
              Chess.com username to get a verification code.
            </p>
            <form onSubmit={handleLink} className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="Chess.com username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input-field"
                required
              />
              <button type="submit" disabled={busy} className="btn-primary py-2.5">
                {busy ? "Checking…" : "Get code"}
              </button>
            </form>
          </div>
        ) : (
          <div className="card flex flex-col gap-4 p-5">
            <p className="text-sm text-gray-300">
              Verifying <span className="font-semibold text-white">{pending.username}</span>
            </p>
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-center">
              <span className="font-mono text-xl font-semibold tracking-widest text-emerald-300">
                {pending.code}
              </span>
            </div>
            <ol className="list-inside list-decimal space-y-2 text-sm leading-relaxed text-gray-400">
              <li>Copy the code above.</li>
              <li>
                Open your{" "}
                <a
                  href="https://www.chess.com/settings/profile"
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-400 hover:underline"
                >
                  Chess.com profile settings
                </a>{" "}
                and paste it into the <span className="text-gray-200">Location</span>{" "}
                field, then save.
              </li>
              <li>Come back and hit Verify. You can remove the code afterwards.</li>
            </ol>
            <button onClick={handleVerify} disabled={busy} className="btn-primary py-2.5">
              {busy ? "Verifying…" : "Verify"}
            </button>
            <button
              onClick={() => setPending(null)}
              className="text-sm text-gray-500 transition-colors hover:text-gray-300"
            >
              Use a different username
            </button>
          </div>
        )}

        {error && (
          <p className="mt-4 text-center text-sm text-red-400">{error}</p>
        )}
        <div className="mt-6 text-center">
          <button
            onClick={handleSignOut}
            className="text-xs text-gray-600 transition-colors hover:text-gray-400"
          >
            Sign out
          </button>
        </div>
      </div>
    </main>
  );
}
