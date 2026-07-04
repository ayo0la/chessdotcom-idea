import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import RatingChart from "../src/components/RatingChart";

vi.mock("../src/api", () => ({
  getRatingHistory: vi.fn(),
}));

import { getRatingHistory } from "../src/api";

const points = [
  { rating: 500, at: "2026-07-01T00:00:00Z" },
  { rating: 512, at: "2026-07-02T00:00:00Z" },
  { rating: 508, at: "2026-07-03T00:00:00Z" },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("RatingChart", () => {
  it("fetches history for the active time control and draws a line", async () => {
    vi.mocked(getRatingHistory).mockResolvedValue(points);

    const { container } = render(<RatingChart tc="blitz" />);

    expect(await screen.findByText("508")).toBeInTheDocument();
    expect(getRatingHistory).toHaveBeenCalledWith("blitz");
    expect(container.querySelector("polyline")).not.toBeNull();
  });

  it("shows a quiet message while there are not enough points", async () => {
    vi.mocked(getRatingHistory).mockResolvedValue([points[0]]);

    render(<RatingChart tc="blitz" />);

    expect(
      await screen.findByText(/tracking your rating/i)
    ).toBeInTheDocument();
  });

  it("refetches when the time control changes", async () => {
    vi.mocked(getRatingHistory).mockResolvedValue(points);

    const { rerender } = render(<RatingChart tc="blitz" />);
    await screen.findByText("508");
    rerender(<RatingChart tc="bullet" />);

    expect(getRatingHistory).toHaveBeenLastCalledWith("bullet");
  });

  it("renders nothing when the fetch fails", async () => {
    vi.mocked(getRatingHistory).mockRejectedValue(new Error("401"));

    const { container } = render(<RatingChart tc="blitz" />);
    await vi.waitFor(() => expect(getRatingHistory).toHaveBeenCalled());

    expect(container).toBeEmptyDOMElement();
  });
});
