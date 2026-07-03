import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/db", () => ({
  db: {
    debriefPrompt: { findFirst: vi.fn(), create: vi.fn() },
  },
}));
vi.mock("../src/chesscom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/chesscom")>();
  return { ...actual, fetchMonthlyGames: vi.fn() };
});

import { db } from "../src/db";
import { fetchMonthlyGames, type MonthlyGame } from "../src/chesscom";
import { promptDebriefForLatestLoss } from "../src/services/analysis/debrief-prompter";

const NOW = new Date("2026-07-02T12:00:00Z");
const user = { id: "user1", chesscomUsername: "testuser" };

function makeGame(opts: {
  minsAgo: number;
  result: string;
  url?: string;
}): MonthlyGame {
  return {
    url: opts.url ?? `https://chess.com/game/${opts.minsAgo}`,
    pgn: "",
    time_control: "180",
    time_class: "blitz",
    end_time: Math.floor((NOW.getTime() - opts.minsAgo * 60_000) / 1000),
    white: { username: "testuser", result: opts.result, rating: 1500 },
    black: {
      username: "opp",
      result: opts.result === "win" ? "resigned" : "win",
      rating: 1500,
    },
  };
}

beforeEach(() => vi.clearAllMocks());

describe("promptDebriefForLatestLoss", () => {
  it("creates a debrief prompt for the most recent loss", async () => {
    vi.mocked(fetchMonthlyGames).mockResolvedValue([
      makeGame({ minsAgo: 30, result: "checkmated", url: "https://chess.com/game/old" }),
      makeGame({ minsAgo: 5, result: "resigned", url: "https://chess.com/game/new" }),
    ]);
    vi.mocked(db.debriefPrompt.findFirst).mockResolvedValue(null);

    await promptDebriefForLatestLoss(user, NOW);

    expect(db.debriefPrompt.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user1",
        gameId: "https://chess.com/game/new",
      }),
    });
  });

  it("does not prompt twice for the same game", async () => {
    vi.mocked(fetchMonthlyGames).mockResolvedValue([
      makeGame({ minsAgo: 5, result: "resigned" }),
    ]);
    vi.mocked(db.debriefPrompt.findFirst).mockResolvedValue({ id: "p1" } as any);

    await promptDebriefForLatestLoss(user, NOW);

    expect(db.debriefPrompt.create).not.toHaveBeenCalled();
  });

  it("does nothing when there is no recent loss", async () => {
    vi.mocked(fetchMonthlyGames).mockResolvedValue([
      makeGame({ minsAgo: 5, result: "win" }),
      makeGame({ minsAgo: 300, result: "checkmated" }),
    ]);

    await promptDebriefForLatestLoss(user, NOW);

    expect(db.debriefPrompt.create).not.toHaveBeenCalled();
  });
});
