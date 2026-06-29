const BASE = "/api";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

export interface UserSession {
  userId: string;
  chesscomUsername: string;
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
  isMe: boolean;
}

export function claimUsername(username: string): Promise<UserSession> {
  return apiFetch("/auth/claim", {
    method: "POST",
    body: JSON.stringify({ username }),
  });
}

export function getMe(): Promise<UserSession> {
  return apiFetch("/me");
}

export function getLeaderboard(tc: string): Promise<LeaderboardEntry[]> {
  return apiFetch(`/leaderboard?tc=${tc}`);
}

export function followPlayer(username: string): Promise<void> {
  return apiFetch(`/follows/${username}`, { method: "POST" });
}

export function unfollowPlayer(username: string): Promise<void> {
  return apiFetch(`/follows/${username}`, { method: "DELETE" });
}

export function searchPlayer(username: string): Promise<{ username: string; ratings: Array<{ timeControl: string; rating: number }> }> {
  return apiFetch(`/players/${username}`);
}
