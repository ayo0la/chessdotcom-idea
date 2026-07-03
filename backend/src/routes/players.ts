import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { fetchPlayerRatings } from "../chesscom.js";
import { db } from "../db.js";
import { fetchRecentGames } from "../services/analysis/pgn-fetcher.js";
import { computeOpeningDna } from "../services/analysis/opening-dna.js";
import { computeStyleProfile } from "../services/analysis/style-classifier.js";

const STYLE_TTL_MS = 24 * 60 * 60 * 1000;

const router = Router();

router.get("/:username/style", async (req, res) => {
  const username = req.params.username.toLowerCase();
  const user = await db.user.findUnique({
    where: { chesscomUsername: username },
  });

  if (
    user?.styleProfile &&
    user.styleComputedAt &&
    Date.now() - user.styleComputedAt.getTime() < STYLE_TTL_MS
  ) {
    res.json(user.styleProfile);
    return;
  }

  try {
    const games = await fetchRecentGames(username);
    const profile = computeStyleProfile(games, username);
    if (!profile) {
      res.status(404).json({ error: "Not enough games to analyze" });
      return;
    }
    if (user) {
      await db.user.update({
        where: { id: user.id },
        data: {
          styleProfile: profile as unknown as Prisma.InputJsonValue,
          styleComputedAt: new Date(),
        },
      });
    }
    res.json(profile);
  } catch {
    res.status(502).json({ error: "Could not fetch game history" });
  }
});

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
