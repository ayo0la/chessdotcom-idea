import { useEffect, useRef } from "react";

export type WsMessage =
  | {
      type: "rating_update";
      username: string;
      timeControl: string;
      rating: number;
      delta: number;
    }
  | { type: "friend_joined"; username: string };

export function useWebSocket(onMessage: (msg: WsMessage) => void): void {
  const attemptsRef = useRef(0);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    let ws: WebSocket;
    let active = true;

    function connect() {
      const wsUrl =
        import.meta.env.VITE_WS_URL ??
        `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`;
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        attemptsRef.current = 0;
      };

      ws.onmessage = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data as string) as WsMessage;
          onMessageRef.current(msg);
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        if (active && attemptsRef.current < 3) {
          attemptsRef.current++;
          const delay = Math.pow(2, attemptsRef.current) * 1000;
          setTimeout(connect, delay);
        }
      };
    }

    connect();
    return () => {
      active = false;
      ws?.close();
    };
  }, []);
}
