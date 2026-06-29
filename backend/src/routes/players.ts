import { Router } from "express";
import { fetchPlayerRatings } from "../chesscom.js";
import { db } from "../db.js";

const router = Router();

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
