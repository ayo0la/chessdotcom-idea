import { describe, it, expect } from "vitest";
import type { MonthlyGame } from "../src/chesscom";
import { computeOpeningDna } from "../src/services/analysis/opening-dna";

function makeGame(opts: {
  eco?: string;
  ecoUrl?: string;
  result: string;
  color?: "white" | "black";
}): MonthlyGame {
  const color = opts.color ?? "white";
  const me = { username: "TestUser", result: opts.result, rating: 1500 };
  const opp = {
    username: "opponent",
    result: opts.result === "win" ? "resigned" : "win",
    rating: 1500,
  };
  const headers = [
    `[Event "Live Chess"]`,
    opts.eco ? `[ECO "${opts.eco}"]` : "",
    opts.ecoUrl ? `[ECOUrl "${opts.ecoUrl}"]` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return {
    url: "https://chess.com/game/1",
    pgn: `${headers}\n\n1. e4 e5 1-0`,
    time_control: "180",
    time_class: "blitz",
    end_time: 1,
    white: color === "white" ? me : opp,
    black: color === "black" ? me : opp,
  };
}

describe("computeOpeningDna", () => {
  it("aggregates wins, losses, and draws per ECO code", () => {
    const games = [
      makeGame({ eco: "B20", result: "win" }),
      makeGame({ eco: "B20", result: "checkmated" }),
      makeGame({ eco: "B20", result: "agreed" }),
      makeGame({ eco: "C50", result: "win" }),
    ];

    const dna = computeOpeningDna(games, "testuser");

    expect(dna.totalGames).toBe(4);
    const b20 = dna.openings.find((o) => o.eco === "B20");
    expect(b20).toMatchObject({ games: 3, wins: 1, losses: 1, draws: 1 });
  });

  it("computes win rate as a rounded percentage", () => {
    const games = [
      makeGame({ eco: "B20", result: "win" }),
      makeGame({ eco: "B20", result: "win" }),
      makeGame({ eco: "B20", result: "resigned" }),
    ];

    const dna = computeOpeningDna(games, "testuser");

    expect(dna.openings[0].winRate).toBe(67);
  });

  it("derives a readable opening name from the ECOUrl slug", () => {
    const games = [
      makeGame({
        eco: "B20",
        ecoUrl: "https://www.chess.com/openings/Sicilian-Defense-Bowdler-Attack",
        result: "win",
      }),
    ];

    const dna = computeOpeningDna(games, "testuser");

    expect(dna.openings[0].name).toBe("Sicilian Defense Bowdler Attack");
  });

  it("trims move-list noise from the ECOUrl slug", () => {
    const games = [
      makeGame({
        eco: "D02",
        ecoUrl:
          "https://www.chess.com/openings/Queens-Pawn-Opening-Accelerated-London-System-3...Nf6-4.e3",
        result: "win",
      }),
    ];

    const dna = computeOpeningDna(games, "testuser");

    expect(dna.openings[0].name).toBe(
      "Queens Pawn Opening Accelerated London System"
    );
  });

  it("sorts openings by games played, most first", () => {
    const games = [
      makeGame({ eco: "C50", result: "win" }),
      makeGame({ eco: "B20", result: "win" }),
      makeGame({ eco: "B20", result: "resigned" }),
    ];

    const dna = computeOpeningDna(games, "testuser");

    expect(dna.openings.map((o) => o.eco)).toEqual(["B20", "C50"]);
  });

  it("counts results correctly when the user played black", () => {
    const games = [
      makeGame({ eco: "B20", result: "win", color: "black" }),
      makeGame({ eco: "B20", result: "timeout", color: "black" }),
    ];

    const dna = computeOpeningDna(games, "testuser");

    expect(dna.openings[0]).toMatchObject({ wins: 1, losses: 1 });
  });

  it("skips games with no ECO header", () => {
    const games = [
      makeGame({ result: "win" }),
      makeGame({ eco: "B20", result: "win" }),
    ];

    const dna = computeOpeningDna(games, "testuser");

    expect(dna.totalGames).toBe(1);
    expect(dna.openings).toHaveLength(1);
  });
});
