import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("../src/chesscom", () => ({
  fetchPlayerExists: vi.fn(),
  fetchPlayerRatings: vi.fn(),
}));
vi.mock("../src/db", () => ({
  db: {
    user: { upsert: vi.fn(), findUnique: vi.fn() },
    follow: { upsert: vi.fn(), delete: vi.fn() },
    rating: { upsert: vi.fn() },
  },
}));
vi.mock("../src/redis", () => ({
  redis: { zadd: vi.fn(), zrem: vi.fn() },
}));
vi.mock("../src/middleware/requireSession", () => ({
  requireSession: (_req: any, _res: any, next: any) => next(),
}));
vi.mock("../src/connections", () => ({
  getConnection: vi.fn().mockReturnValue(undefined),
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

  it("creates follow (upsert), seeds ratings, updates Redis Sorted Sets", async () => {
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
    vi.mocked(db.follow.upsert).mockResolvedValueOnce({} as any);
    vi.mocked(db.rating.upsert).mockResolvedValueOnce({} as any);
    // viewer lookup for friend_joined notification
    vi.mocked(db.user.findUnique).mockResolvedValueOnce({
      id: "viewer1",
      chesscomUsername: "viewer",
      claimed: true,
      createdAt: new Date(),
    } as any);

    const res = await request(buildApp()).post("/follows/hikaru");

    expect(res.status).toBe(201);
    expect(db.follow.upsert).toHaveBeenCalledWith({
      where: { followerId_followingId: { followerId: "viewer1", followingId: "target1" } },
      update: {},
      create: { followerId: "viewer1", followingId: "target1" },
    });
    expect(redis.zadd).toHaveBeenCalledWith(
      "leaderboard:viewer1:blitz",
      3100,
      "hikaru"
    );
  });

  it("returns 201 on duplicate follow (idempotent)", async () => {
    vi.mocked(fetchPlayerExists).mockResolvedValueOnce(true);
    vi.mocked(fetchPlayerRatings).mockResolvedValueOnce([]);
    vi.mocked(db.user.upsert).mockResolvedValueOnce({
      id: "target1",
      chesscomUsername: "hikaru",
      claimed: false,
      createdAt: new Date(),
    } as any);
    vi.mocked(db.follow.upsert).mockResolvedValueOnce({} as any);
    vi.mocked(db.user.findUnique).mockResolvedValueOnce(null);

    const res = await request(buildApp()).post("/follows/hikaru");
    expect(res.status).toBe(201);
  });
});

describe("DELETE /follows/:username", () => {
  it("returns 404 when target player is not in DB", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValueOnce(null);

    const res = await request(buildApp()).delete("/follows/ghost");
    expect(res.status).toBe(404);
  });

  it("deletes the follow relationship and cleans up Redis", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValueOnce({
      id: "target1",
      chesscomUsername: "hikaru",
      claimed: false,
      createdAt: new Date(),
    } as any);
    vi.mocked(db.follow.delete).mockResolvedValueOnce({} as any);
    vi.mocked(redis.zrem).mockResolvedValue(1 as any);

    const res = await request(buildApp()).delete("/follows/hikaru");
    expect(res.status).toBe(204);

    // Fix 1: assert Redis sorted sets are cleaned up
    expect(redis.zrem).toHaveBeenCalledWith("leaderboard:viewer1:bullet", "hikaru");
    expect(redis.zrem).toHaveBeenCalledWith("leaderboard:viewer1:blitz", "hikaru");
    expect(redis.zrem).toHaveBeenCalledWith("leaderboard:viewer1:rapid", "hikaru");
    expect(redis.zrem).toHaveBeenCalledWith("leaderboard:viewer1:classical", "hikaru");
  });
});
