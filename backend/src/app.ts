import express from "express";
import { sessionParser } from "./session.js";
import authRouter from "./routes/auth.js";
import meRouter from "./routes/me.js";
import playersRouter from "./routes/players.js";
import followsRouter from "./routes/follows.js";
import leaderboardRouter from "./routes/leaderboard.js";
import cronRouter from "./routes/cron.js";
import analysisRouter from "./routes/analysis.js";

if (process.env.NODE_ENV === "production" && !process.env.CRON_SECRET) {
  throw new Error("CRON_SECRET must be set in production");
}

export const app = express();

app.use(express.json());
app.use(sessionParser);
app.use("/auth", authRouter);
app.use("/me", meRouter);
app.use("/players", playersRouter);
app.use("/follows", followsRouter);
app.use("/leaderboard", leaderboardRouter);
app.use("/poll", cronRouter);
app.use("/analysis", analysisRouter);
