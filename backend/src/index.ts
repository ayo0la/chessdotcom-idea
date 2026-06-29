import "dotenv/config";
import http from "http";
import express from "express";
import { WebSocketServer } from "ws";
import { sessionParser } from "./session.js";
import { addConnection, removeConnection } from "./connections.js";
import { startPoller } from "./poller.js";
import authRouter from "./routes/auth.js";
import meRouter from "./routes/me.js";
import playersRouter from "./routes/players.js";
import followsRouter from "./routes/follows.js";
import leaderboardRouter from "./routes/leaderboard.js";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());
app.use(sessionParser);
app.use("/auth", authRouter);
app.use("/me", meRouter);
app.use("/players", playersRouter);
app.use("/follows", followsRouter);
app.use("/leaderboard", leaderboardRouter);

wss.on("connection", (ws, req) => {
  sessionParser(req as any, {} as any, () => {
    const userId = (req as any).session?.userId as string | undefined;
    if (!userId) {
      ws.close(1008, "Unauthorized");
      return;
    }
    addConnection(userId, ws);
    ws.on("close", () => removeConnection(userId));
  });
});

const PORT = process.env.PORT ?? 3001;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  startPoller();
});
