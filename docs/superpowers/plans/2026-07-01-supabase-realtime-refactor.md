# Supabase Realtime Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the custom WebSocket server + Redis infrastructure with Supabase Realtime so the app deploys fully serverless (Vercel frontend + Vercel backend API + Supabase DB + cron-job.org polling trigger) with zero always-on server requirements and no credit card.

**Architecture:** The Express REST API becomes a stateless Vercel serverless function. The background polling job becomes a protected `POST /poll` endpoint triggered by cron-job.org every 2 minutes. When the poller upserts a Rating row in Supabase PostgreSQL, Supabase Realtime automatically broadcasts the change to all subscribed frontend clients — no explicit WebSocket fan-out needed.

**Tech Stack:** Express 4 + TypeScript (deployed on Vercel via `@vercel/node`), Prisma 5 + Supabase PostgreSQL, Supabase Realtime (`@supabase/supabase-js` on frontend), `cookie-session` (replaces `express-session` + `connect-redis`), cron-job.org (external HTTP cron trigger), React 18 + Vite 5 + Tailwind on Vercel

## Global Constraints

- TypeScript strict mode in both services — no `any` except where mocks require it
- Vitest for all tests; TDD — write failing test first, watch it fail, then implement
- Commit prefix: `refactor:` for infrastructure changes, `feat:` for new files, `test:` for test-only changes
- No Claude co-author lines, no AI attribution in any commit message, code, or comment
- `cookie-session` replaces `express-session` entirely — no `express-session` import anywhere after Task 1
- All Redis imports (`ioredis`, `connect-redis`) removed after Task 1
- All `ws` (WebSocket) imports removed after Task 2
- Supabase Realtime requires `REPLICA IDENTITY FULL` on the `Rating` table and the table added to `supabase_realtime` publication — document in plan but this is a manual Supabase dashboard step, not code
- `LeaderboardEntry` must include `userId: string` after Task 1 (needed by frontend Realtime filter)

---

## File Map

### Deleted
- `backend/src/redis.ts` — Redis client (Task 1)
- `backend/src/connections.ts` — WebSocket connection map (Task 1)
- `backend/tests/websocket.test.ts` — tests connections.ts (Task 1)
- `frontend/tests/useWebSocket.test.ts` and `frontend/tests/useWebSocket.test.js` — (Task 3)
- `frontend/src/hooks/useWebSocket.ts` and `frontend/src/hooks/useWebSocket.js` — (Task 3)

### Modified — Backend
- `backend/src/session.ts` — replace connect-redis/express-session with cookie-session (Task 1)
- `backend/src/routes/auth.ts` — replace `req.session.destroy()` with `req.session = null` (Task 1)
- `backend/src/routes/leaderboard.ts` — replace Redis sorted set read with Prisma join query; add `userId` to response (Task 1)
- `backend/src/routes/follows.ts` — remove all `redis.zadd`, `redis.zrem`, `getConnection`, WebSocket notification code (Task 1)
- `backend/tests/leaderboard.test.ts` — remove Redis mock, replace with Prisma `follow.findMany` mock (Task 1)
- `backend/tests/follows.test.ts` — remove Redis mock and Redis assertions (Task 1)
- `backend/package.json` — remove `ws`, `ioredis`, `connect-redis`, `dotenv`; add `cookie-session`; add `@types/cookie-session` to devDependencies (Task 1)
- `backend/src/poller.ts` — remove Redis `zadd` and WebSocket fan-out; only updates Prisma DB (Task 2)
- `backend/src/index.ts` — local dev server only; imports `app` from `app.ts`; calls `app.listen()` (Task 2)
- `backend/tests/poller.test.ts` — remove Redis mock and WebSocket mock and assertions (Task 2)
- `backend/prisma/schema.prisma` — add `directUrl = env("DIRECT_URL")` to datasource (Task 2)

### Created — Backend
- `backend/src/app.ts` — Express app factory: session, routes, JSON middleware; exports `app` (Task 2)
- `backend/src/routes/cron.ts` — `POST /` handler; validates `X-Cron-Secret` header; calls `pollAllRatings()` (Task 2)
- `backend/api/index.ts` — Vercel entry point; imports and re-exports `app` from `../src/app.ts` (Task 2)
- `backend/vercel.json` — Vercel serverless config (Task 2)

