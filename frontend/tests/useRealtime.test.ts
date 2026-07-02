import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useRealtime } from "../src/hooks/useRealtime";
import type { LeaderboardEntry } from "../src/api";

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

import { supabase } from "../src/lib/supabase";

const mockEntries: LeaderboardEntry[] = [
  {
    rank: 1,
    userId: "u1",
    username: "hikaru",
    rating: 3100,
    wins: 500,
    losses: 100,
    draws: 50,
    isMe: false,
  },
];

beforeEach(() => { vi.clearAllMocks(); });

describe("useRealtime", () => {
  it("subscribes to Rating changes on mount for the active tab", () => {
    renderHook(() => useRealtime(mockEntries, "blitz", vi.fn()));

    expect(supabase.channel).toHaveBeenCalledWith(expect.stringContaining("ratings-blitz"));
    expect(mockChannel.on).toHaveBeenCalledWith(
      "postgres_changes",
      expect.objectContaining({ event: "UPDATE", table: "Rating", filter: "timeControl=eq.blitz" }),
      expect.any(Function)
    );
    expect(mockChannel.subscribe).toHaveBeenCalled();
  });

  it("calls onUpdate with username, delta, and new rating when a matching userId changes", () => {
    const onUpdate = vi.fn();
    renderHook(() => useRealtime(mockEntries, "blitz", onUpdate));

    const pgChangeCallback = vi.mocked(mockChannel.on).mock.calls[0][2] as Function;
    pgChangeCallback({
      new: { userId: "u1", timeControl: "blitz", rating: 3112 },
      old: { rating: 3100 },
    });

    expect(onUpdate).toHaveBeenCalledWith({
      userId: "u1",
      username: "hikaru",
      timeControl: "blitz",
      rating: 3112,
      delta: 12,
    });
  });

  it("ignores updates for userIds not in the entries list", () => {
    const onUpdate = vi.fn();
    renderHook(() => useRealtime(mockEntries, "blitz", onUpdate));

    const pgChangeCallback = vi.mocked(mockChannel.on).mock.calls[0][2] as Function;
    pgChangeCallback({
      new: { userId: "unknown-user", timeControl: "blitz", rating: 9999 },
      old: { rating: 9900 },
    });

    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("removes the channel subscription on unmount", () => {
    const { unmount } = renderHook(() => useRealtime(mockEntries, "blitz", vi.fn()));
    unmount();
    expect(supabase.removeChannel).toHaveBeenCalledWith(mockChannel);
  });
});
