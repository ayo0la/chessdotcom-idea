import { fetchMonthlyGames, type MonthlyGame } from "../../chesscom.js";

const CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_MONTHS_BACK = 12;

const cache = new Map<string, { fetchedAt: number; games: MonthlyGame[] }>();

export function clearGamesCache(): void {
  cache.clear();
}

export async function fetchRecentGames(
  username: string,
  limit = 200,
  now: Date = new Date()
): Promise<MonthlyGame[]> {
  const key = username.toLowerCase();
  const hit = cache.get(key);
  if (hit && now.getTime() - hit.fetchedAt < CACHE_TTL_MS) return hit.games;

  const games: MonthlyGame[] = [];
  let year = now.getUTCFullYear();
  let month = now.getUTCMonth() + 1;

  for (let i = 0; i < MAX_MONTHS_BACK && games.length < limit; i++) {
    const monthly = await fetchMonthlyGames(username, year, month);
    // archives are oldest-first; newest games take priority
    games.push(...[...monthly].reverse());
    month--;
    if (month === 0) {
      month = 12;
      year--;
    }
  }

  const result = games.slice(0, limit);
  cache.set(key, { fetchedAt: now.getTime(), games: result });
  return result;
}
