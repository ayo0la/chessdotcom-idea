import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/db", () => ({
  db: {
    user: { findMany: vi.fn() },
    rating: { upsert: vi.fn() },
  },
}));
vi.mock("../src/chesscom", () => ({
  fetchPlayerRatings: vi.fn(),
}));

import { db } from "../src/db";
import { fetchPlayerRatings } from "../src/chesscom";
import { pollAllRatings } from "../src/poller";

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
  it("updates Postgres when rating has changed", async () => {
    vi.mocked(db.user.findMany).mockResolvedValueOnce([fakeUser] as any);
    vi.mocked(fetchPlayerRatings).mockResolvedValueOnce([
      { timeControl: "blitz", rating: 3112, wins: 501, losses: 100, draws: 50 },
    ]);
    vi.mocked(db.rating.upsert).mockResolvedValueOnce({} as any);

    await pollAllRatings();

    expect(db.rating.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_timeControl: { userId: "user1", timeControl: "blitz" },
        },
        update: expect.objectContaining({ rating: 3112 }),
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
  });
});
