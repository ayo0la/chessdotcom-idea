import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("../src/chesscom", () => ({
  fetchPlayerExists: vi.fn(),
  fetchPlayerRatings: vi.fn(),
}));
vi.mock("../src/db", () => ({
  db: {
    user: { upsert: vi.fn() },
    follow: { create: vi.fn(), delete: vi.fn() },
    rating: { upsert: vi.fn() },
  },
}));
vi.mock("../src/redis", () => ({
  redis: { zadd: vi.fn(), zrem: vi.fn() },
}));
vi.mock("../src/middleware/requireSession", () => ({
  requireSession: (_req: any, _res: any, next: any) => next(),
}));

import { fetchPlayerExists, fetchPlayerRatings } from "../src/chesscom";
import { db } from "../src/db";
import { redis } from "../src/redis";
import followsRouter from "../src/routes/follows";

function buildApp(userId = "viewer1") {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).session = { userId };
    next();
  });
  app.use("/follows", followsRouter);
  return app;
}

beforeEach(() => vi.clearAllMocks());

describe("POST /follows/:username", () => {
  it("returns 404 when target does not exist on Chess.com", async () => {
    vi.mocked(fetchPlayerExists).mockResolvedValueOnce(false);
    const res = await request(buildApp()).post("/follows/nobody");
    expect(res.status).toBe(404);
  });

  it("creates follow, seeds ratings, updates Redis Sorted Sets", async () => {
    vi.mocked(fetchPlayerExists).mockResolvedValueOnce(true);
    vi.mocked(fetchPlayerRatings).mockResolvedValueOnce([
      { timeControl: "blitz", rating: 3100, wins: 500, losses: 100, draws: 50 },
    ]);
    vi.mocked(db.user.upsert).mockResolvedValueOnce({
      id: "target1",
      chesscomUsername: "hikaru",
      claimed: false,
      createdAt: new Date(),
    } as any);
    vi.mocked(db.follow.create).mockResolvedValueOnce({} as any);
    vi.mocked(db.rating.upsert).mockResolvedValueOnce({} as any);

    const res = await request(buildApp()).post("/follows/hikaru");

    expect(res.status).toBe(201);
    expect(db.follow.create).toHaveBeenCalledWith({
      data: { followerId: "viewer1", followingId: "target1" },
    });
    expect(redis.zadd).toHaveBeenCalledWith(
      "leaderboard:viewer1:blitz",
      3100,
      "hikaru"
    );
  });
});

describe("DELETE /follows/:username", () => {
  it("deletes the follow relationship", async () => {
    vi.mocked(db.user.upsert).mockResolvedValueOnce({
      id: "target1",
      chesscomUsername: "hikaru",
      claimed: false,
      createdAt: new Date(),
    } as any);
    vi.mocked(db.follow.delete).mockResolvedValueOnce({} as any);

    const res = await request(buildApp()).delete("/follows/hikaru");
    expect(res.status).toBe(204);
  });
});
