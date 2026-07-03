import type { MonthlyGame } from "../../chesscom.js";

const LOSS_RESULTS = new Set([
  "checkmated",
  "timeout",
  "resigned",
  "lose",
  "abandoned",
]);

export interface OpeningStat {
  eco: string;
  name: string;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
}

export interface OpeningDna {
  totalGames: number;
  openings: OpeningStat[];
}

function nameFromEcoUrl(pgn: string, eco: string): string {
  const match = pgn.match(/\[ECOUrl "[^"]*\/openings\/([^"]+)"\]/);
  if (!match) return eco;
  const words: string[] = [];
  for (const part of match[1].split("-")) {
    // move-list noise like "3...Nf6" or "4.e3" marks the end of the name
    if (/\d/.test(part)) break;
    words.push(part);
  }
  return words.join(" ") || eco;
}

export function computeOpeningDna(
  games: MonthlyGame[],
  username: string
): OpeningDna {
  const uname = username.toLowerCase();
  const byEco = new Map<string, OpeningStat>();
  let totalGames = 0;

  for (const game of games) {
    const ecoMatch = game.pgn?.match(/\[ECO "([^"]+)"\]/);
    if (!ecoMatch) continue;
    const eco = ecoMatch[1];
    totalGames++;

    const color =
      game.white.username.toLowerCase() === uname ? "white" : "black";
    const result = game[color].result;

    let stat = byEco.get(eco);
    if (!stat) {
      stat = {
        eco,
        name: nameFromEcoUrl(game.pgn!, eco),
        games: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        winRate: 0,
      };
      byEco.set(eco, stat);
    }

    stat.games++;
    if (result === "win") stat.wins++;
    else if (LOSS_RESULTS.has(result)) stat.losses++;
    else stat.draws++;
  }

  const openings = [...byEco.values()]
    .map((s) => ({ ...s, winRate: Math.round((s.wins / s.games) * 100) }))
    .sort((a, b) => b.games - a.games);

  return { totalGames, openings };
}