### Modified — Frontend
- `frontend/src/api.ts` — add `userId: string` field to `LeaderboardEntry` interface (Task 3)
- `frontend/src/pages/Dashboard.tsx` — replace `useWebSocket` with `useRealtime(entries, tc, callback)` (Task 3)
- `frontend/package.json` — add `@supabase/supabase-js` (Task 3)

### Created — Frontend
- `frontend/src/lib/supabase.ts` — Supabase client singleton using `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (Task 3)
- `frontend/src/hooks/useRealtime.ts` — subscribes to `Rating` table `UPDATE` events filtered by `timeControl`; resolves `userId → username` via `entriesRef`; computes delta from `new.rating - old.rating` (Task 3)
- `frontend/tests/useRealtime.test.ts` — 4 tests covering subscribe, onUpdate callback, unknown userId filtering, and unmount cleanup (Task 3)

---

### Task 1: Remove Redis — session, leaderboard, follows, dependencies

**Files:**
- Modify: `backend/src/session.ts`
- Modify: `backend/src/routes/auth.ts`
- Modify: `backend/src/routes/leaderboard.ts`
- Modify: `backend/src/routes/follows.ts`
- Modify: `backend/package.json`
- Modify: `backend/tests/leaderboard.test.ts`
- Modify: `backend/tests/follows.test.ts`
- Delete: `backend/src/redis.ts`
- Delete: `backend/src/connections.ts`
- Delete: `backend/tests/websocket.test.ts`

**Interfaces:**
- Produces: `LeaderboardEntry` now includes `userId: string` (consumed by Task 3)
- Produces: `sessionParser` is now a `cookie-session` middleware (consumed by Task 2's `app.ts`)
- Produces: `follows.ts` and `leaderboard.ts` no longer import `../redis` or `../connections`

- [ ] **Step 1: Write failing leaderboard test (no Redis)**

Replace the entire contents of `backend/tests/leaderboard.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("../src/db", () => ({
  db: {
    user: { findUnique: vi.fn() },
    follow: { findMany: vi.fn() },
  },
}));
vi.mock("../src/middleware/requireSession", () => ({
  requireSession: (_req: any, _res: any, next: any) => next(),
}));

import { db } from "../src/db";
import leaderboardRouter from "../src/routes/leaderboard";

function buildApp(userId = "viewer1") {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).session = { userId };
    next();
  });
  app.use("/leaderboard", leaderboardRouter);
  return app;
}

beforeEach(() => vi.clearAllMocks());

describe("GET /leaderboard", () => {
  it("returns players ranked by rating descending with userId", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "viewer1",
      chesscomUsername: "gothamchess",
      claimed: true,
      createdAt: new Date(),
    } as any);
    vi.mocked(db.follow.findMany).mockResolvedValueOnce([
      {
        following: {
          id: "u1",
          chesscomUsername: "hikaru",
          ratings: [{ rating: 3100, wins: 500, losses: 100, draws: 50, timeControl: "blitz" }],
        },
      },
      {
        following: {
          id: "u2",
          chesscomUsername: "gothamchess",
          ratings: [{ rating: 2800, wins: 200, losses: 80, draws: 30, timeControl: "blitz" }],
        },
      },
    ] as any);

    const res = await request(buildApp()).get("/leaderboard?tc=blitz");

    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({ rank: 1, username: "hikaru", rating: 3100, userId: "u1" });
    expect(res.body[1]).toMatchObject({ rank: 2, username: "gothamchess", rating: 2800, userId: "u2" });
  });

  it("excludes followed players with no rating for the requested time control", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(null);
    vi.mocked(db.follow.findMany).mockResolvedValueOnce([
      { following: { id: "u1", chesscomUsername: "hikaru", ratings: [] } },
    ] as any);

    const res = await request(buildApp()).get("/leaderboard");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
```

- [ ] **Step 2: Run leaderboard test to confirm it fails**

```bash
cd backend && npm test -- --reporter=verbose tests/leaderboard.test.ts
```

Expected: FAIL — "redis is not defined" or similar import error.

- [ ] **Step 3: Write failing follows test (no Redis)**

Replace the entire contents of `backend/tests/follows.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("../src/chesscom", () => ({
  fetchPlayerExists: vi.fn(),
  fetchPlayerRatings: vi.fn(),
}));
vi.mock("../src/db", () => ({
  db: {
    user: { upsert: vi.fn(), findUnique: vi.fn() },
    follow: { upsert: vi.fn(), delete: vi.fn() },
    rating: { upsert: vi.fn() },
  },
}));
vi.mock("../src/middleware/requireSession", () => ({
  requireSession: (_req: any, _res: any, next: any) => next(),
}));

import { fetchPlayerExists, fetchPlayerRatings } from "../src/chesscom";
import { db } from "../src/db";
import followsRouter from "../src/routes/follows";

function buildApp(userId = "viewer1") {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).session = { userId };
    next();
  });
  app.use("/follows", followsRouter);
  return app;
}

