const ENGINE_URL = "/stockfish/stockfish-18-lite-single.js";
const DEPTH = 10;

export interface Engine {
  evalFen(fen: string): Promise<number>; // centipawns from white's perspective
  quit(): void;
}

export function createEngine(): Promise<Engine> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(ENGINE_URL);
    let queue: Promise<unknown> = Promise.resolve();

    const send = (cmd: string) => worker.postMessage(cmd);

    const failTimer = setTimeout(
      () => reject(new Error("Engine failed to start")),
      20000
    );

    const onReady = (event: MessageEvent) => {
      if (typeof event.data === "string" && event.data.includes("uciok")) {
        clearTimeout(failTimer);
        worker.removeEventListener("message", onReady);

        function evalOnce(fen: string): Promise<number> {
          return new Promise<number>((res) => {
            let lastCp: number | null = null;
            const onMessage = (e: MessageEvent) => {
              const line = String(e.data);
              const cp = line.match(/score cp (-?\d+)/);
              if (cp) lastCp = parseInt(cp[1], 10);
              const mate = line.match(/score mate (-?\d+)/);
              if (mate) lastCp = parseInt(mate[1], 10) > 0 ? 10000 : -10000;
              if (line.startsWith("bestmove")) {
                worker.removeEventListener("message", onMessage);
                // score is from the side to move; normalize to white's view
                const whiteToMove = fen.split(" ")[1] !== "b";
                const cpValue = lastCp ?? 0;
                res(whiteToMove ? cpValue : -cpValue);
              }
            };
            worker.addEventListener("message", onMessage);
            send(`position fen ${fen}`);
            send(`go depth ${DEPTH}`);
          });
        }

        resolve({
          evalFen(fen: string) {
            const next = queue.then(() => evalOnce(fen));
            queue = next.catch(() => {});
            return next;
          },
          quit() {
            worker.terminate();
          },
        });
      }
    };

    worker.addEventListener("message", onReady);
    worker.addEventListener("error", (e) => {
      clearTimeout(failTimer);
      reject(new Error(`Engine error: ${e.message}`));
    });
    send("uci");
  });
}
