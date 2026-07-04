import { Router } from "express";
import { db } from "../db.js";
import { requireAuth, requireLinkedUser } from "../middleware/requireAuth.js";
import { fetchRecentGames } from "../services/analysis/pgn-fetcher.js";
import { computeOpeningDna, type OpeningDna } from "../services/analysis/opening-dna.js";
import { claudeEnabled, generateText } from "../services/claude.js";

const router = Router();
router.use(requireAuth, requireLinkedUser);

function describeDna(username: string, dna: OpeningDna): string {
  const lines = dna.openings
    .slice(0, 5)
    .map(
      (o) =>
        `- ${o.name} (${o.eco}): ${o.games} games, ${o.winRate}% wins (${o.wins}W/${o.losses}L/${o.draws}D)`
    );
  return `${username} (${dna.totalGames} recent games):\n${lines.join("\n")}`;
}

router.post("/compare", async (req, res) => {
  const me = await db.user.findUnique({ where: { id: req.userId! } });
  if (!me) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const username =
    typeof req.body?.username === "string"
      ? req.body.username.trim().toLowerCase()
      : "";
  if (!username) {
    res.status(400).json({ error: "username is required" });
    return;
  }

  if (!claudeEnabled()) {
    res.status(503).json({ error: "Opening comparison is not configured" });
    return;
  }

  try {
    const [myGames, theirGames] = await Promise.all([
      fetchRecentGames(me.chesscomUsername),
      fetchRecentGames(username),
    ]);
    const myDna = computeOpeningDna(myGames, me.chesscomUsername);
    const theirDna = computeOpeningDna(theirGames, username);

    const prompt = [
      "You are a chess coach comparing two friends' opening repertoires from their recent Chess.com games.",
      "Write a short, punchy comparison (3-4 sentences) addressed to the first player.",
      "Call out each player's biggest weapon, any shared openings where one clearly outscores the other, and one concrete suggestion.",
      "No greetings, no markdown, plain text only.",
      "",
      describeDna(me.chesscomUsername, myDna),
      "",
      describeDna(username, theirDna),
    ].join("\n");

    const narrative = await generateText(prompt);
    res.json({ narrative });
  } catch {
    res.status(502).json({ error: "Comparison failed" });
  }
});

export default router;
