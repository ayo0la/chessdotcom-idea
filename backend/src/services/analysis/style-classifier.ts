import type { MonthlyGame } from "../../chesscom.js";

export interface StyleProfile {
  tactical: number; // 0-100, higher = more tactical
  aggressive: number; // 0-100, higher = more aggressive
  timeManagement: number; // 0-100, higher = better clock discipline
  labels: {
    style: "Tactical" | "Positional";
    approach: "Aggressive" | "Defensive";
    clock: "Time Manager" | "Scrambler";
  };
  gamesAnalyzed: number;
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

function movetext(pgn: string): string {
  const parts = pgn.split(/\n\s*\n/);
  return parts[parts.length - 1] ?? "";
}

function sanMoves(pgn: string): string[] {
  return movetext(pgn)
    .replace(/\{[^}]*\}/g, " ")
    .replace(/\d+\.(\.\.)?/g, " ")
    .split(/\s+/)
    .filter((t) => t && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t));
}

function myMoves(game: MonthlyGame, uname: string): string[] {
  const moves = sanMoves(game.pgn ?? "");
  const isWhite = game.white.username.toLowerCase() === uname;
  return moves.filter((_, i) => (isWhite ? i % 2 === 0 : i % 2 === 1));
}

function pawnAdvanceIntoOpponentHalf(move: string, isWhite: boolean): boolean {
  if (!/^[a-h]/.test(move)) return false; // pawn moves start with a file letter
  const dest = move.replace(/[+#]/g, "").replace(/=[QRBN]/g, "");
  const rank = parseInt(dest[dest.length - 1], 10);
  if (Number.isNaN(rank)) return false;
  return isWhite ? rank >= 5 : rank <= 4;
}

function remainingClockFraction(
  game: MonthlyGame,
  uname: string
): number | null {
  const pgn = game.pgn ?? "";
  const tc = pgn.match(/\[TimeControl "(\d+)(?:\+(\d+))?"\]/);
  if (!tc) return null;
  const base = parseInt(tc[1], 10);
  const clocks = [...pgn.matchAll(/\[%clk (\d+):(\d+):(\d+(?:\.\d+)?)\]/g)].map(
    (m) => parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseFloat(m[3])
  );
  const isWhite = game.white.username.toLowerCase() === uname;
  const mine = clocks.filter((_, i) => (isWhite ? i % 2 === 0 : i % 2 === 1));
  if (mine.length === 0 || base === 0) return null;
  return mine[mine.length - 1] / base;
}

export function computeStyleProfile(
  games: MonthlyGame[],
  username: string
): StyleProfile | null {
  const uname = username.toLowerCase();
  let moveCount = 0;
  let captureOrCheck = 0;
  let pawnAdvances = 0;
  const clockFractions: number[] = [];
  let gamesAnalyzed = 0;

  for (const game of games) {
    const moves = myMoves(game, uname);
    if (moves.length === 0) continue;
    gamesAnalyzed++;

    const isWhite = game.white.username.toLowerCase() === uname;
    for (const move of moves) {
      moveCount++;
      if (move.includes("x") || move.includes("+") || move.includes("#")) {
        captureOrCheck++;
      }
      if (pawnAdvanceIntoOpponentHalf(move, isWhite)) pawnAdvances++;
    }

    const fraction = remainingClockFraction(game, uname);
    if (fraction != null) clockFractions.push(fraction);
  }

  if (gamesAnalyzed === 0 || moveCount === 0) return null;

  const tactical = clamp((captureOrCheck / moveCount) * 400);
  const aggressive = clamp((pawnAdvances / moveCount) * 500);
  const avgRemaining =
    clockFractions.length > 0
      ? clockFractions.reduce((a, b) => a + b, 0) / clockFractions.length
      : 0.2; // no clock data: sit on the label boundary
  const timeManagement = clamp(avgRemaining * 250);

  return {
    tactical,
    aggressive,
    timeManagement,
    labels: {
      style: tactical >= 50 ? "Tactical" : "Positional",
      approach: aggressive >= 50 ? "Aggressive" : "Defensive",
      clock: timeManagement >= 50 ? "Time Manager" : "Scrambler",
    },
    gamesAnalyzed,
  };
}
