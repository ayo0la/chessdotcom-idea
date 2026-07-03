import { db } from "../../db.js";
import { fetchMonthlyGames, type MonthlyGame } from "../../chesscom.js";

const LOSS_WINDOW_MS = 45 * 60 * 1000;

const LOSS_RESULTS = new Set([
  "checkmated",
  "timeout",
  "resigned",
  "lose",
  "abandoned",
]);

export interface DebriefUser {
  id: string;
  chesscomUsername: string;
}

function lostByUser(game: MonthlyGame, uname: string): boolean {
  const color = game.white.username.toLowerCase() === uname ? "white" : "black";
  return LOSS_RESULTS.has(game[color].result);
}

export async function promptDebriefForLatestLoss(
  user: DebriefUser,
  now: Date = new Date()
): Promise<void> {
  const windowStart = new Date(now.getTime() - LOSS_WINDOW_MS);
  const months: Array<[number, number]> = [
    [now.getUTCFullYear(), now.getUTCMonth() + 1],
  ];
  if (windowStart.getUTCMonth() !== now.getUTCMonth()) {
    months.push([windowStart.getUTCFullYear(), windowStart.getUTCMonth() + 1]);
  }

  const games = (
    await Promise.all(
      months.map(([y, m]) => fetchMonthlyGames(user.chesscomUsername, y, m))
    )
  ).flat();

  const uname = user.chesscomUsername.toLowerCase();
  const latestLoss = games
    .filter(
      (g) => g.end_time * 1000 >= windowStart.getTime() && lostByUser(g, uname)
    )
    .sort((a, b) => b.end_time - a.end_time)[0];
  if (!latestLoss) return;

  const existing = await db.debriefPrompt.findFirst({
    where: { userId: user.id, gameId: latestLoss.url },
  });
  if (existing) return;

  // The insert is broadcast to the client via Supabase Realtime
  await db.debriefPrompt.create({
    data: {
      userId: user.id,
      gameId: latestLoss.url,
      gameUrl: latestLoss.url,
    },
  });
}
