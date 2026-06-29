export type WsMessage = { type: string };
export function useWebSocket(_onMessage: (msg: WsMessage) => void) {}
