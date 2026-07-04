import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BlunderFingerprint from "../src/components/BlunderFingerprint";

vi.mock("../src/api", () => ({
  getFingerprint: vi.fn(),
  getMyLosses: vi.fn(),
  saveFingerprint: vi.fn(),
}));
vi.mock("../src/lib/engine", () => ({
  createEngine: vi.fn(),
}));

import { getFingerprint, getMyLosses, saveFingerprint } from "../src/api";
import { createEngine } from "../src/lib/engine";

const FOOLS_MATE_PGN = [
  '[Event "Live Chess"]',
  '[TimeControl "180"]',
  "",
  "1. f3 {[%clk 0:02:55]} e5 {[%clk 0:02:58]} 2. g4 {[%clk 0:02:50]} Qh4# {[%clk 0:02:57]} 0-1",
].join("\n");

const loss = {
  gameId: "https://chess.com/game/1",
  pgn: FOOLS_MATE_PGN,
  color: "white" as const,
  timeControl: "180",
  endTime: 1,
};

const stored = {
  gamesAnalyzed: 8,
  mistakes: 12,
  byType: { hanging: 7, "time-scramble": 5 },
  examples: [
    { gameId: "https://chess.com/game/9", moveNumber: 14, san: "Qd3", type: "hanging", dropCp: 620 },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getFingerprint).mockResolvedValue({ fingerprint: null, computedAt: null });
});

describe("BlunderFingerprint", () => {
  it("offers to analyze when nothing is stored", async () => {
    render(<BlunderFingerprint />);

    expect(
      await screen.findByRole("button", { name: /analyze my recent losses/i })
    ).toBeInTheDocument();
  });

  it("shows a stored fingerprint immediately", async () => {
    vi.mocked(getFingerprint).mockResolvedValue({
      fingerprint: stored,
      computedAt: "2026-07-04T00:00:00Z",
    });

    render(<BlunderFingerprint />);

    expect((await screen.findAllByText(/hung material/i)).length).toBeGreaterThan(0);
    expect(screen.getByText(/12 costly mistakes/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /re-analyze/i })).toBeInTheDocument();
  });

  it("runs the engine analysis and saves the result", async () => {
    // white-perspective evals in fen order: start, f3, e5, g4, mate
    const evalByIndex = [20, 0, 0, -1000, -1000];
    let call = 0;
    vi.mocked(createEngine).mockResolvedValue({
      evalFen: async () => evalByIndex[call++],
      quit: vi.fn(),
    });
    vi.mocked(getMyLosses).mockResolvedValue([loss]);
    vi.mocked(saveFingerprint).mockResolvedValue();

    render(<BlunderFingerprint />);
    await userEvent.click(
      await screen.findByRole("button", { name: /analyze my recent losses/i })
    );

    expect((await screen.findAllByText(/hung material/i)).length).toBeGreaterThan(0);
    await waitFor(() => expect(saveFingerprint).toHaveBeenCalled());
    const saved = vi.mocked(saveFingerprint).mock.calls[0][0]!;
    expect(saved.mistakes).toBe(1);
    expect(saved.byType.hanging).toBe(1);
  });

  it("explains when there are no losses to analyze", async () => {
    vi.mocked(getMyLosses).mockResolvedValue([]);

    render(<BlunderFingerprint />);
    await userEvent.click(
      await screen.findByRole("button", { name: /analyze my recent losses/i })
    );

    expect(await screen.findByText(/no recent losses/i)).toBeInTheDocument();
  });

  it("surfaces engine startup failures", async () => {
    vi.mocked(getMyLosses).mockResolvedValue([loss]);
    vi.mocked(createEngine).mockRejectedValue(new Error("no wasm"));

    render(<BlunderFingerprint />);
    await userEvent.click(
      await screen.findByRole("button", { name: /analyze my recent losses/i })
    );

    expect(await screen.findByText(/analysis failed/i)).toBeInTheDocument();
  });
});
