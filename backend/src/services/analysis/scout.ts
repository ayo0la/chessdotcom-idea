import type { MonthlyGame } from "../../chesscom.js";

const LOSS_RESULTS = new Set([
  "checkmated",
  "timeout",
  "resigned",
  "lose",
  "abandoned",
]);

export interface RecentForm {
  games: number;
  wins: number;
  losses: number;
  draws: number;
  streak: number; // consecutive wins (+) or losses (-) counting back from the latest game
}

type Outcome = "win" | "loss" | "draw";

function outcomeFor(game: MonthlyGame, uname: string): Outcome {
  const color = game.white.username.toLowerCase() === uname ? "white" : "black";
  const result = game[color].result;
  if (result === "win") return "win";
  if (LOSS_RESULTS.has(result)) return "loss";
  return "draw";
}

export function computeRecentForm(
  games: MonthlyGame[],
  username: string,
  n = 20
): RecentForm {
  const uname = username.toLowerCase();
  const recent = [...games].sort((a, b) => b.end_time - a.end_time).slice(0, n);
  const outcomes = recent.map((g) => outcomeFor(g, uname));

  const wins = outcomes.filter((o) => o === "win").length;
  const losses = outcomes.filter((o) => o === "loss").length;
  const draws = outcomes.filter((o) => o === "draw").length;

  let streak = 0;
  if (outcomes.length > 0 && outcomes[0] !== "draw") {
    const kind = outcomes[0];
    for (const o of outcomes) {
      if (o !== kind) break;
      streak++;
    }
    if (kind === "loss") streak = -streak;
  }

  return { games: outcomes.length, wins, losses, draws, streak };
}
