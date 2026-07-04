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
import { db } from "../src/db";
import playersRouter from "../src/routes/players";

const cachedProfile = {
  tactical: 80,
  aggressive: 60,
  timeManagement: 40,
  labels: { style: "Tactical", approach: "Aggressive", clock: "Scrambler" },
  gamesAnalyzed: 100,
};

function makeGame(): MonthlyGame {
  return {
    url: "u",
    pgn: `[TimeControl "180"]\n\n1. exd5+ e5 2. Qxd5 d6 1-0`,
    time_control: "180",
    time_class: "blitz",
    end_time: 1,
    white: { username: "hikaru", result: "win", rating: 1500 },
    black: { username: "opp", result: "resigned", rating: 1500 },
  };
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).userId = "user1";
    next();
  });
  app.use("/players", playersRouter);
  return app;
}

beforeEach(() => vi.clearAllMocks());

describe("GET /players/:username/style", () => {
  it("returns the stored profile when it is fresh", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValueOnce({
      id: "user1",
      chesscomUsername: "hikaru",
      styleProfile: cachedProfile,
      styleComputedAt: new Date(),
    } as any);

    const res = await request(buildApp()).get("/players/hikaru/style");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ tactical: 80 });
    expect(fetchRecentGames).not.toHaveBeenCalled();
  });

  it("computes and persists the profile when none is stored", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValueOnce({
      id: "user1",
      chesscomUsername: "hikaru",
      styleProfile: null,
      styleComputedAt: null,
    } as any);
    vi.mocked(fetchRecentGames).mockResolvedValueOnce([makeGame()]);
    vi.mocked(db.user.update).mockResolvedValueOnce({} as any);

    const res = await request(buildApp()).get("/players/hikaru/style");

    expect(res.status).toBe(200);
    expect(res.body.labels).toBeDefined();
    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "user1" } })
    );
  });

  it("recomputes when the stored profile is stale", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValueOnce({
      id: "user1",
      chesscomUsername: "hikaru",
      styleProfile: cachedProfile,
      styleComputedAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
    } as any);
    vi.mocked(fetchRecentGames).mockResolvedValueOnce([makeGame()]);
    vi.mocked(db.user.update).mockResolvedValueOnce({} as any);

    const res = await request(buildApp()).get("/players/hikaru/style");

    expect(res.status).toBe(200);
    expect(fetchRecentGames).toHaveBeenCalled();
  });

  it("works for players not registered in the app", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValueOnce(null);
    vi.mocked(fetchRecentGames).mockResolvedValueOnce([makeGame()]);

    const res = await request(buildApp()).get("/players/hikaru/style");

    expect(res.status).toBe(200);
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("returns 404 when there are no games to analyze", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValueOnce(null);
    vi.mocked(fetchRecentGames).mockResolvedValueOnce([]);

    const res = await request(buildApp()).get("/players/hikaru/style");

    expect(res.status).toBe(404);
  });

  it("returns 502 when game history cannot be fetched", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValueOnce(null);
    vi.mocked(fetchRecentGames).mockRejectedValueOnce(new Error("down"));

    const res = await request(buildApp()).get("/players/hikaru/style");

    expect(res.status).toBe(502);
  });
});
