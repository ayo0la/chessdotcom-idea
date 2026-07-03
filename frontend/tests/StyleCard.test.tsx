import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import StyleCard from "../src/components/StyleCard";

vi.mock("../src/api", () => ({
  getStyleProfile: vi.fn(),
}));

import { getStyleProfile } from "../src/api";

const profile = {
  tactical: 72,
  aggressive: 35,
  timeManagement: 80,
  labels: {
    style: "Tactical" as const,
    approach: "Defensive" as const,
    clock: "Time Manager" as const,
  },
  gamesAnalyzed: 140,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getStyleProfile).mockResolvedValue(profile);
});

describe("StyleCard", () => {
  it("fetches the profile and highlights the active pole of each axis", async () => {
    render(<StyleCard username="testuser" />);

    expect(await screen.findByText("Tactical")).toBeInTheDocument();
    expect(getStyleProfile).toHaveBeenCalledWith("testuser");
    expect(screen.getByText("Tactical")).toHaveAttribute("data-active", "true");
    expect(screen.getByText("Defensive")).toHaveAttribute("data-active", "true");
    expect(screen.getByText("Time Manager")).toHaveAttribute("data-active", "true");
    expect(screen.getByText("Positional")).not.toHaveAttribute("data-active");
  });

  it("renders each axis as a meter positioned by its score", async () => {
    render(<StyleCard username="testuser" />);
    await screen.findByText("Tactical");

    const meters = screen.getAllByRole("meter");
    expect(meters).toHaveLength(3);
    expect(meters[0]).toHaveAttribute("aria-valuenow", "72");
  });

  it("mentions how many games were analyzed", async () => {
    render(<StyleCard username="testuser" />);

    expect(await screen.findByText(/140 games/i)).toBeInTheDocument();
  });

  it("renders nothing when the profile cannot be computed", async () => {
    vi.mocked(getStyleProfile).mockRejectedValue(new Error("404"));

    const { container } = render(<StyleCard username="testuser" />);
    await vi.waitFor(() => expect(getStyleProfile).toHaveBeenCalled());

    expect(container).toBeEmptyDOMElement();
  });
});
