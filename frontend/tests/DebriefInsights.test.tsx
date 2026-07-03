import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DebriefInsights from "../src/components/DebriefInsights";

vi.mock("../src/api", () => ({
  getDebriefSummary: vi.fn(),
}));

import { getDebriefSummary } from "../src/api";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DebriefInsights", () => {
  it("shows progress toward the 10-debrief diagnosis when below the bar", () => {
    render(<DebriefInsights count={4} />);

    expect(screen.getByText(/4 of 10/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /diagnosis/i })
    ).not.toBeInTheDocument();
  });

  it("generates and shows the diagnosis when 10+ debriefs exist", async () => {
    vi.mocked(getDebriefSummary).mockResolvedValueOnce({
      count: 12,
      streak: 3,
      narrative: "You collapse in mutual time pressure.",
    });

    render(<DebriefInsights count={12} />);

    await userEvent.click(screen.getByRole("button", { name: /diagnosis/i }));

    expect(getDebriefSummary).toHaveBeenCalledWith(true);
    expect(
      await screen.findByText(/mutual time pressure/i)
    ).toBeInTheDocument();
  });

  it("shows an error when the diagnosis fails", async () => {
    vi.mocked(getDebriefSummary).mockRejectedValueOnce(new Error("503"));

    render(<DebriefInsights count={12} />);
    await userEvent.click(screen.getByRole("button", { name: /diagnosis/i }));

    expect(await screen.findByText(/could not generate/i)).toBeInTheDocument();
  });

  it("renders nothing when there are no debriefs yet", () => {
    const { container } = render(<DebriefInsights count={0} />);
    expect(container).toBeEmptyDOMElement();
  });
});