beforeEach(() => vi.clearAllMocks());

describe("POST /follows/:username", () => {
  it("returns 404 when target does not exist on Chess.com", async () => {
    vi.mocked(fetchPlayerExists).mockResolvedValueOnce(false);
    const res = await request(buildApp()).post("/follows/nobody");
    expect(res.status).toBe(404);
  });

  it("creates follow (upsert) and seeds ratings into Postgres", async () => {
    vi.mocked(fetchPlayerExists).mockResolvedValueOnce(true);
    vi.mocked(fetchPlayerRatings).mockResolvedValueOnce([
      { timeControl: "blitz", rating: 3100, wins: 500, losses: 100, draws: 50 },
    ]);
    vi.mocked(db.user.upsert).mockResolvedValueOnce({
      id: "target1",
      chesscomUsername: "hikaru",
      claimed: false,
      createdAt: new Date(),
    } as any);
    vi.mocked(db.follow.upsert).mockResolvedValueOnce({} as any);
    vi.mocked(db.rating.upsert).mockResolvedValueOnce({} as any);

    const res = await request(buildApp()).post("/follows/hikaru");

    expect(res.status).toBe(201);
    expect(db.follow.upsert).toHaveBeenCalledWith({
      where: { followerId_followingId: { followerId: "viewer1", followingId: "target1" } },
      update: {},
      create: { followerId: "viewer1", followingId: "target1" },
    });
    expect(db.rating.upsert).toHaveBeenCalled();
  });

  it("returns 201 on duplicate follow (idempotent)", async () => {
    vi.mocked(fetchPlayerExists).mockResolvedValueOnce(true);
    vi.mocked(fetchPlayerRatings).mockResolvedValueOnce([]);
    vi.mocked(db.user.upsert).mockResolvedValueOnce({
      id: "target1",
      chesscomUsername: "hikaru",
      claimed: false,
      createdAt: new Date(),
    } as any);
    vi.mocked(db.follow.upsert).mockResolvedValueOnce({} as any);

    const res = await request(buildApp()).post("/follows/hikaru");
    expect(res.status).toBe(201);
  });
});

describe("DELETE /follows/:username", () => {
  it("returns 404 when target player is not in DB", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValueOnce(null);
    const res = await request(buildApp()).delete("/follows/ghost");
    expect(res.status).toBe(404);
  });

  it("deletes the follow relationship and returns 204", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValueOnce({
      id: "target1",
      chesscomUsername: "hikaru",
      claimed: false,
      createdAt: new Date(),
    } as any);
    vi.mocked(db.follow.delete).mockResolvedValueOnce({} as any);

    const res = await request(buildApp()).delete("/follows/hikaru");
    expect(res.status).toBe(204);
    expect(db.follow.delete).toHaveBeenCalledWith({
      where: {
        followerId_followingId: { followerId: "viewer1", followingId: "target1" },
      },
    });
  });
});
```

- [ ] **Step 4: Run follows test to confirm it fails**

```bash
cd backend && npm test -- --reporter=verbose tests/follows.test.ts
```

Expected: FAIL — Redis import error or assertion mismatch.

- [ ] **Step 5: Install cookie-session and remove Redis packages**

```bash
cd backend
npm install cookie-session
npm install --save-dev @types/cookie-session
npm uninstall ws ioredis connect-redis dotenv
npm uninstall --save-dev @types/ws
```

- [ ] **Step 6: Replace session.ts with cookie-session**

Replace the entire contents of `backend/src/session.ts`:

```typescript
import cookieSession from "cookie-session";

