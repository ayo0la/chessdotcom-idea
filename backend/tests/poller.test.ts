import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/db", () => ({
  db: {
    user: { findMany: vi.fn() },
    rating: { upsert: vi.fn() },
    follow: { findMany: vi.fn() },
  },
}));
vi.mock("../src/redis", () => ({
  redis: { zadd: vi.fn() },
}));
vi.mock("../src/chesscom", () => ({
  fetchPlayerRatings: vi.fn(),
}));
vi.mock("../src/connections", () => ({
  getConnection: vi.fn(),
}));

import { db } from "../src/db";
import { redis } from "../src/redis";
import { fetchPlayerRatings } from "../src/chesscom";
import { getConnection } from "../src/connections";
import { pollAllRatings } from "../src/poller";
import { WebSocket } from "ws";

const fakeUser = {
  id: "user1",
  chesscomUsername: "hikaru",
  claimed: true,
  createdAt: new Date(),
  ratings: [
    {
      id: "r1",
      userId: "user1",
      timeControl: "blitz",
      rating: 3100,
      wins: 500,
      losses: 100,
      draws: 50,
      updatedAt: new Date(),
    },
  ],
};

beforeEach(() => vi.clearAllMocks());

describe("pollAllRatings", () => {
  it("updates Postgres and Redis when rating has changed", async () => {
    vi.mocked(db.user.findMany).mockResolvedValueOnce([fakeUser] as any);
    vi.mocked(fetchPlayerRatings).mockResolvedValueOnce([
      { timeControl: "blitz", rating: 3112, wins: 501, losses: 100, draws: 50 },
    ]);
    vi.mocked(db.follow.findMany).mockResolvedValueOnce([
      { followerId: "viewer1", followingId: "user1", createdAt: new Date() },
    ] as any);
    vi.mocked(db.rating.upsert).mockResolvedValueOnce({} as any);
    vi.mocked(getConnection).mockReturnValueOnce(undefined);

    await pollAllRatings();

    expect(db.rating.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_timeControl: { userId: "user1", timeControl: "blitz" },
        },
        update: expect.objectContaining({ rating: 3112 }),
      })
    );
    expect(redis.zadd).toHaveBeenCalledWith(
      "leaderboard:viewer1:blitz",
      3112,
      "hikaru"
    );
  });

  it("pushes rating_update WebSocket message with correct delta", async () => {
    vi.mocked(db.user.findMany).mockResolvedValueOnce([fakeUser] as any);
    vi.mocked(fetchPlayerRatings).mockResolvedValueOnce([
      { timeControl: "blitz", rating: 3112, wins: 501, losses: 100, draws: 50 },
    ]);
    vi.mocked(db.follow.findMany).mockResolvedValueOnce([
      { followerId: "viewer1", followingId: "user1", createdAt: new Date() },
    ] as any);
    vi.mocked(db.rating.upsert).mockResolvedValueOnce({} as any);

    const mockSend = vi.fn();
    vi.mocked(getConnection).mockReturnValueOnce({
      readyState: WebSocket.OPEN,
      send: mockSend,
    } as unknown as WebSocket);

    await pollAllRatings();

    expect(mockSend).toHaveBeenCalledWith(
      JSON.stringify({
        type: "rating_update",
        username: "hikaru",
        timeControl: "blitz",
        rating: 3112,
        delta: 12,
      })
    );
  });

  it("skips update when rating has not changed", async () => {
    vi.mocked(db.user.findMany).mockResolvedValueOnce([fakeUser] as any);
    vi.mocked(fetchPlayerRatings).mockResolvedValueOnce([
      { timeControl: "blitz", rating: 3100, wins: 500, losses: 100, draws: 50 },
    ]);

    await pollAllRatings();

    expect(db.rating.upsert).not.toHaveBeenCalled();
    expect(redis.zadd).not.toHaveBeenCalled();
  });
});
