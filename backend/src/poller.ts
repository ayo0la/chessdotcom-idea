import { db } from "./db.js";
import { fetchPlayerRatings } from "./chesscom.js";
import { checkTiltForUser } from "./services/analysis/tilt-detector.js";

export async function pollAllRatings(): Promise<void> {
  const users = await db.user.findMany({ include: { ratings: true } });

  for (const user of users) {
    const latest = await fetchPlayerRatings(user.chesscomUsername);
    let lossesIncreased = false;

    for (const l of latest) {
      const cached = user.ratings.find((r) => r.timeControl === l.timeControl);
      if (cached && cached.rating === l.rating) continue;
      if (cached && l.losses > cached.losses) lossesIncreased = true;

      await db.rating.upsert({
        where: {
          userId_timeControl: { userId: user.id, timeControl: l.timeControl },
        },
        update: {
          rating: l.rating,
          wins: l.wins,
          losses: l.losses,
          draws: l.draws,
        },
        create: { userId: user.id, ...l },
      });
      // Supabase Realtime pushes DB changes to subscribed frontend clients automatically
    }

    if (lossesIncreased) {
      try {
        await checkTiltForUser(user);
      } catch {
        // tilt analysis is best-effort; never fail the poll over it
      }
    }
  }
}