export const sessionParser = cookieSession({
  name: "session",
  secret: process.env.SESSION_SECRET ?? "dev_secret",
  maxAge: 7 * 24 * 60 * 60 * 1000,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
});

declare module "express-serve-static-core" {
  interface Request {
    session: { userId?: string } & Record<string, unknown>;
  }
}
```

- [ ] **Step 7: Update auth.ts — replace session.destroy() with cookie-session clear**

Replace line `req.session.destroy(() => { res.status(204).end(); });` in `backend/src/routes/auth.ts`:

```typescript
router.delete("/session", (req, res) => {
  req.session = null as any;
  res.status(204).end();
});
```

- [ ] **Step 8: Replace leaderboard.ts with Prisma join query**

Replace the entire contents of `backend/src/routes/leaderboard.ts`:

```typescript
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
```

- [ ] **Step 9: Update follows.ts — remove all Redis and WebSocket code**

Replace the entire contents of `backend/src/routes/follows.ts`:

```typescript
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

  await db.follow.delete({
    where: {
      followerId_followingId: { followerId: viewerId, followingId: target.id },
    },
  });

  res.status(204).end();
});

export default router;
```

- [ ] **Step 10: Delete redis.ts, connections.ts, websocket.test.ts**

```bash
rm backend/src/redis.ts
rm backend/src/connections.ts
rm backend/tests/websocket.test.ts
```

- [ ] **Step 11: Run all backend tests to confirm leaderboard + follows pass**

```bash
cd backend && npm test -- --reporter=verbose
```

Expected: leaderboard.test.ts PASS (2 tests), follows.test.ts PASS (4 tests). Other tests should still pass. websocket.test.ts is gone.

- [ ] **Step 12: Commit**

```bash
git add backend/src/session.ts backend/src/routes/auth.ts backend/src/routes/leaderboard.ts \
        backend/src/routes/follows.ts backend/package.json backend/package-lock.json \
        backend/tests/leaderboard.test.ts backend/tests/follows.test.ts
git rm backend/src/redis.ts backend/src/connections.ts backend/tests/websocket.test.ts
git commit -m "refactor: remove Redis + WebSocket, leaderboard via Prisma, cookie-session"
```

---

### Task 2: Refactor poller + Extract app for Vercel deployment

**Files:**
- Modify: `backend/src/poller.ts`
- Modify: `backend/src/index.ts`
- Modify: `backend/tests/poller.test.ts`
- Modify: `backend/prisma/schema.prisma`
- Modify: `backend/package.json` (update start script)
- Create: `backend/src/app.ts`
- Create: `backend/src/routes/cron.ts`
- Create: `backend/api/index.ts`
- Create: `backend/vercel.json`

**Interfaces:**
- Consumes: `sessionParser` from `./session.ts` (cookie-session, Task 1)
- Produces: `app` exported from `backend/src/app.ts` — consumed by `backend/src/index.ts` (local dev) and `backend/api/index.ts` (Vercel)
- Produces: `POST /poll` endpoint protected by `X-Cron-Secret` header — called by cron-job.org

- [ ] **Step 1: Write failing poller test (no Redis, no WebSocket)**

Replace the entire contents of `backend/tests/poller.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/db", () => ({
  db: {
    user: { findMany: vi.fn() },
    rating: { upsert: vi.fn() },
  },
}));
vi.mock("../src/chesscom", () => ({
  fetchPlayerRatings: vi.fn(),
}));

import { db } from "../src/db";
import { fetchPlayerRatings } from "../src/chesscom";
import { pollAllRatings } from "../src/poller";

const fakeUser = {
  id: "user1",
  chesscomUsername: "hikaru",
  claimed: true,
  createdAt: new Date(),
  ratings: [
    {
      id: "r1",
      userId: "user1",
      timeControl: "blitz",
      rating: 3100,
      wins: 500,
      losses: 100,
      draws: 50,
      updatedAt: new Date(),
    },
  ],
};

