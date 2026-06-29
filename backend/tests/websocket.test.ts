import { describe, it, expect, vi, beforeEach } from "vitest";
import { WebSocket } from "ws";
import {
  addConnection,
  removeConnection,
  getConnection,
} from "../src/connections";

// Reset module state between tests
beforeEach(() => {
  removeConnection("user1");
  removeConnection("user2");
});

describe("connection map", () => {
  it("stores and retrieves a WebSocket by userId", () => {
    const ws = { readyState: WebSocket.OPEN } as WebSocket;
    addConnection("user1", ws);
    expect(getConnection("user1")).toBe(ws);
  });

  it("returns undefined after removal", () => {
    const ws = { readyState: WebSocket.OPEN } as WebSocket;
    addConnection("user1", ws);
    removeConnection("user1");
    expect(getConnection("user1")).toBeUndefined();
  });

  it("overwrites previous connection for same userId", () => {
    const ws1 = { readyState: WebSocket.OPEN } as WebSocket;
    const ws2 = { readyState: WebSocket.OPEN } as WebSocket;
    addConnection("user1", ws1);
    addConnection("user1", ws2);
    expect(getConnection("user1")).toBe(ws2);
  });
});
