import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("../src/services/analysis/pgn-fetcher", () => ({
  fetchRecentGames: vi.fn(),
  clearGamesCache: vi.fn(),
}));
vi.mock("../src/services/claude", () => ({
  claudeEnabled: vi.fn(),
  generateText: vi.fn(),
}));
vi.mock("../src/db", () => ({
  db: {
    user: { findUnique: vi.fn() },
  },
}));
vi.mock("../src/chesscom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/chesscom")>();
  return { ...actual, fetchPlayerRatings: vi.fn() };
});

import type { MonthlyGame } from "../src/chesscom";
import { fetchRecentGames } from "../src/services/analysis/pgn-fetcher";
import { claudeEnabled, generateText } from "../src/services/claude";
import { db } from "../src/db";
import playersRouter from "../src/routes/players";
import analysisRouter from "../src/routes/analysis";

function makeGame(eco: string, result: string, username = "hikaru"): MonthlyGame {
  return {
    url: "u",
    pgn: `[ECO "${eco}"]\n[ECOUrl "https://www.chess.com/openings/Some-Opening"]\n\n1. e4 1-0`,
    time_control: "180",
    time_class: "blitz",
    end_time: 1,
    white: { username, result, rating: 1500 },
    black: { username: "opp", result: result === "win" ? "resigned" : "win", rating: 1500 },
  };
}

function buildApp(userId?: string) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).session = { userId };
    next();
  });
  app.use("/players", playersRouter);
  app.use("/analysis", analysisRouter);
  return app;
}

beforeEach(() => vi.clearAllMocks());

describe("GET /players/:username/openings", () => {
  it("returns aggregated opening stats for a player", async () => {
    vi.mocked(fetchRecentGames).mockResolvedValueOnce([
      makeGame("B20", "win"),
      makeGame("B20", "resigned"),
      makeGame("C50", "win"),
    ]);

    const res = await request(buildApp()).get("/players/Hikaru/openings");

    expect(res.status).toBe(200);
    expect(fetchRecentGames).toHaveBeenCalledWith("hikaru");
    expect(res.body.totalGames).toBe(3);
    expect(res.body.openings[0]).toMatchObject({ eco: "B20", games: 2 });
  });

  it("caps the response at the top 10 openings", async () => {
    const many = Array.from({ length: 15 }, (_, i) =>
      makeGame(`A${String(i).padStart(2, "0")}`, "win")
    );
    vi.mocked(fetchRecentGames).mockResolvedValueOnce(many);

    const res = await request(buildApp()).get("/players/hikaru/openings");

    expect(res.body.openings).toHaveLength(10);
  });

  it("returns 502 when game history cannot be fetched", async () => {
    vi.mocked(fetchRecentGames).mockRejectedValueOnce(new Error("chess.com down"));

    const res = await request(buildApp()).get("/players/hikaru/openings");

    expect(res.status).toBe(502);
  });
});

describe("POST /analysis/compare", () => {
  const me = { id: "user1", chesscomUsername: "testuser" };

  it("requires a session", async () => {
    const res = await request(buildApp(undefined))
      .post("/analysis/compare")
      .send({ username: "hikaru" });
    expect(res.status).toBe(401);
  });

  it("returns a Claude-generated narrative comparing both players", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValueOnce(me as any);
    vi.mocked(claudeEnabled).mockReturnValue(true);
    vi.mocked(fetchRecentGames)
      .mockResolvedValueOnce([makeGame("B20", "win", "testuser")])
      .mockResolvedValueOnce([makeGame("C50", "win", "hikaru")]);
    vi.mocked(generateText).mockResolvedValueOnce("You are a Sicilian player...");

    const res = await request(buildApp("user1"))
      .post("/analysis/compare")
      .send({ username: "hikaru" });

    expect(res.status).toBe(200);
    expect(res.body.narrative).toBe("You are a Sicilian player...");
    const prompt = vi.mocked(generateText).mock.calls[0][0];
    expect(prompt).toContain("testuser");
    expect(prompt).toContain("hikaru");
  });

  it("returns 503 when the Claude API is not configured", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValueOnce(me as any);
    vi.mocked(claudeEnabled).mockReturnValue(false);

    const res = await request(buildApp("user1"))
      .post("/analysis/compare")
      .send({ username: "hikaru" });

    expect(res.status).toBe(503);
  });

  it("rejects a missing username", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValueOnce(me as any);

    const res = await request(buildApp("user1")).post("/analysis/compare").send({});

    expect(res.status).toBe(400);
  });
});
