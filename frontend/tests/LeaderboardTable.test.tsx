import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import LeaderboardTable from "../src/components/LeaderboardTable";
import type { LeaderboardEntry } from "../src/api";

const entries: LeaderboardEntry[] = [
  { rank: 1, username: "hikaru", rating: 3100, wins: 500, losses: 100, draws: 50, isMe: false },
  { rank: 2, username: "gothamchess", rating: 2800, wins: 200, losses: 80, draws: 30, isMe: true },
];

describe("LeaderboardTable", () => {
  it("renders rows in rank order", () => {
    render(<LeaderboardTable entries={entries} />);
    const rows = screen.getAllByRole("row");
    expect(rows[1]).toHaveTextContent("hikaru");
    expect(rows[2]).toHaveTextContent("gothamchess");
  });

  it("shows rating for each player", () => {
    render(<LeaderboardTable entries={entries} />);
    expect(screen.getByText("3100")).toBeInTheDocument();
    expect(screen.getByText("2800")).toBeInTheDocument();
  });

  it("highlights the viewer's own row", () => {
    render(<LeaderboardTable entries={entries} />);
    const myRow = screen.getByText("gothamchess").closest("tr");
    expect(myRow).toHaveClass("bg-green-900");
  });
});
