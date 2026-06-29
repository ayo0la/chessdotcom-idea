import { Router } from "express";
import { WebSocket } from "ws";
import { db } from "../db.js";
import { redis } from "../redis.js";
import { requireSession } from "../middleware/requireSession.js";
import { getConnection } from "../connections.js";
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

  // Fix 2: use upsert so duplicate follows return 201 instead of throwing P2002
  await db.follow.upsert({
    where: { followerId_followingId: { followerId: viewerId, followingId: target.id } },
    update: {},
    create: { followerId: viewerId, followingId: target.id },
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

  // Fix 6: notify the followed player if they are currently connected
  const viewerUser = await db.user.findUnique({ where: { id: viewerId } });
  const targetWs = getConnection(target.id);
  if (targetWs && targetWs.readyState === WebSocket.OPEN) {
    targetWs.send(
      JSON.stringify({ type: "friend_joined", username: viewerUser?.chesscomUsername })
    );
  }

  res.status(201).json({ following: username.toLowerCase() });
});

router.delete("/:username", async (req, res) => {
  const { username } = req.params;
  const viewerId = req.session.userId!;

  // Fix 4: use findUnique so we 404 instead of creating a phantom user
  const target = await db.user.findUnique({
    where: { chesscomUsername: username.toLowerCase() },
  });
  if (!target) {
    res.status(404).json({ error: "Player not found" });
    return;
  }

  await db.follow.delete({
    where: {
      followerId_followingId: {
        followerId: viewerId,
        followingId: target.id,
      },
    },
  });

  // Fix 1: remove player from all four leaderboard sorted sets in Redis
  const TCS = ["bullet", "blitz", "rapid", "classical"];
  await Promise.all(
    TCS.map((tc) =>
      redis.zrem(`leaderboard:${viewerId}:${tc}`, username.toLowerCase())
    )
  );

  res.status(204).end();
});

export default router;
