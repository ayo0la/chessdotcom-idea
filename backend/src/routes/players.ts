import { Router } from "express";
import { fetchPlayerRatings } from "../chesscom.js";
import { db } from "../db.js";
import { fetchRecentGames } from "../services/analysis/pgn-fetcher.js";
import { computeOpeningDna } from "../services/analysis/opening-dna.js";

const router = Router();

router.get("/:username/openings", async (req, res) => {
  const username = req.params.username.toLowerCase();
  try {
    const games = await fetchRecentGames(username);
    const dna = computeOpeningDna(games, username);
    res.json({
      username,
      totalGames: dna.totalGames,
      openings: dna.openings.slice(0, 10),
    });
  } catch {
    res.status(502).json({ error: "Could not fetch game history" });
  }
});

router.get("/:username", async (req, res) => {
  const { username } = req.params;

  const user = await db.user.findUnique({
    where: { chesscomUsername: username.toLowerCase() },
    include: { ratings: true },
  });

  if (user?.ratings.length) {
    res.json({ username: user.chesscomUsername, ratings: user.ratings });
    return;
  }

  const ratings = await fetchPlayerRatings(username.toLowerCase());
  res.json({ username: username.toLowerCase(), ratings });
});

export default router;
