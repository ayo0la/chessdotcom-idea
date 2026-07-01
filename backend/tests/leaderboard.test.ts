import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("../src/db", () => ({
  db: {
    user: { findUnique: vi.fn() },
    follow: { findMany: vi.fn() },
  },
}));
vi.mock("../src/middleware/requireSession", () => ({
  requireSession: (_req: any, _res: any, next: any) => next(),
}));

import { db } from "../src/db";
import leaderboardRouter from "../src/routes/leaderboard";

function buildApp(userId = "viewer1") {
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
  it("returns players ranked by rating descending with userId", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "viewer1",
      chesscomUsername: "gothamchess",
      claimed: true,
      createdAt: new Date(),
    } as any);
    vi.mocked(db.follow.findMany).mockResolvedValueOnce([
      {
        following: {
          id: "u1",
          chesscomUsername: "hikaru",
          ratings: [{ rating: 3100, wins: 500, losses: 100, draws: 50, timeControl: "blitz" }],
        },
      },
      {
        following: {
          id: "u2",
          chesscomUsername: "gothamchess",
          ratings: [{ rating: 2800, wins: 200, losses: 80, draws: 30, timeControl: "blitz" }],
        },
      },
    ] as any);

    const res = await request(buildApp()).get("/leaderboard?tc=blitz");

    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({ rank: 1, username: "hikaru", rating: 3100, userId: "u1" });
    expect(res.body[1]).toMatchObject({ rank: 2, username: "gothamchess", rating: 2800, userId: "u2" });
  });

  it("excludes followed players with no rating for the requested time control", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(null);
    vi.mocked(db.follow.findMany).mockResolvedValueOnce([
      { following: { id: "u1", chesscomUsername: "hikaru", ratings: [] } },
    ] as any);

    const res = await request(buildApp()).get("/leaderboard");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
