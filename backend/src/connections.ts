import type { WebSocket } from "ws";

const connections = new Map<string, WebSocket>();

export function addConnection(userId: string, ws: WebSocket): void {
  connections.set(userId, ws);
}

export function removeConnection(userId: string): void {
  connections.delete(userId);
}

export function getConnection(userId: string): WebSocket | undefined {
  return connections.get(userId);
}
