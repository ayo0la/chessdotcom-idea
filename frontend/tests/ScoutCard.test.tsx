import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ScoutCard from "../src/components/ScoutCard";

vi.mock("../src/api", () => ({
  getScout: vi.fn(),
}));

import { getScout } from "../src/api";

const report = {
  username: "danya",
  recentForm: { games: 20, wins: 6, losses: 12, draws: 2, streak: -4 },
  weapons: [
    { eco: "B20", name: "Sicilian Defense", games: 8, wins: 6, losses: 1, draws: 1, winRate: 75 },
  ],
  weaknesses: [
    { eco: "C50", name: "Italian Game", games: 7, wins: 1, losses: 6, draws: 0, winRate: 14 },
  ],
  style: {
    tactical: 80,
    aggressive: 30,
    timeManagement: 20,
    labels: { style: "Tactical", approach: "Defensive", clock: "Scrambler" },
    gamesAnalyzed: 150,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getScout).mockResolvedValue(report as any);
});

describe("ScoutCard", () => {
  it("shows recent form including the streak", async () => {
    render(<ScoutCard username="danya" />);

    expect(await screen.findByText(/6W-12L-2D/i)).toBeInTheDocument();
    expect(screen.getByText(/4-loss streak/i)).toBeInTheDocument();
    expect(getScout).toHaveBeenCalledWith("danya");
  });

  it("lists weapons to avoid and weaknesses to target", async () => {
    render(<ScoutCard username="danya" />);

    expect(await screen.findByText("Sicilian Defense")).toBeInTheDocument();
    expect(screen.getByText("Italian Game")).toBeInTheDocument();
    expect(screen.getByText(/avoid/i)).toBeInTheDocument();
    expect(screen.getByText(/target/i)).toBeInTheDocument();
  });

  it("shows their style labels and a matching tip", async () => {
    render(<ScoutCard username="danya" />);

    expect(await screen.findByText(/scrambler/i)).toBeInTheDocument();
  });

  it("renders nothing when the scout fails", async () => {
    vi.mocked(getScout).mockRejectedValue(new Error("404"));

    const { container } = render(<ScoutCard username="danya" />);
    await vi.waitFor(() => expect(getScout).toHaveBeenCalled());

    expect(container).toBeEmptyDOMElement();
  });
});
