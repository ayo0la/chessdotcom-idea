import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import DebriefModal from "../src/components/DebriefModal";

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
  getDebriefPrompt: vi.fn(),
  submitDebrief: vi.fn(),
}));

import { supabase } from "../src/lib/supabase";
import { getDebriefPrompt, submitDebrief } from "../src/api";

const prompt = {
  id: "p1",
  gameId: "https://chess.com/game/1",
  gameUrl: "https://chess.com/game/1",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getDebriefPrompt).mockResolvedValue(null);
});

describe("DebriefModal", () => {
  it("renders nothing when there is no pending prompt", async () => {
    const { container } = render(<DebriefModal userId="u1" onSubmitted={vi.fn()} />);
    await waitFor(() => expect(getDebriefPrompt).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("opens with 8 questions when a prompt is pending", async () => {
    vi.mocked(getDebriefPrompt).mockResolvedValue(prompt);

    render(<DebriefModal userId="u1" onSubmitted={vi.fn()} />);

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    const labels = screen.getAllByText(/^\d\./);
    expect(labels).toHaveLength(8);
  });

  it("subscribes to DebriefPrompt inserts for the user", () => {
    render(<DebriefModal userId="u1" onSubmitted={vi.fn()} />);

    expect(mockChannel.on).toHaveBeenCalledWith(
      "postgres_changes",
      expect.objectContaining({
        event: "INSERT",
        table: "DebriefPrompt",
        filter: "userId=eq.u1",
      }),
      expect.any(Function)
    );
  });

  it("opens when a realtime prompt arrives", async () => {
    render(<DebriefModal userId="u1" onSubmitted={vi.fn()} />);
    await waitFor(() => expect(getDebriefPrompt).toHaveBeenCalled());

    const insertCallback = vi.mocked(mockChannel.on).mock.calls[0][2] as Function;
    act(() => {
      insertCallback({ new: prompt });
    });

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("submits the answers and closes", async () => {
    vi.mocked(getDebriefPrompt).mockResolvedValue(prompt);
    vi.mocked(submitDebrief).mockResolvedValue();
    const onSubmitted = vi.fn();

    render(<DebriefModal userId="u1" onSubmitted={onSubmitted} />);
    await screen.findByRole("dialog");

    await userEvent.type(screen.getByLabelText(/1\./), "Sicilian");
    await userEvent.type(screen.getByLabelText(/3\./), "hung a knight");
    await userEvent.type(screen.getByLabelText(/8\./), "slow down");
    await userEvent.click(screen.getByRole("button", { name: /save debrief/i }));

    await waitFor(() => expect(submitDebrief).toHaveBeenCalled());
    const [gameId, answers] = vi.mocked(submitDebrief).mock.calls[0];
    expect(gameId).toBe(prompt.gameId);
    expect(answers).toMatchObject({ opening: "Sicilian", nextTime: "slow down" });
    expect(onSubmitted).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("can be dismissed without submitting", async () => {
    vi.mocked(getDebriefPrompt).mockResolvedValue(prompt);

    render(<DebriefModal userId="u1" onSubmitted={vi.fn()} />);
    await screen.findByRole("dialog");

    await userEvent.click(screen.getByRole("button", { name: /skip/i }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(submitDebrief).not.toHaveBeenCalled();
  });
});
