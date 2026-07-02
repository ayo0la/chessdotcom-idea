import { Router } from "express";
import { db } from "../db.js";
import { requireSession } from "../middleware/requireSession.js";
import { fetchPlayerExists, fetchPlayerRatings } from "../chesscom.js";

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

  await db.follow.upsert({
    where: {
      followerId_followingId: { followerId: viewerId, followingId: target.id },
    },
    update: {},
    create: { followerId: viewerId, followingId: target.id },
  });

  const ratings = await fetchPlayerRatings(username.toLowerCase());

  await Promise.all(
    ratings.map((r) =>
      db.rating.upsert({
        where: {
          userId_timeControl: { userId: target.id, timeControl: r.timeControl },
        },
        update: { rating: r.rating, wins: r.wins, losses: r.losses, draws: r.draws },
        create: { userId: target.id, ...r },
      })
    )
  );

  res.status(201).json({ following: username.toLowerCase() });
});

router.delete("/:username", async (req, res) => {
  const { username } = req.params;
  const viewerId = req.session.userId!;

  const target = await db.user.findUnique({
    where: { chesscomUsername: username.toLowerCase() },
  });
  if (!target) {
    res.status(404).json({ error: "Player not found" });
    return;
  }

  try {
    await db.follow.delete({
      where: {
        followerId_followingId: { followerId: viewerId, followingId: target.id },
      },
    });
  } catch (err: any) {
    if (err?.code !== "P2025") throw err;
  }
  res.status(204).end();
});

export default router;
