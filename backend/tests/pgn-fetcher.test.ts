import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/chesscom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/chesscom")>();
  return { ...actual, fetchMonthlyGames: vi.fn() };
});

import { fetchMonthlyGames, type MonthlyGame } from "../src/chesscom";
import {
  fetchRecentGames,
  clearGamesCache,
} from "../src/services/analysis/pgn-fetcher";

const NOW = new Date("2026-07-02T12:00:00Z");

function games(n: number, monthTag: string): MonthlyGame[] {
  return Array.from({ length: n }, (_, i) => ({
    url: `https://chess.com/game/${monthTag}-${i}`,
    pgn: "",
    time_control: "180",
    time_class: "blitz",
    end_time: 1,
    white: { username: "a", result: "win", rating: 1500 },
    black: { username: "b", result: "resigned", rating: 1500 },
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  clearGamesCache();
});

describe("fetchRecentGames", () => {
  it("fetches the current month first", async () => {
    vi.mocked(fetchMonthlyGames).mockResolvedValue(games(250, "jul"));

    const result = await fetchRecentGames("hikaru", 200, NOW);

    expect(fetchMonthlyGames).toHaveBeenCalledWith("hikaru", 2026, 7);
    expect(result).toHaveLength(200);
  });

  it("walks back through previous months until it has enough games", async () => {
    vi.mocked(fetchMonthlyGames)
      .mockResolvedValueOnce(games(50, "jul"))
      .mockResolvedValueOnce(games(80, "jun"))
      .mockResolvedValueOnce(games(100, "may"));

    const result = await fetchRecentGames("hikaru", 200, NOW);

    expect(fetchMonthlyGames).toHaveBeenNthCalledWith(1, "hikaru", 2026, 7);
    expect(fetchMonthlyGames).toHaveBeenNthCalledWith(2, "hikaru", 2026, 6);
    expect(fetchMonthlyGames).toHaveBeenNthCalledWith(3, "hikaru", 2026, 5);
    expect(result).toHaveLength(200);
  });

  it("crosses a year boundary when walking back", async () => {
    const jan = new Date("2026-01-15T12:00:00Z");
    vi.mocked(fetchMonthlyGames)
      .mockResolvedValueOnce(games(10, "jan"))
      .mockResolvedValue(games(300, "dec"));

    await fetchRecentGames("hikaru", 200, jan);

    expect(fetchMonthlyGames).toHaveBeenNthCalledWith(2, "hikaru", 2025, 12);
  });

  it("stops after a bounded number of months even if games are sparse", async () => {
    vi.mocked(fetchMonthlyGames).mockResolvedValue(games(1, "x"));

    const result = await fetchRecentGames("hikaru", 200, NOW);

    expect(vi.mocked(fetchMonthlyGames).mock.calls.length).toBeLessThanOrEqual(12);
    expect(result.length).toBeLessThan(200);
  });

  it("serves the second call from cache without refetching", async () => {
    vi.mocked(fetchMonthlyGames).mockResolvedValue(games(250, "jul"));

    await fetchRecentGames("hikaru", 200, NOW);
    await fetchRecentGames("hikaru", 200, NOW);

    expect(fetchMonthlyGames).toHaveBeenCalledTimes(1);
  });

  it("refetches after the cache TTL has expired", async () => {
    vi.mocked(fetchMonthlyGames).mockResolvedValue(games(250, "jul"));

    await fetchRecentGames("hikaru", 200, NOW);
    const later = new Date(NOW.getTime() + 2 * 60 * 60 * 1000);
    await fetchRecentGames("hikaru", 200, later);

    expect(fetchMonthlyGames).toHaveBeenCalledTimes(2);
  });

  it("caches per username", async () => {
    vi.mocked(fetchMonthlyGames).mockResolvedValue(games(250, "jul"));

    await fetchRecentGames("hikaru", 200, NOW);
    await fetchRecentGames("danya", 200, NOW);

    expect(vi.mocked(fetchMonthlyGames).mock.calls[0][0]).toBe("hikaru");
    expect(vi.mocked(fetchMonthlyGames).mock.calls[1][0]).toBe("danya");
  });
});
