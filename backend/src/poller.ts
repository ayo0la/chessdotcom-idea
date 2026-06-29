import { db } from "./db.js";
import { redis } from "./redis.js";
import { fetchPlayerRatings } from "./chesscom.js";
import { getConnection } from "./connections.js";
import { WebSocket } from "ws";

export async function pollAllRatings(): Promise<void> {
  const users = await db.user.findMany({ include: { ratings: true } });

  for (const user of users) {
    const latest = await fetchPlayerRatings(user.chesscomUsername);

    for (const l of latest) {
      const cached = user.ratings.find((r) => r.timeControl === l.timeControl);
      if (cached && cached.rating === l.rating) continue;

      const delta = cached ? l.rating - cached.rating : 0;

      await db.rating.upsert({
        where: {
          userId_timeControl: {
            userId: user.id,
            timeControl: l.timeControl,
          },
        },
        update: {
          rating: l.rating,
          wins: l.wins,
          losses: l.losses,
          draws: l.draws,
        },
        create: { userId: user.id, ...l },
      });

      const followers = await db.follow.findMany({
        where: { followingId: user.id },
      });

      for (const follow of followers) {
        await redis.zadd(
          `leaderboard:${follow.followerId}:${l.timeControl}`,
          l.rating,
          user.chesscomUsername
        );

        const ws = getConnection(follow.followerId);
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: "rating_update",
              username: user.chesscomUsername,
              timeControl: l.timeControl,
              rating: l.rating,
              delta,
            })
          );
        }
      }
    }
  }
}

export function startPoller(intervalMs = 120_000): NodeJS.Timeout {
  return setInterval(pollAllRatings, intervalMs);
}
