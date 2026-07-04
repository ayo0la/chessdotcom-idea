import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("../src/middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) =>
    req.userId ? next() : res.status(401).json({ error: "Unauthorized" }),
  requireLinkedUser: (_req: any, _res: any, next: any) => next(),
}));
vi.mock("../src/services/analysis/pgn-fetcher", () => ({
  fetchRecentGames: vi.fn(),
  clearGamesCache: vi.fn(),
}));
vi.mock("../src/db", () => ({
  db: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    tiltEvent: { findFirst: vi.fn() },
    ratingSnapshot: { findMany: vi.fn() },
  },
}));
vi.mock("../src/services/claude", () => ({
  claudeEnabled: vi.fn(),
  generateText: vi.fn(),
}));

import type { MonthlyGame } from "../src/chesscom";
import { fetchRecentGames } from "../src/services/analysis/pgn-fetcher";
import { db } from "../src/db";
import meRouter from "../src/routes/me";

function makeGame(opts: {
  result: string;
  endTime: number;
  color?: "white" | "black";
}): MonthlyGame {
  const color = opts.color ?? "white";
  const me = { username: "babayaro11", result: opts.result, rating: 500 };
  const opp = {
    username: "opp",
    result: opts.result === "win" ? "resigned" : "win",
    rating: 500,
  };
  return {
    url: `https://chess.com/game/${opts.endTime}`,
    pgn: `[TimeControl "180"]\n\n1. e4 e5 1-0`,
    time_control: "180",
    time_class: "blitz",
    end_time: opts.endTime,
    white: color === "white" ? me : opp,
    black: color === "black" ? me : opp,
  };
}

function buildApp(userId?: string) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).userId = userId;
    next();
  });
  app.use("/me", meRouter);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.user.findUnique).mockResolvedValue({
    id: "user1",
    chesscomUsername: "babayaro11",
  } as any);
});

describe("GET /me/losses", () => {
  it("returns only my most recent losses, newest first", async () => {
    vi.mocked(fetchRecentGames).mockResolvedValueOnce([
      makeGame({ result: "win", endTime: 4 }),
      makeGame({ result: "checkmated", endTime: 3 }),
      makeGame({ result: "resigned", endTime: 5, color: "black" }),
      makeGame({ result: "agreed", endTime: 6 }),
    ]);

    const res = await request(buildApp("user1")).get("/me/losses");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toMatchObject({
      gameId: "https://chess.com/game/5",
      color: "black",
    });
    expect(res.body[1]).toMatchObject({ gameId: "https://chess.com/game/3", color: "white" });
    expect(res.body[0].pgn).toContain("TimeControl");
  });

  it("caps the number of losses via the limit parameter", async () => {
    vi.mocked(fetchRecentGames).mockResolvedValueOnce(
      Array.from({ length: 20 }, (_, i) =>
        makeGame({ result: "checkmated", endTime: i })
      )
    );

    const res = await request(buildApp("user1")).get("/me/losses?limit=5");

    expect(res.body).toHaveLength(5);
  });

  it("requires auth", async () => {
    const res = await request(buildApp(undefined)).get("/me/losses");
    expect(res.status).toBe(401);
  });
});

describe("blunder fingerprint persistence", () => {
  const fingerprint = {
    gamesAnalyzed: 8,
    mistakes: 21,
    byType: { hanging: 9, "missed-win": 4, "time-scramble": 5, endgame: 2, mistake: 1 },
  };

  it("stores a computed fingerprint", async () => {
    vi.mocked(db.user.update).mockResolvedValueOnce({} as any);

    const res = await request(buildApp("user1"))
      .post("/me/fingerprint")
      .send({ fingerprint });

    expect(res.status).toBe(200);
    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user1" },
        data: expect.objectContaining({ blunderFingerprint: fingerprint }),
      })
    );
  });

  it("rejects an empty fingerprint", async () => {
    const res = await request(buildApp("user1")).post("/me/fingerprint").send({});
    expect(res.status).toBe(400);
  });

  it("returns the stored fingerprint", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValueOnce({
      id: "user1",
      chesscomUsername: "babayaro11",
      blunderFingerprint: fingerprint,
      fingerprintComputedAt: new Date("2026-07-04T00:00:00Z"),
    } as any);

    const res = await request(buildApp("user1")).get("/me/fingerprint");

    expect(res.status).toBe(200);
    expect(res.body.fingerprint).toMatchObject({ mistakes: 21 });
    expect(res.body.computedAt).toBeTruthy();
  });

  it("returns null when nothing is stored", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValueOnce({
      id: "user1",
      blunderFingerprint: null,
      fingerprintComputedAt: null,
    } as any);

    const res = await request(buildApp("user1")).get("/me/fingerprint");

    expect(res.body.fingerprint).toBeNull();
  });
});
