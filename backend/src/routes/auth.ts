import { Router } from "express";
import { fetchPlayerExists } from "../chesscom.js";
import { db } from "../db.js";

const router = Router();

router.post("/claim", async (req, res) => {
  const { username } = req.body as { username?: string };

  if (!username || typeof username !== "string") {
    res.status(400).json({ error: "username is required" });
    return;
  }

  const exists = await fetchPlayerExists(username.toLowerCase());
  if (!exists) {
    res.status(404).json({ error: "Chess.com username not found" });
    return;
  }

  const user = await db.user.upsert({
    where: { chesscomUsername: username.toLowerCase() },
    update: { claimed: true },
    create: { chesscomUsername: username.toLowerCase(), claimed: true },
  });

  req.session.userId = user.id;
  res.json({ userId: user.id, chesscomUsername: user.chesscomUsername });
});

router.delete("/session", (req, res) => {
  req.session.destroy(() => {
    res.status(204).end();
  });
});

export default router;
