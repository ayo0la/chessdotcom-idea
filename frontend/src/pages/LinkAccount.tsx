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
      <main className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Loading…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-6 px-4">
      <h1 className="text-2xl font-bold text-white">Link your Chess.com account</h1>
      {!pending ? (
        <>
          <p className="text-gray-400 text-sm max-w-sm text-center">
            Prove the account is yours so nobody else can claim it. Enter your
            Chess.com username to get a verification code.
          </p>
          <form onSubmit={handleLink} className="flex flex-col gap-3 w-full max-w-sm">
            <input
              type="text"
              placeholder="Chess.com username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
              required
            />
            <button
              type="submit"
              disabled={busy}
              className="bg-green-600 hover:bg-green-500 text-white font-semibold py-2 rounded disabled:opacity-50"
            >
              {busy ? "Checking…" : "Get code"}
            </button>
          </form>
        </>
      ) : (
        <div className="w-full max-w-sm flex flex-col gap-4">
          <p className="text-gray-300 text-sm">
            Verifying <span className="font-semibold">{pending.username}</span>:
          </p>
          <ol className="text-gray-400 text-sm list-decimal list-inside space-y-2">
            <li>
              Copy this code:{" "}
              <span className="font-mono text-green-400 text-base">{pending.code}</span>
            </li>
            <li>
              Open your{" "}
              <a
                href="https://www.chess.com/settings/profile"
                target="_blank"
                rel="noreferrer"
                className="text-green-400 hover:underline"
              >
                Chess.com profile settings
              </a>{" "}
              and paste it into the <span className="text-gray-200">Location</span>{" "}
              field, then save.
            </li>
            <li>Come back and hit Verify. You can remove the code afterwards.</li>
          </ol>
          <button
            onClick={handleVerify}
            disabled={busy}
            className="bg-green-600 hover:bg-green-500 text-white font-semibold py-2 rounded disabled:opacity-50"
          >
            {busy ? "Verifying…" : "Verify"}
          </button>
          <button
            onClick={() => setPending(null)}
            className="text-gray-500 text-sm hover:text-gray-300"
          >
            Use a different username
          </button>
        </div>
      )}
      {error && <p className="text-red-400 text-sm max-w-sm text-center">{error}</p>}
      <button onClick={handleSignOut} className="text-gray-600 text-xs hover:text-gray-400">
        Sign out
      </button>
    </main>
  );
}
