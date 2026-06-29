import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("../src/db", () => ({
  db: {
    user: { findUnique: vi.fn() },
    rating: { findMany: vi.fn() },
  },
}));
vi.mock("../src/redis", () => ({
  redis: { zrevrangebyscore: vi.fn() },
}));
vi.mock("../src/middleware/requireSession", () => ({
  requireSession: (_req: any, _res: any, next: any) => next(),
}));

import { db } from "../src/db";
import { redis } from "../src/redis";
import leaderboardRouter from "../src/routes/leaderboard";

function buildApp(userId = "viewer1", username = "gothamchess") {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).session = { userId };
    next();
  });
  app.use("/leaderboard", leaderboardRouter);
  return app;
}

beforeEach(() => vi.clearAllMocks());

describe("GET /leaderboard", () => {
  it("returns players ranked by rating descending", async () => {
    vi.mocked(redis.zrevrangebyscore).mockResolvedValueOnce([
      "hikaru", "3100",
      "gothamchess", "2800",
    ]);
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "viewer1",
      chesscomUsername: "gothamchess",
      claimed: true,
      createdAt: new Date(),
    } as any);
    vi.mocked(db.rating.findMany).mockResolvedValueOnce([
      { userId: "u1", timeControl: "blitz", rating: 3100, wins: 500, losses: 100, draws: 50, user: { chesscomUsername: "hikaru" } } as any,
      { userId: "u2", timeControl: "blitz", rating: 2800, wins: 200, losses: 80, draws: 30, user: { chesscomUsername: "gothamchess" } } as any,
    ]);

    const res = await request(buildApp()).get("/leaderboard?tc=blitz");

    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({ rank: 1, username: "hikaru", rating: 3100 });
    expect(res.body[1]).toMatchObject({ rank: 2, username: "gothamchess", rating: 2800 });
  });

  it("defaults to blitz when tc query param is absent", async () => {
    vi.mocked(redis.zrevrangebyscore).mockResolvedValueOnce([]);
    vi.mocked(db.user.findUnique).mockResolvedValue(null);
    vi.mocked(db.rating.findMany).mockResolvedValueOnce([]);

    await request(buildApp()).get("/leaderboard");

    expect(redis.zrevrangebyscore).toHaveBeenCalledWith(
      "leaderboard:viewer1:blitz",
      "+inf",
      "-inf",
      "WITHSCORES"
    );
  });
});
