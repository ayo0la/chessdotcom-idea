import { Router } from "express";
import { db } from "../db.js";
import { requireSession } from "../middleware/requireSession.js";

const router = Router();
router.use(requireSession);

router.get("/", async (req, res) => {
  const tc = (req.query.tc as string) || "blitz";
  const viewerId = req.session.userId!;

  const viewer = await db.user.findUnique({ where: { id: viewerId } });

  const follows = await db.follow.findMany({
    where: { followerId: viewerId },
    include: {
      following: {
        include: {
          ratings: { where: { timeControl: tc } },
        },
      },
    },
  });

  const entries = follows
    .filter((f) => f.following.ratings.length > 0)
    .map((f) => ({
      userId: f.following.id,
      username: f.following.chesscomUsername,
      rating: f.following.ratings[0].rating,
      wins: f.following.ratings[0].wins,
      losses: f.following.ratings[0].losses,
      draws: f.following.ratings[0].draws,
      isMe: viewer?.chesscomUsername === f.following.chesscomUsername,
    }))
    .sort((a, b) => b.rating - a.rating)
    .map((e, idx) => ({ ...e, rank: idx + 1 }));

  res.json(entries);
});

export default router;
