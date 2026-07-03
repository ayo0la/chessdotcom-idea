import { db } from "../../db.js";
import { fetchMonthlyGames, type MonthlyGame } from "../../chesscom.js";

const TILT_WINDOW_MS = 45 * 60 * 1000;
const TILT_LOSS_THRESHOLD = 2;

const LOSS_RESULTS = new Set([
  "checkmated",
  "timeout",
  "resigned",
  "lose",
  "abandoned",
]);

export interface TiltAnalysis {
  tilting: boolean;
  lossCount: number;
  rushing: boolean;
  suggestion: string;
}

export interface TiltUser {
  id: string;
  chesscomUsername: string;
}

export function avgSecondsPerMove(
  pgn: string,
  color: "white" | "black"
): number | null {
  const tc = pgn.match(/\[TimeControl "(\d+)(?:\+(\d+))?"\]/);
  if (!tc) return null;
  const base = parseInt(tc[1], 10);
  const increment = tc[2] ? parseInt(tc[2], 10) : 0;

  // %clk tags appear once per half-move; white owns the even indices
  const clocks = [...pgn.matchAll(/\[%clk (\d+):(\d+):(\d+(?:\.\d+)?)\]/g)].map(
    (m) => parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseFloat(m[3])
  );
  const mine = clocks.filter((_, i) =>
    color === "white" ? i % 2 === 0 : i % 2 === 1
  );
  if (mine.length === 0) return null;

  const timeUsed = base - mine[mine.length - 1] + increment * mine.length;
  return timeUsed / mine.length;
}

export function analyzeTilt(
  games: MonthlyGame[],
  username: string,
  now: Date = new Date()
): TiltAnalysis {
  const cutoff = now.getTime() - TILT_WINDOW_MS;
  const uname = username.toLowerCase();

  const recent = games
    .filter((g) => g.end_time * 1000 >= cutoff)
    .sort((a, b) => a.end_time - b.end_time)
    .map((game) => ({
      game,
      color:
        game.white.username.toLowerCase() === uname
          ? ("white" as const)
          : ("black" as const),
    }));

  const lossCount = recent.filter(({ game, color }) =>
    LOSS_RESULTS.has(game[color].result)
  ).length;

  const speeds = recent
    .map(({ game, color }) => (game.pgn ? avgSecondsPerMove(game.pgn, color) : null))
    .filter((s): s is number => s != null);
  const rushing =
    speeds.length >= 2 && speeds.every((s, i) => i === 0 || s < speeds[i - 1]);

  const suggestion = rushing
    ? `${lossCount} losses in under 45 minutes, and you're moving faster each game. Step away from the board for 15 minutes.`
    : `${lossCount} losses in under 45 minutes. Take a break before your next game.`;

  return { tilting: lossCount >= TILT_LOSS_THRESHOLD, lossCount, rushing, suggestion };
}

export async function checkTiltForUser(
  user: TiltUser,
  now: Date = new Date()
): Promise<void> {
  const windowStart = new Date(now.getTime() - TILT_WINDOW_MS);
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

  const analysis = analyzeTilt(games, user.chesscomUsername, now);
  if (!analysis.tilting) return;

  // The TiltEvent table doubles as dedupe state: one warning per window
  const existing = await db.tiltEvent.findFirst({
    where: { userId: user.id, createdAt: { gte: windowStart } },
  });
  if (existing) return;

  await db.tiltEvent.create({
    data: {
      userId: user.id,
      lossCount: analysis.lossCount,
      rushing: analysis.rushing,
      suggestion: analysis.suggestion,
    },
  });
}
