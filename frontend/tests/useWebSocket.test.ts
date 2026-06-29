import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useWebSocket } from "../src/hooks/useWebSocket";

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  send = vi.fn();
  close = vi.fn();
  constructor() { MockWebSocket.instances.push(this); }
}

vi.stubGlobal("WebSocket", MockWebSocket);

beforeEach(() => { MockWebSocket.instances = []; vi.clearAllMocks(); });

describe("useWebSocket", () => {
  it("calls onMessage when a message is received", () => {
    const onMessage = vi.fn();
    renderHook(() => useWebSocket(onMessage));

    const ws = MockWebSocket.instances[0];
    ws.onmessage?.({ data: JSON.stringify({ type: "rating_update", username: "hikaru", timeControl: "blitz", rating: 3100, delta: 12 }) });

    expect(onMessage).toHaveBeenCalledWith({ type: "rating_update", username: "hikaru", timeControl: "blitz", rating: 3100, delta: 12 });
  });

  it("reconnects on close if under 3 attempts", async () => {
    vi.useFakeTimers();
    renderHook(() => useWebSocket(vi.fn()));

    MockWebSocket.instances[0].onclose?.();
    await vi.runAllTimersAsync();

    expect(MockWebSocket.instances.length).toBe(2);
    vi.useRealTimers();
  });
});
