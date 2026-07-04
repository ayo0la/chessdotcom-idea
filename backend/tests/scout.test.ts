import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("../src/services/analysis/pgn-fetcher", () => ({
  fetchRecentGames: vi.fn(),
  clearGamesCache: vi.fn(),
}));
vi.mock("../src/db", () => ({
  db: {
    user: { findUnique: vi.fn(), update: vi.fn() },
  },
}));
vi.mock("../src/chesscom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/chesscom")>();
  return { ...actual, fetchPlayerRatings: vi.fn() };
});

import type { MonthlyGame } from "../src/chesscom";
import { fetchRecentGames } from "../src/services/analysis/pgn-fetcher";
import { computeRecentForm } from "../src/services/analysis/scout";
import playersRouter from "../src/routes/players";

function makeGame(opts: {
  result: string;
  endTime?: number;
  eco?: string;
}): MonthlyGame {
  return {
    url: `u-${opts.endTime ?? 0}`,
    pgn: `[ECO "${opts.eco ?? "B20"}"]\n[ECOUrl "https://www.chess.com/openings/Some-Opening"]\n[TimeControl "180"]\n\n1. e4 e5 1-0`,
    time_control: "180",
    time_class: "blitz",
    end_time: opts.endTime ?? 0,
    white: { username: "scoutme", result: opts.result, rating: 1500 },
    black: {
      username: "opp",
      result: opts.result === "win" ? "resigned" : "win",
      rating: 1500,
    },
  };
}

function buildApp() {
  const app = express();
  app.use("/players", playersRouter);
  return app;
}

beforeEach(() => vi.clearAllMocks());

describe("computeRecentForm", () => {
  it("summarizes the last N games and detects a losing streak", () => {
    const games = [
      makeGame({ result: "win", endTime: 1 }),
      makeGame({ result: "win", endTime: 2 }),
      makeGame({ result: "checkmated", endTime: 3 }),
      makeGame({ result: "resigned", endTime: 4 }),
      makeGame({ result: "timeout", endTime: 5 }),
    ];
    const form = computeRecentForm(games, "scoutme", 20);

    expect(form).toMatchObject({ games: 5, wins: 2, losses: 3, draws: 0, streak: -3 });
  });

  it("reports a positive streak for consecutive wins", () => {
    const games = [
      makeGame({ result: "resigned", endTime: 1 }),
      makeGame({ result: "win", endTime: 2 }),
      makeGame({ result: "win", endTime: 3 }),
    ];
    expect(computeRecentForm(games, "scoutme", 20).streak).toBe(2);
  });

  it("only counts the most recent N games", () => {
    const games = Array.from({ length: 30 }, (_, i) =>
      makeGame({ result: i < 10 ? "checkmated" : "win", endTime: i })
    );
    const form = computeRecentForm(games, "scoutme", 20);
    expect(form.games).toBe(20);
    expect(form.wins).toBe(20);
  });
});

describe("GET /players/:username/scout", () => {
  it("returns form, weapons, weaknesses, and style", async () => {
    const games = [
      // 6 wins with B20, 6 losses with C50 -> weapon vs weakness
      ...Array.from({ length: 6 }, (_, i) =>
        makeGame({ result: "win", eco: "B20", endTime: 100 + i })
      ),
      ...Array.from({ length: 6 }, (_, i) =>
        makeGame({ result: "resigned", eco: "C50", endTime: 200 + i })
      ),
    ];
    vi.mocked(fetchRecentGames).mockResolvedValueOnce(games);

    const res = await request(buildApp()).get("/players/ScoutMe/scout");

    expect(res.status).toBe(200);
    expect(res.body.username).toBe("scoutme");
    expect(res.body.recentForm.games).toBe(12);
    expect(res.body.weapons[0]).toMatchObject({ eco: "B20", winRate: 100 });
    expect(res.body.weaknesses[0]).toMatchObject({ eco: "C50", winRate: 0 });
    expect(res.body.style.labels).toBeDefined();
  });

  it("ignores openings with fewer than 5 games for weapons and weaknesses", async () => {
    const games = [
      ...Array.from({ length: 5 }, (_, i) =>
        makeGame({ result: "win", eco: "B20", endTime: i })
      ),
      makeGame({ result: "resigned", eco: "A00", endTime: 50 }),
    ];
    vi.mocked(fetchRecentGames).mockResolvedValueOnce(games);

    const res = await request(buildApp()).get("/players/scoutme/scout");

    const ecos = [
      ...res.body.weapons.map((o: any) => o.eco),
      ...res.body.weaknesses.map((o: any) => o.eco),
    ];
    expect(ecos).not.toContain("A00");
  });

  it("returns 404 when the player has no recent games", async () => {
    vi.mocked(fetchRecentGames).mockResolvedValueOnce([]);
    const res = await request(buildApp()).get("/players/scoutme/scout");
    expect(res.status).toBe(404);
  });

  it("returns 502 when history cannot be fetched", async () => {
    vi.mocked(fetchRecentGames).mockRejectedValueOnce(new Error("down"));
    const res = await request(buildApp()).get("/players/scoutme/scout");
    expect(res.status).toBe(502);
  });
});
