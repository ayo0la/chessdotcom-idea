import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import TiltBanner from "../src/components/TiltBanner";

const mockChannel = vi.hoisted(() => ({
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis(),
}));

vi.mock("../src/lib/supabase", () => ({
  supabase: {
    channel: vi.fn().mockReturnValue(mockChannel),
    removeChannel: vi.fn(),
  },
}));

vi.mock("../src/api", () => ({
  getTiltStatus: vi.fn(),
}));

import { supabase } from "../src/lib/supabase";
import { getTiltStatus } from "../src/api";

const warning = {
  lossCount: 3,
  rushing: true,
  suggestion: "Step away from the board for 15 minutes.",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getTiltStatus).mockResolvedValue(null);
});

describe("TiltBanner", () => {
  it("renders nothing when there is no active tilt warning", async () => {
    const { container } = render(<TiltBanner userId="u1" />);
    await waitFor(() => expect(getTiltStatus).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the warning returned by the initial fetch", async () => {
    vi.mocked(getTiltStatus).mockResolvedValue(warning);

    render(<TiltBanner userId="u1" />);

    expect(await screen.findByText(/step away from the board/i)).toBeInTheDocument();
    expect(screen.getByText(/3 losses/i)).toBeInTheDocument();
  });

  it("subscribes to TiltEvent inserts filtered by userId", () => {
    render(<TiltBanner userId="u1" />);

    expect(supabase.channel).toHaveBeenCalledWith(expect.stringContaining("tilt-u1"));
    expect(mockChannel.on).toHaveBeenCalledWith(
      "postgres_changes",
      expect.objectContaining({
        event: "INSERT",
        table: "TiltEvent",
        filter: "userId=eq.u1",
      }),
      expect.any(Function)
    );
  });

  it("shows the banner when a TiltEvent insert arrives in realtime", async () => {
    render(<TiltBanner userId="u1" />);
    await waitFor(() => expect(getTiltStatus).toHaveBeenCalled());

    const insertCallback = vi.mocked(mockChannel.on).mock.calls[0][2] as Function;
    act(() => {
      insertCallback({ new: { ...warning, userId: "u1" } });
    });

    expect(await screen.findByText(/step away from the board/i)).toBeInTheDocument();
  });

  it("hides the banner when dismissed", async () => {
    vi.mocked(getTiltStatus).mockResolvedValue(warning);

    render(<TiltBanner userId="u1" />);
    await screen.findByText(/step away from the board/i);

    await userEvent.click(screen.getByRole("button", { name: /dismiss/i }));

    expect(screen.queryByText(/step away from the board/i)).not.toBeInTheDocument();
  });

  it("removes the channel on unmount", () => {
    const { unmount } = render(<TiltBanner userId="u1" />);
    unmount();
    expect(supabase.removeChannel).toHaveBeenCalledWith(mockChannel);
  });
});
