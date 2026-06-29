import { Router } from "express";
import { db } from "../db.js";
import { redis } from "../redis.js";
import { requireSession } from "../middleware/requireSession.js";

const router = Router();
router.use(requireSession);

router.get("/", async (req, res) => {
  const tc = (req.query.tc as string) || "blitz";
  const viewerId = req.session.userId!;

  const viewer = await db.user.findUnique({ where: { id: viewerId } });

  const raw = await redis.zrevrangebyscore(
    `leaderboard:${viewerId}:${tc}`,
    "+inf",
    "-inf",
    "WITHSCORES"
  );

  const pairs: Array<{ username: string; rating: number }> = [];
  for (let i = 0; i < raw.length; i += 2) {
    pairs.push({ username: raw[i], rating: parseInt(raw[i + 1]) });
  }

  const ratings = await db.rating.findMany({
    where: {
      timeControl: tc,
      user: { chesscomUsername: { in: pairs.map((p) => p.username) } },
    },
    include: { user: true },
  });

  const result = pairs.map((p, idx) => {
    const ratingRow = ratings.find((r) => r.user.chesscomUsername === p.username);
    return {
      rank: idx + 1,
      username: p.username,
      rating: p.rating,
      wins: ratingRow?.wins ?? 0,
      losses: ratingRow?.losses ?? 0,
      draws: ratingRow?.draws ?? 0,
      isMe: viewer?.chesscomUsername === p.username,
    };
  });

  res.json(result);
});

export default router;
