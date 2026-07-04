import { supabase } from "./lib/supabase.js";

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "/api";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      message = (JSON.parse(text) as { error?: string }).error ?? text;
    } catch {
      // not JSON; keep raw text
    }
    throw new ApiError(res.status, message);
  }
  return res.json() as Promise<T>;
}

export interface UserSession {
  userId: string;
  chesscomUsername: string;
}

export interface AccountStatus {
  user: UserSession | null;
  pending: { username: string; code: string } | null;
}

export function getAccountStatus(): Promise<AccountStatus> {
  return apiFetch("/account/status");
}

export function linkUsername(
  username: string
): Promise<{ username: string; code: string }> {
  return apiFetch("/account/link", {
    method: "POST",
    body: JSON.stringify({ username }),
  });
}

export function verifyUsername(): Promise<UserSession> {
  return apiFetch("/account/verify", { method: "POST" });
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
  isMe: boolean;
}

export interface TiltWarning {
  lossCount: number;
  rushing: boolean;
  suggestion: string;
  createdAt?: string;
}

export function getMe(): Promise<UserSession> {
  return apiFetch("/me");
}

export interface RatingPoint {
  rating: number;
  at: string;
}

export function getRatingHistory(tc: string): Promise<RatingPoint[]> {
  return apiFetch(`/me/rating-history?tc=${tc}`);
}

export function getTiltStatus(): Promise<TiltWarning | null> {
  return apiFetch("/me/tilt");
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

export interface OpeningStat {
  eco: string;
  name: string;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
}

export interface OpeningDnaResponse {
  username: string;
  totalGames: number;
  openings: OpeningStat[];
}

export function getOpenings(username: string): Promise<OpeningDnaResponse> {
  return apiFetch(`/players/${username}/openings`);
}

export interface StyleProfile {
  tactical: number;
  aggressive: number;
  timeManagement: number;
  labels: {
    style: "Tactical" | "Positional";
    approach: "Aggressive" | "Defensive";
    clock: "Time Manager" | "Scrambler";
  };
  gamesAnalyzed: number;
}

export function getStyleProfile(username: string): Promise<StyleProfile> {
  return apiFetch(`/players/${username}/style`);
}

export function compareOpenings(username: string): Promise<{ narrative: string }> {
  return apiFetch("/analysis/compare", {
    method: "POST",
    body: JSON.stringify({ username }),
  });
}

export interface DebriefPromptInfo {
  id: string;
  gameId: string;
  gameUrl: string;
}

export interface DebriefAnswers {
  opening: string;
  phase: string;
  losingMoment: string;
  cause: string;
  hadPlan: string;
  tooFast: string;
  emotion: string;
  nextTime: string;
}

export interface DebriefSummary {
  count: number;
  streak: number;
  narrative: string | null;
}

export function getDebriefPrompt(): Promise<DebriefPromptInfo | null> {
  return apiFetch("/me/debrief-prompt");
}

export async function submitDebrief(
  gameId: string,
  answers: DebriefAnswers
): Promise<void> {
  await apiFetch("/me/debriefs", {
    method: "POST",
    body: JSON.stringify({ gameId, answers }),
  });
}

export function getDebriefSummary(narrative = false): Promise<DebriefSummary> {
  return apiFetch(`/me/debriefs/summary${narrative ? "?narrative=1" : ""}`);
}