beforeEach(() => vi.clearAllMocks());

describe("pollAllRatings", () => {
  it("upserts Postgres rating when rating has changed", async () => {
    vi.mocked(db.user.findMany).mockResolvedValueOnce([fakeUser] as any);
    vi.mocked(fetchPlayerRatings).mockResolvedValueOnce([
      { timeControl: "blitz", rating: 3112, wins: 501, losses: 100, draws: 50 },
    ]);
    vi.mocked(db.rating.upsert).mockResolvedValueOnce({} as any);

    await pollAllRatings();

    expect(db.rating.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_timeControl: { userId: "user1", timeControl: "blitz" },
        },
        update: expect.objectContaining({ rating: 3112 }),
      })
    );
  });

  it("skips upsert when rating has not changed", async () => {
    vi.mocked(db.user.findMany).mockResolvedValueOnce([fakeUser] as any);
    vi.mocked(fetchPlayerRatings).mockResolvedValueOnce([
      { timeControl: "blitz", rating: 3100, wins: 500, losses: 100, draws: 50 },
    ]);

    await pollAllRatings();

    expect(db.rating.upsert).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run poller test to confirm it fails**

```bash
cd backend && npm test -- --reporter=verbose tests/poller.test.ts
```

Expected: FAIL — Redis import error or unused mock assertion.

- [ ] **Step 3: Update poller.ts — remove Redis and WebSocket fan-out**

Replace the entire contents of `backend/src/poller.ts`:

```typescript
import { db } from "./db.js";
import { fetchPlayerRatings } from "./chesscom.js";

export async function pollAllRatings(): Promise<void> {
  const users = await db.user.findMany({ include: { ratings: true } });

  for (const user of users) {
    const latest = await fetchPlayerRatings(user.chesscomUsername);

    for (const l of latest) {
      const cached = user.ratings.find((r) => r.timeControl === l.timeControl);
      if (cached && cached.rating === l.rating) continue;

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
  }
}
```

Note: `startPoller` is intentionally removed. The cron endpoint replaces it.

- [ ] **Step 4: Run poller test to confirm it passes**

```bash
cd backend && npm test -- --reporter=verbose tests/poller.test.ts
```

Expected: PASS (2 tests).

- [ ] **Step 5: Create app.ts — stateless Express app**

Create `backend/src/app.ts`:

```typescript
import express from "express";
import { sessionParser } from "./session.js";
import authRouter from "./routes/auth.js";
import meRouter from "./routes/me.js";
import playersRouter from "./routes/players.js";
import followsRouter from "./routes/follows.js";
import leaderboardRouter from "./routes/leaderboard.js";
import cronRouter from "./routes/cron.js";

export const app = express();

app.use(express.json());
app.use(sessionParser);
app.use("/auth", authRouter);
app.use("/me", meRouter);
app.use("/players", playersRouter);
app.use("/follows", followsRouter);
app.use("/leaderboard", leaderboardRouter);
app.use("/poll", cronRouter);
```

- [ ] **Step 6: Update index.ts — local dev server only**

Replace the entire contents of `backend/src/index.ts`:

```typescript
import "dotenv/config";
import { app } from "./app.js";

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

- [ ] **Step 7: Create routes/cron.ts — polling endpoint**

Create `backend/src/routes/cron.ts`:

```typescript
import { Router } from "express";
import { pollAllRatings } from "../poller.js";

const router = Router();

router.post("/", async (req, res) => {
  const secret = req.headers["x-cron-secret"];
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  await pollAllRatings();
  res.json({ ok: true });
});

export default router;
```

- [ ] **Step 8: Create api/index.ts — Vercel entry point**

Create `backend/api/index.ts`:

```typescript
import "../src/app.js";
import { app } from "../src/app.js";

export default app;
```

Wait — the above double-imports. Use:

```typescript
import { app } from "../src/app.js";
export default app;
```

- [ ] **Step 9: Create vercel.json — Vercel deployment config**

Create `backend/vercel.json`:

```json
{
  "version": 2,
  "builds": [{ "src": "api/index.ts", "use": "@vercel/node" }],
  "routes": [{ "src": "/(.*)", "dest": "/api/index.ts" }]
}
```

- [ ] **Step 10: Update schema.prisma — add directUrl for Supabase**

Edit `backend/prisma/schema.prisma`, replace the datasource block:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

- [ ] **Step 11: Update backend package.json start script**

In `backend/package.json`, update the `start` script:

```json
"start": "npx prisma migrate deploy && node dist/index.js"
```

Keep this for any non-Vercel deployment fallback. The Vercel deployment uses `api/index.ts` directly via `@vercel/node`, which compiles TypeScript without needing `dist/`.

Also add `dotenv` back to dependencies since `src/index.ts` (local dev) still uses it:

```bash
cd backend && npm install dotenv
```

- [ ] **Step 12: Run full backend test suite**

```bash
cd backend && npm test -- --reporter=verbose
```

Expected: all remaining tests pass (auth, chesscom, db, follows, leaderboard, me/players, poller). Total should be ~19 passing.

- [ ] **Step 13: Commit**

```bash
git add backend/src/app.ts backend/src/index.ts backend/src/poller.ts \
        backend/src/routes/cron.ts backend/api/index.ts backend/vercel.json \
        backend/prisma/schema.prisma backend/tests/poller.test.ts \
        backend/package.json backend/package-lock.json
git commit -m "refactor: extract app.ts for Vercel, polling endpoint, remove startPoller"
```

---

### Task 3: Frontend Supabase Realtime

**Files:**
- Modify: `frontend/src/api.ts`
- Modify: `frontend/src/pages/Dashboard.tsx`
- Modify: `frontend/package.json`
- Create: `frontend/src/lib/supabase.ts`
- Create: `frontend/src/hooks/useRealtime.ts`
- Create: `frontend/tests/useRealtime.test.ts`
- Delete: `frontend/src/hooks/useWebSocket.ts` and `frontend/src/hooks/useWebSocket.js`
- Delete: `frontend/tests/useWebSocket.test.ts` and `frontend/tests/useWebSocket.test.js`

**Interfaces:**
- Consumes: `LeaderboardEntry` with `userId: string` (produced by Task 1's leaderboard route)
- Consumes: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` env vars
- Produces: `useRealtime(entries, activeTab, onUpdate)` hook — consumed by `Dashboard.tsx`

**Supabase Realtime manual setup (not code — do this in Supabase dashboard after project creation):**
```sql
-- Enable full row data in change events (required to get old.rating for delta calculation)
ALTER TABLE "Rating" REPLICA IDENTITY FULL;

-- Add Rating table to Supabase Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE "Rating";
```

- [ ] **Step 1: Write failing useRealtime tests**

Create `frontend/tests/useRealtime.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useRealtime } from "../src/hooks/useRealtime";
import type { LeaderboardEntry } from "../src/api";

const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis(),
};

vi.mock("../src/lib/supabase", () => ({
  supabase: {
    channel: vi.fn().mockReturnValue(mockChannel),
    removeChannel: vi.fn(),
  },
}));

import { supabase } from "../src/lib/supabase";

const mockEntries: LeaderboardEntry[] = [
  {
    rank: 1,
    userId: "u1",
    username: "hikaru",
    rating: 3100,
    wins: 500,
    losses: 100,
    draws: 50,
    isMe: false,
  },
];

beforeEach(() => vi.clearAllMocks());

describe("useRealtime", () => {
  it("subscribes to Rating changes on mount for the active tab", () => {
    renderHook(() => useRealtime(mockEntries, "blitz", vi.fn()));

    expect(supabase.channel).toHaveBeenCalledWith("ratings-blitz");
    expect(mockChannel.on).toHaveBeenCalledWith(
      "postgres_changes",
      expect.objectContaining({ event: "UPDATE", table: "Rating", filter: "timeControl=eq.blitz" }),
      expect.any(Function)
    );
    expect(mockChannel.subscribe).toHaveBeenCalled();
  });

  it("calls onUpdate with username, delta, and new rating when a matching userId changes", () => {
    const onUpdate = vi.fn();
    renderHook(() => useRealtime(mockEntries, "blitz", onUpdate));

    const pgChangeCallback = vi.mocked(mockChannel.on).mock.calls[0][2] as Function;
    pgChangeCallback({
      new: { userId: "u1", timeControl: "blitz", rating: 3112 },
      old: { rating: 3100 },
    });

    expect(onUpdate).toHaveBeenCalledWith({
      userId: "u1",
      username: "hikaru",
      timeControl: "blitz",
      rating: 3112,
      delta: 12,
    });
  });

  it("ignores updates for userIds not in the entries list", () => {
    const onUpdate = vi.fn();
    renderHook(() => useRealtime(mockEntries, "blitz", onUpdate));

    const pgChangeCallback = vi.mocked(mockChannel.on).mock.calls[0][2] as Function;
    pgChangeCallback({
      new: { userId: "unknown-user", timeControl: "blitz", rating: 9999 },
      old: { rating: 9900 },
    });

    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("removes the channel subscription on unmount", () => {
    const { unmount } = renderHook(() => useRealtime(mockEntries, "blitz", vi.fn()));
    unmount();
    expect(supabase.removeChannel).toHaveBeenCalledWith(mockChannel);
  });
});
```

- [ ] **Step 2: Run useRealtime tests to confirm they fail**

```bash
cd frontend && npm test -- --reporter=verbose tests/useRealtime.test.ts
```

Expected: FAIL — "Cannot find module '../src/hooks/useRealtime'".

- [ ] **Step 3: Install Supabase JS client**

```bash
cd frontend && npm install @supabase/supabase-js
```

- [ ] **Step 4: Create frontend/src/lib/supabase.ts**

```typescript
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

- [ ] **Step 5: Create frontend/src/hooks/useRealtime.ts**

```typescript
import { useEffect, useRef } from "react";
import { supabase } from "../lib/supabase.js";
import type { LeaderboardEntry } from "../api.js";

export interface RatingUpdate {
  userId: string;
  username: string;
  timeControl: string;
  rating: number;
  delta: number;
}

export function useRealtime(
  entries: LeaderboardEntry[],
  activeTab: string,
  onUpdate: (update: RatingUpdate) => void
): void {
  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    const channel = supabase
      .channel(`ratings-${activeTab}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "Rating",
          filter: `timeControl=eq.${activeTab}`,
        },
        (payload) => {
          const newRow = payload.new as {
            userId: string;
            timeControl: string;
            rating: number;
          };
          const oldRow = payload.old as { rating?: number };
          const entry = entriesRef.current.find((e) => e.userId === newRow.userId);
          if (!entry) return;
          const delta = newRow.rating - (oldRow.rating ?? newRow.rating);
          onUpdateRef.current({
            userId: newRow.userId,
            username: entry.username,
            timeControl: newRow.timeControl,
            rating: newRow.rating,
            delta,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTab]);
}
```

- [ ] **Step 6: Run useRealtime tests to confirm they pass**

```bash
cd frontend && npm test -- --reporter=verbose tests/useRealtime.test.ts
```

Expected: PASS (4 tests).

- [ ] **Step 7: Add userId to LeaderboardEntry in api.ts**

In `frontend/src/api.ts`, update the `LeaderboardEntry` interface:

```typescript
export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
  isMe: boolean;
}
```

- [ ] **Step 8: Update Dashboard.tsx — replace useWebSocket with useRealtime**

Replace the entire contents of `frontend/src/pages/Dashboard.tsx`:

```typescript
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import TimeControlTabs, { type TimeControl } from "../components/TimeControlTabs";
import LeaderboardTable from "../components/LeaderboardTable";
import { useLeaderboard } from "../hooks/useLeaderboard";
import { useRealtime } from "../hooks/useRealtime";
import { getMe, unfollowPlayer, type UserSession } from "../api";

export default function Dashboard() {
  const navigate = useNavigate();
  const [tc, setTc] = useState<TimeControl>("blitz");
  const { entries, loading, update, remove } = useLeaderboard(tc);
  const [deltas, setDeltas] = useState<Record<string, number>>({});
  const [me, setMe] = useState<UserSession | null>(null);

  useEffect(() => {
    getMe()
      .then(setMe)
      .catch(() => navigate("/"));
  }, [navigate]);

  useRealtime(entries, tc, (ratingUpdate) => {
    update(ratingUpdate.username, ratingUpdate.rating);
    setDeltas((prev) => ({ ...prev, [ratingUpdate.username]: ratingUpdate.delta }));
    setTimeout(() => {
      setDeltas((prev) => {
        const next = { ...prev };
        delete next[ratingUpdate.username];
        return next;
      });
    }, 3000);
  });

  async function handleUnfollow(username: string) {
    await unfollowPlayer(username);
    remove(username);
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white px-4 py-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Leaderboard</h1>
          {me && (
            <p className="text-gray-400 text-sm mt-1">Signed in as {me.chesscomUsername}</p>
          )}
        </div>
        <Link to="/search" className="text-green-400 text-sm hover:underline">
          + Follow players
        </Link>
      </div>
      <TimeControlTabs active={tc} onChange={setTc} />
      {loading ? (
        <p className="text-gray-500 text-sm">Loading...</p>
      ) : entries.length === 0 ? (
        <p className="text-gray-500 text-sm">
          No players yet.{" "}
          <Link to="/search" className="text-green-400 hover:underline">
            Follow someone to get started.
          </Link>
        </p>
      ) : (
        <LeaderboardTable entries={entries} deltas={deltas} onUnfollow={handleUnfollow} />
      )}
    </main>
  );
}
```

- [ ] **Step 9: Delete useWebSocket files**

```bash
rm frontend/src/hooks/useWebSocket.ts
rm frontend/src/hooks/useWebSocket.js
rm frontend/tests/useWebSocket.test.ts
rm frontend/tests/useWebSocket.test.js
```

- [ ] **Step 10: Run full frontend test suite**

```bash
cd frontend && npm test -- --reporter=verbose
```

Expected: all tests pass. useRealtime: 4 tests. DeltaBadge: 2. LeaderboardTable: 2. Landing: 2. Total: ~10 passing. Zero failures.

- [ ] **Step 11: Build check**

```bash
cd frontend && npm run build
```

Expected: exit 0, `dist/` created, no TypeScript errors.

- [ ] **Step 12: Commit**

```bash
git add frontend/src/lib/supabase.ts frontend/src/hooks/useRealtime.ts \
        frontend/src/pages/Dashboard.tsx frontend/src/api.ts \
        frontend/package.json frontend/package-lock.json \
        frontend/tests/useRealtime.test.ts
git rm frontend/src/hooks/useWebSocket.ts frontend/src/hooks/useWebSocket.js \
        frontend/tests/useWebSocket.test.ts frontend/tests/useWebSocket.test.js
git commit -m "refactor: replace useWebSocket with Supabase Realtime subscription"
```

---

## Deployment Env Vars After Refactor

### Backend (Vercel — second Vercel project for `backend/`)
```
DATABASE_URL    = <Supabase pooler URL, e.g. postgresql://postgres.xxxxx:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true>
DIRECT_URL      = <Supabase direct URL, e.g. postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres>
SESSION_SECRET  = <any random 32-char string>
NODE_ENV        = production
CRON_SECRET     = <any random string — set same value in cron-job.org custom header>
```

### Frontend (existing Vercel project)
```
VITE_API_URL         = https://<backend-vercel-url>/api   (keep existing)
VITE_SUPABASE_URL    = https://xxxxx.supabase.co          (from Supabase project Settings → API)
VITE_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  (from Supabase project Settings → API)
```

Remove: `VITE_WS_URL` — no longer needed.

### cron-job.org setup
- URL: `https://<backend-vercel-url>/poll`
- Method: POST
- Schedule: every 2 minutes (`*/2 * * * *`)
- Custom header: `X-Cron-Secret: <same value as CRON_SECRET>`

### Supabase manual steps (SQL editor in Supabase dashboard)
```sql
-- Required: send full row data in change events so old.rating is available for delta calc
ALTER TABLE "Rating" REPLICA IDENTITY FULL;

-- Required: add Rating table to Supabase Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE "Rating";
```
