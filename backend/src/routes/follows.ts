import { Router } from "express";
import { db } from "../db.js";
import { redis } from "../redis.js";
import { requireSession } from "../middleware/requireSession.js";
import {
  fetchPlayerExists,
  fetchPlayerRatings,
} from "../chesscom.js";

const router = Router();
router.use(requireSession);

router.post("/:username", async (req, res) => {
  const { username } = req.params;
  const viewerId = req.session.userId!;

  const exists = await fetchPlayerExists(username.toLowerCase());
  if (!exists) {
    res.status(404).json({ error: "Chess.com username not found" });
    return;
  }

  const target = await db.user.upsert({
    where: { chesscomUsername: username.toLowerCase() },
    update: {},
    create: { chesscomUsername: username.toLowerCase(), claimed: false },
  });

  await db.follow.create({
    data: { followerId: viewerId, followingId: target.id },
  });

  const ratings = await fetchPlayerRatings(username.toLowerCase());

  await Promise.all(
    ratings.map(async (r) => {
      await db.rating.upsert({
        where: {
          userId_timeControl: {
            userId: target.id,
            timeControl: r.timeControl,
          },
        },
        update: {
          rating: r.rating,
          wins: r.wins,
          losses: r.losses,
          draws: r.draws,
        },
        create: { userId: target.id, ...r },
      });
      await redis.zadd(
        `leaderboard:${viewerId}:${r.timeControl}`,
        r.rating,
        username.toLowerCase()
      );
    })
  );

  res.status(201).json({ following: username.toLowerCase() });
});

router.delete("/:username", async (req, res) => {
  const { username } = req.params;
  const viewerId = req.session.userId!;

  const target = await db.user.upsert({
    where: { chesscomUsername: username.toLowerCase() },
    update: {},
    create: { chesscomUsername: username.toLowerCase(), claimed: false },
  });

  await db.follow.delete({
    where: {
      followerId_followingId: {
        followerId: viewerId,
        followingId: target.id,
      },
    },
  });

  res.status(204).end();
});

export default router;
