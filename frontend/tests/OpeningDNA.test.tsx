import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OpeningDNA from "../src/components/OpeningDNA";

vi.mock("../src/api", () => ({
  getOpenings: vi.fn(),
  compareOpenings: vi.fn(),
}));

import { getOpenings, compareOpenings } from "../src/api";

const dna = {
  username: "testuser",
  totalGames: 120,
  openings: [
    { eco: "B20", name: "Sicilian Defense", games: 40, wins: 26, losses: 10, draws: 4, winRate: 65 },
    { eco: "C50", name: "Italian Game", games: 30, wins: 12, losses: 15, draws: 3, winRate: 40 },
    { eco: "D02", name: "London System", games: 20, wins: 10, losses: 8, draws: 2, winRate: 50 },
    { eco: "B01", name: "Scandinavian Defense", games: 15, wins: 9, losses: 5, draws: 1, winRate: 60 },
    { eco: "A40", name: "Englund Gambit", games: 10, wins: 3, losses: 7, draws: 0, winRate: 30 },
    { eco: "E60", name: "Kings Indian Defense", games: 5, wins: 2, losses: 3, draws: 0, winRate: 40 },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getOpenings).mockResolvedValue(dna);
});

describe("OpeningDNA", () => {
  it("fetches and renders the top 5 openings with win rates", async () => {
    render(<OpeningDNA me="testuser" friends={["hikaru"]} />);

    expect(await screen.findByText("Sicilian Defense")).toBeInTheDocument();
    expect(getOpenings).toHaveBeenCalledWith("testuser");
    expect(screen.getByText(/65%/)).toBeInTheDocument();
    // only top 5 are charted
    expect(screen.queryByText("Kings Indian Defense")).not.toBeInTheDocument();
  });

  it("sizes each bar by its win rate", async () => {
    render(<OpeningDNA me="testuser" friends={[]} />);
    await screen.findByText("Sicilian Defense");

    const bars = screen.getAllByRole("meter");
    expect(bars[0]).toHaveStyle({ width: "65%" });
    expect(bars[0]).toHaveAttribute("aria-valuenow", "65");
  });

  it("shows an empty state when the player has no analyzed games", async () => {
    vi.mocked(getOpenings).mockResolvedValue({ username: "testuser", totalGames: 0, openings: [] });

    render(<OpeningDNA me="testuser" friends={[]} />);

    expect(await screen.findByText(/no games analyzed yet/i)).toBeInTheDocument();
  });

  it("compares against a selected friend and shows the narrative", async () => {
    vi.mocked(compareOpenings).mockResolvedValueOnce({
      narrative: "Your Sicilian is sharper than hikaru's Italian.",
    });

    render(<OpeningDNA me="testuser" friends={["hikaru", "danya"]} />);
    await screen.findByText("Sicilian Defense");

    await userEvent.selectOptions(screen.getByRole("combobox"), "hikaru");
    await userEvent.click(screen.getByRole("button", { name: /compare/i }));

    expect(compareOpenings).toHaveBeenCalledWith("hikaru");
    expect(
      await screen.findByText(/your sicilian is sharper/i)
    ).toBeInTheDocument();
  });

  it("shows an error message when the comparison fails", async () => {
    vi.mocked(compareOpenings).mockRejectedValueOnce(new Error("503"));

    render(<OpeningDNA me="testuser" friends={["hikaru"]} />);
    await screen.findByText("Sicilian Defense");

    await userEvent.selectOptions(screen.getByRole("combobox"), "hikaru");
    await userEvent.click(screen.getByRole("button", { name: /compare/i }));

    expect(await screen.findByText(/comparison failed/i)).toBeInTheDocument();
  });

  it("hides the compare controls when there are no friends", async () => {
    render(<OpeningDNA me="testuser" friends={[]} />);
    await screen.findByText("Sicilian Defense");

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });
});
