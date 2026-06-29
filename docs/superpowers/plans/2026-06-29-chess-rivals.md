# Chess Rivals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real-time Chess.com friend leaderboard that tracks ratings across a follow network and pushes live delta badges over WebSocket.

**Architecture:** Separate Express backend and React/Vite frontend in a monorepo. The backend runs a polling job every 2 minutes against the Chess.com public API, detects rating deltas, updates Redis Sorted Sets, and fans out via an in-memory WebSocket connection map to connected clients. The frontend opens a persistent WebSocket connection on the dashboard and updates the leaderboard in place without a page reload.

**Tech Stack:** Express 4, TypeScript 5, ws, ioredis, Prisma 5 + PostgreSQL, express-session + connect-redis, React 18, Vite 5, Tailwind CSS 3, Vitest 1

## Global Constraints

- TypeScript strict mode in both services (`"strict": true` in tsconfig)
- Vitest for all tests — backend and frontend
- TDD: write failing test first, then implement
- Polling interval: 120 000 ms (2 minutes)
- Chess.com public API base: `https://api.chess.com/pub`
- Time controls: `"bullet" | "blitz" | "rapid" | "classical"` (maps to `chess_bullet`, `chess_blitz`, `chess_rapid`, `chess_daily` in Chess.com API)
- Session cookie: `httpOnly: true`, `secure: false` (local dev), 7-day maxAge
- WebSocket connections tracked in-memory (`Map<userId, WebSocket>`) — not Redis
- Redis key pattern for leaderboards: `leaderboard:{viewerUserId}:{timeControl}`
- Dark Tailwind theme throughout frontend
- Commits follow: `feat:`, `test:`, `chore:` prefixes

---

## File Structure

```
chess-rivals/
  backend/
    prisma/
      schema.prisma
    src/
      index.ts             Express app + HTTP server + WebSocket server + poller start
      db.ts                Prisma client singleton
      redis.ts             ioredis client singletons (publisher + subscriber)
      session.ts           express-session middleware configured with Redis store
      connections.ts       In-memory Map<userId, WebSocket> + helpers
      chesscom.ts          Chess.com API fetch wrapper + types
      poller.ts            Background polling job
      middleware/
        requireSession.ts  Auth guard middleware
      routes/
        auth.ts            POST /auth/claim, DELETE /auth/session
        me.ts              GET /me
        players.ts         GET /players/:username
        follows.ts         POST /follows/:username, DELETE /follows/:username
        leaderboard.ts     GET /leaderboard?tc=blitz
    tests/
      chesscom.test.ts
      poller.test.ts
      leaderboard.test.ts
      follows.test.ts
      websocket.test.ts
    .env.example
    package.json
    tsconfig.json
    vitest.config.ts
  frontend/
    src/
      main.tsx
      App.tsx
      api.ts               Typed fetch wrapper for backend REST API
      hooks/
        useWebSocket.ts    WebSocket hook with exponential-backoff reconnect
        useLeaderboard.ts  Leaderboard state + WebSocket integration
      pages/
        Landing.tsx        Claim username form
        Dashboard.tsx      Leaderboard page
        Search.tsx         Find + follow players
      components/
        LeaderboardTable.tsx  Ranked table rows
        DeltaBadge.tsx        Animated +/- rating badge (fades after 3 s)
        TimeControlTabs.tsx   Bullet/Blitz/Rapid/Classical tab strip
    tests/
      LeaderboardTable.test.tsx
      DeltaBadge.test.tsx
      useWebSocket.test.ts
    index.html
    package.json
    tsconfig.json
    vite.config.ts
    tailwind.config.js
    postcss.config.js
  docs/
    superpowers/
      specs/2026-06-29-chess-rivals-design.md
      plans/2026-06-29-chess-rivals.md
```

---

### Task 1: Monorepo scaffold

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/vitest.config.ts`
- Create: `backend/.env.example`
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tailwind.config.js`
- Create: `frontend/postcss.config.js`
- Create: `frontend/index.html`

**Interfaces:**
- Produces: working `npm install` in both services, `npm test` runs (zero tests pass yet)

- [ ] **Step 1: Create `backend/package.json`**

```json
{
  "name": "chess-rivals-backend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@prisma/client": "^5.22.0",
    "connect-redis": "^7.1.1",
    "dotenv": "^16.4.0",
    "express": "^4.21.0",
    "express-session": "^1.18.0",
    "ioredis": "^5.3.2",
    "ws": "^8.18.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/express-session": "^1.18.0",
    "@types/node": "^20.17.0",
    "@types/ws": "^8.5.12",
    "prisma": "^5.22.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Create `backend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "dist",
    "rootDir": "src",
    "skipLibCheck": true
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 3: Create `backend/vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
  },
});
```

- [ ] **Step 4: Create `backend/.env.example`**

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/chess_rivals
REDIS_URL=redis://localhost:6379
SESSION_SECRET=change_me_in_production
PORT=3001
```

Copy to `.env` and fill in your values: `cp backend/.env.example backend/.env`

- [ ] **Step 5: Create `frontend/package.json`**

```json
{
  "name": "chess-rivals-frontend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.27.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.5.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.20",
    "jsdom": "^25.0.0",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.13",
    "typescript": "^5.6.0",
    "vite": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 6: Create `frontend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 7: Create `frontend/vite.config.ts`**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": "http://localhost:3001" } },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
  },
});
```

- [ ] **Step 8: Create `frontend/tests/setup.ts`**

```typescript
import "@testing-library/jest-dom";
```

- [ ] **Step 9: Create `frontend/tailwind.config.js`**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
```

- [ ] **Step 10: Create `frontend/postcss.config.js`**

```javascript
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
```

- [ ] **Step 11: Create `frontend/index.html`**

```html
<!doctype html>
<html lang="en" class="dark bg-gray-950 text-gray-100">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Chess Rivals</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 12: Install dependencies in both services**

```bash
cd backend && npm install
cd ../frontend && npm install
```

Expected: no errors, `node_modules` created in both.

- [ ] **Step 13: Commit**

```bash
git add backend/ frontend/
git commit -m "chore: monorepo scaffold — backend Express + frontend Vite"
```

---

### Task 2: Prisma schema + database

**Files:**
- Create: `backend/prisma/schema.prisma`
- Create: `backend/src/db.ts`

**Interfaces:**
- Produces: `db` — `PrismaClient` singleton; Prisma migration applied to local Postgres

- [ ] **Step 1: Write the failing test**

```typescript
// backend/tests/db.test.ts
import { describe, it, expect } from "vitest";
import { db } from "../src/db";

describe("db singleton", () => {
  it("exports a PrismaClient instance", () => {
    expect(db).toBeDefined();
    expect(typeof db.user.findMany).toBe("function");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && npm test -- --reporter=verbose tests/db.test.ts
```

Expected: FAIL — `Cannot find module '../src/db'`

- [ ] **Step 3: Create `backend/prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id               String   @id @default(cuid())
  chesscomUsername String   @unique
  claimed          Boolean  @default(false)
  createdAt        DateTime @default(now())
  following        Follow[] @relation("follower")
  followers        Follow[] @relation("following")
  ratings          Rating[]
}

model Follow {
  followerId  String
  followingId String
  createdAt   DateTime @default(now())
  follower    User     @relation("follower", fields: [followerId], references: [id], onDelete: Cascade)
  following   User     @relation("following", fields: [followingId], references: [id], onDelete: Cascade)

  @@id([followerId, followingId])
}

model Rating {
  id          String   @id @default(cuid())
  userId      String
  timeControl String
  rating      Int
  wins        Int
  losses      Int
  draws       Int
  updatedAt   DateTime @updatedAt
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, timeControl])
}
```

- [ ] **Step 4: Run migration**

```bash
cd backend && npx prisma migrate dev --name init
```

Expected: Migration created and applied. `npx prisma generate` runs automatically.

- [ ] **Step 5: Create `backend/src/db.ts`**

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
```

- [ ] **Step 6: Run test to verify it passes**

```bash
cd backend && npm test -- --reporter=verbose tests/db.test.ts
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/prisma backend/src/db.ts backend/tests/db.test.ts
git commit -m "feat: Prisma schema + db singleton"
```

---

### Task 3: Chess.com API client

**Files:**
- Create: `backend/src/chesscom.ts`
- Create: `backend/tests/chesscom.test.ts`

**Interfaces:**
- Produces:
  - `fetchPlayerExists(username: string): Promise<boolean>`
  - `fetchPlayerRatings(username: string): Promise<PlayerRating[]>`
  - `PlayerRating` — `{ timeControl: TimeControl; rating: number; wins: number; losses: number; draws: number }`
  - `TimeControl` — `"bullet" | "blitz" | "rapid" | "classical"`

- [ ] **Step 1: Write the failing tests**

```typescript
// backend/tests/chesscom.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchPlayerExists, fetchPlayerRatings } from "../src/chesscom";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => mockFetch.mockReset());

describe("fetchPlayerExists", () => {
  it("returns true when Chess.com returns 200", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    expect(await fetchPlayerExists("hikaru")).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.chess.com/pub/player/hikaru"
    );
  });

  it("returns false when Chess.com returns 404", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    expect(await fetchPlayerExists("notarealusername_xyz")).toBe(false);
  });
});

describe("fetchPlayerRatings", () => {
  it("maps blitz and rapid ratings from stats response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        chess_blitz: {
          last: { rating: 3100 },
          record: { win: 500, loss: 100, draw: 50 },
        },
        chess_rapid: {
          last: { rating: 2900 },
          record: { win: 200, loss: 80, draw: 30 },
        },
      }),
    });

    const ratings = await fetchPlayerRatings("hikaru");

    expect(ratings).toContainEqual({
      timeControl: "blitz",
      rating: 3100,
      wins: 500,
      losses: 100,
      draws: 50,
    });
    expect(ratings).toContainEqual({
      timeControl: "rapid",
      rating: 2900,
      wins: 200,
      losses: 80,
      draws: 30,
    });
  });

  it("omits time controls with no data", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        chess_blitz: {
          last: { rating: 1500 },
          record: { win: 10, loss: 5, draw: 2 },
        },
      }),
    });

    const ratings = await fetchPlayerRatings("newplayer");
    expect(ratings).toHaveLength(1);
    expect(ratings[0].timeControl).toBe("blitz");
  });

  it("returns empty array when API fails", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    expect(await fetchPlayerRatings("hikaru")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && npm test -- --reporter=verbose tests/chesscom.test.ts
```

Expected: FAIL — `Cannot find module '../src/chesscom'`

- [ ] **Step 3: Create `backend/src/chesscom.ts`**

```typescript
const BASE = "https://api.chess.com/pub";

export type TimeControl = "bullet" | "blitz" | "rapid" | "classical";

export interface PlayerRating {
  timeControl: TimeControl;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
}

interface ChesscomTimeEntry {
  last: { rating: number };
  record: { win: number; loss: number; draw: number };
}

interface ChesscomStats {
  chess_bullet?: ChesscomTimeEntry;
  chess_blitz?: ChesscomTimeEntry;
  chess_rapid?: ChesscomTimeEntry;
  chess_daily?: ChesscomTimeEntry;
}

const TC_MAP: Array<[TimeControl, keyof ChesscomStats]> = [
  ["bullet", "chess_bullet"],
  ["blitz", "chess_blitz"],
  ["rapid", "chess_rapid"],
  ["classical", "chess_daily"],
];

export async function fetchPlayerExists(username: string): Promise<boolean> {
  const res = await fetch(`${BASE}/player/${username}`);
  return res.ok;
}

export async function fetchPlayerRatings(
  username: string
): Promise<PlayerRating[]> {
  const res = await fetch(`${BASE}/player/${username}/stats`);
  if (!res.ok) return [];

  const data: ChesscomStats = await res.json();

  return TC_MAP.filter(([, key]) => data[key] != null).map(([tc, key]) => {
    const entry = data[key]!;
    return {
      timeControl: tc,
      rating: entry.last.rating,
      wins: entry.record.win,
      losses: entry.record.loss,
      draws: entry.record.draw,
    };
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && npm test -- --reporter=verbose tests/chesscom.test.ts
```

Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/chesscom.ts backend/tests/chesscom.test.ts
git commit -m "feat: Chess.com API client"
```

---

### Task 4: Redis + session middleware + auth routes

**Files:**
- Create: `backend/src/redis.ts`
- Create: `backend/src/session.ts`
- Create: `backend/src/middleware/requireSession.ts`
- Create: `backend/src/routes/auth.ts`
- Create: `backend/tests/auth.test.ts`

**Interfaces:**
- Consumes: `fetchPlayerExists` from `chesscom.ts`; `db` from `db.ts`
- Produces:
  - `redis` — `ioredis` client (default export from `redis.ts`)
  - `sessionParser` — `express-session` middleware (from `session.ts`)
  - `requireSession(req, res, next)` — middleware that 401s if `req.session.userId` is absent
  - `POST /auth/claim` — body `{ username: string }` → `{ userId, chesscomUsername }`
  - `DELETE /auth/session` → 204

- [ ] **Step 1: Write the failing tests**

```typescript
// backend/tests/auth.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// Mock dependencies before importing routes
vi.mock("../src/chesscom", () => ({
  fetchPlayerExists: vi.fn(),
}));
vi.mock("../src/db", () => ({
  db: {
    user: {
      upsert: vi.fn(),
    },
  },
}));
vi.mock("../src/session", () => ({
  sessionParser: (
    _req: express.Request,
    _res: express.Response,
    next: express.NextFunction
  ) => next(),
}));

import { fetchPlayerExists } from "../src/chesscom";
import { db } from "../src/db";
import authRouter from "../src/routes/auth";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).session = { userId: undefined, destroy: vi.fn((cb) => cb()) };
    next();
  });
  app.use("/auth", authRouter);
  return app;
}

beforeEach(() => vi.clearAllMocks());

describe("POST /auth/claim", () => {
  it("returns 400 when username is missing", async () => {
    const res = await request(buildApp()).post("/auth/claim").send({});
    expect(res.status).toBe(400);
  });

  it("returns 404 when username does not exist on Chess.com", async () => {
    vi.mocked(fetchPlayerExists).mockResolvedValueOnce(false);
    const res = await request(buildApp())
      .post("/auth/claim")
      .send({ username: "notreal_xyz" });
    expect(res.status).toBe(404);
  });

  it("creates user and returns 200 with userId when username is valid", async () => {
    vi.mocked(fetchPlayerExists).mockResolvedValueOnce(true);
    vi.mocked(db.user.upsert).mockResolvedValueOnce({
      id: "user1",
      chesscomUsername: "hikaru",
      claimed: true,
      createdAt: new Date(),
    } as any);

    const res = await request(buildApp())
      .post("/auth/claim")
      .send({ username: "hikaru" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ userId: "user1", chesscomUsername: "hikaru" });
  });
});

describe("DELETE /auth/session", () => {
  it("returns 204 and destroys session", async () => {
    const res = await request(buildApp()).delete("/auth/session");
    expect(res.status).toBe(204);
  });
});
```

- [ ] **Step 2: Install supertest**

```bash
cd backend && npm install --save-dev supertest @types/supertest
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd backend && npm test -- --reporter=verbose tests/auth.test.ts
```

Expected: FAIL — `Cannot find module '../src/session'`

- [ ] **Step 4: Create `backend/src/redis.ts`**

```typescript
import Redis from "ioredis";

export const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");
```

- [ ] **Step 5: Create `backend/src/session.ts`**

```typescript
import session from "express-session";
import { RedisStore } from "connect-redis";
import { redis } from "./redis.js";

export const sessionParser = session({
  store: new RedisStore({ client: redis }),
  secret: process.env.SESSION_SECRET ?? "dev_secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
});

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}
```

- [ ] **Step 6: Create `backend/src/middleware/requireSession.ts`**

```typescript
import type { Request, Response, NextFunction } from "express";

export function requireSession(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
```

- [ ] **Step 7: Create `backend/src/routes/auth.ts`**

```typescript
import { Router } from "express";
import { fetchPlayerExists } from "../chesscom.js";
import { db } from "../db.js";

const router = Router();

router.post("/claim", async (req, res) => {
  const { username } = req.body as { username?: string };

  if (!username || typeof username !== "string") {
    res.status(400).json({ error: "username is required" });
    return;
  }

  const exists = await fetchPlayerExists(username.toLowerCase());
  if (!exists) {
    res.status(404).json({ error: "Chess.com username not found" });
    return;
  }

  const user = await db.user.upsert({
    where: { chesscomUsername: username.toLowerCase() },
    update: { claimed: true },
    create: { chesscomUsername: username.toLowerCase(), claimed: true },
  });

  req.session.userId = user.id;
  res.json({ userId: user.id, chesscomUsername: user.chesscomUsername });
});

router.delete("/session", (req, res) => {
  req.session.destroy(() => {
    res.status(204).end();
  });
});

export default router;
```

- [ ] **Step 8: Run tests to verify they pass**

```bash
cd backend && npm test -- --reporter=verbose tests/auth.test.ts
```

Expected: 4 tests PASS

- [ ] **Step 9: Commit**

```bash
git add backend/src/redis.ts backend/src/session.ts backend/src/middleware/ backend/src/routes/auth.ts backend/tests/auth.test.ts
git commit -m "feat: Redis client + session middleware + auth routes"
```

---

### Task 5: Follow routes

**Files:**
- Create: `backend/src/routes/follows.ts`
- Create: `backend/tests/follows.test.ts`

**Interfaces:**
- Consumes: `db`, `redis`, `requireSession`, `fetchPlayerExists`, `fetchPlayerRatings`
- Produces:
  - `POST /follows/:username` — follows a player; seeds their ratings in Postgres + Redis; returns 201
  - `DELETE /follows/:username` — unfollows; returns 204

- [ ] **Step 1: Write the failing tests**

```typescript
// backend/tests/follows.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("../src/chesscom", () => ({
  fetchPlayerExists: vi.fn(),
  fetchPlayerRatings: vi.fn(),
}));
vi.mock("../src/db", () => ({
  db: {
    user: { upsert: vi.fn() },
    follow: { create: vi.fn(), delete: vi.fn() },
    rating: { upsert: vi.fn() },
  },
}));
vi.mock("../src/redis", () => ({
  redis: { zadd: vi.fn(), zrem: vi.fn() },
}));
vi.mock("../src/middleware/requireSession", () => ({
  requireSession: (_req: any, _res: any, next: any) => next(),
}));

import { fetchPlayerExists, fetchPlayerRatings } from "../src/chesscom";
import { db } from "../src/db";
import { redis } from "../src/redis";
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

  it("creates follow, seeds ratings, updates Redis Sorted Sets", async () => {
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
    vi.mocked(db.follow.create).mockResolvedValueOnce({} as any);
    vi.mocked(db.rating.upsert).mockResolvedValueOnce({} as any);

    const res = await request(buildApp()).post("/follows/hikaru");

    expect(res.status).toBe(201);
    expect(db.follow.create).toHaveBeenCalledWith({
      data: { followerId: "viewer1", followingId: "target1" },
    });
    expect(redis.zadd).toHaveBeenCalledWith(
      "leaderboard:viewer1:blitz",
      3100,
      "hikaru"
    );
  });
});

describe("DELETE /follows/:username", () => {
  it("deletes the follow relationship", async () => {
    vi.mocked(db.user.upsert).mockResolvedValueOnce({
      id: "target1",
      chesscomUsername: "hikaru",
      claimed: false,
      createdAt: new Date(),
    } as any);
    vi.mocked(db.follow.delete).mockResolvedValueOnce({} as any);

    const res = await request(buildApp()).delete("/follows/hikaru");
    expect(res.status).toBe(204);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && npm test -- --reporter=verbose tests/follows.test.ts
```

Expected: FAIL — `Cannot find module '../src/routes/follows'`

- [ ] **Step 3: Create `backend/src/routes/follows.ts`**

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && npm test -- --reporter=verbose tests/follows.test.ts
```

Expected: 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/follows.ts backend/tests/follows.test.ts
git commit -m "feat: follow/unfollow routes with Redis leaderboard seeding"
```

---

### Task 6: Leaderboard route

**Files:**
- Create: `backend/src/routes/leaderboard.ts`
- Create: `backend/src/routes/me.ts`
- Create: `backend/src/routes/players.ts`
- Create: `backend/tests/leaderboard.test.ts`

**Interfaces:**
- Consumes: `db`, `redis`, `requireSession`
- Produces:
  - `GET /leaderboard?tc=blitz` → `Array<{ rank: number; username: string; rating: number; wins: number; losses: number; draws: number; isMe: boolean }>`
  - `GET /me` → `{ userId, chesscomUsername, ratings: PlayerRating[] }`
  - `GET /players/:username` → proxied Chess.com stats (cached in Postgres)

- [ ] **Step 1: Write the failing tests**

```typescript
// backend/tests/leaderboard.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("../src/db", () => ({
  db: {
    user: { findUnique: vi.fn() },
    rating: { findMany: vi.fn() },
  },
}));
vi.mock("../src/redis", () => ({
  redis: { zrevrangebyscore: vi.fn() },
}));
vi.mock("../src/middleware/requireSession", () => ({
  requireSession: (_req: any, _res: any, next: any) => next(),
}));

import { db } from "../src/db";
import { redis } from "../src/redis";
import leaderboardRouter from "../src/routes/leaderboard";

function buildApp(userId = "viewer1", username = "gothamchess") {
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
  it("returns players ranked by rating descending", async () => {
    vi.mocked(redis.zrevrangebyscore).mockResolvedValueOnce([
      "hikaru", "3100",
      "gothamchess", "2800",
    ]);
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "viewer1",
      chesscomUsername: "gothamchess",
      claimed: true,
      createdAt: new Date(),
    } as any);
    vi.mocked(db.rating.findMany).mockResolvedValueOnce([
      { userId: "u1", timeControl: "blitz", rating: 3100, wins: 500, losses: 100, draws: 50 } as any,
      { userId: "u2", timeControl: "blitz", rating: 2800, wins: 200, losses: 80, draws: 30 } as any,
    ]);

    const res = await request(buildApp()).get("/leaderboard?tc=blitz");

    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({ rank: 1, username: "hikaru", rating: 3100 });
    expect(res.body[1]).toMatchObject({ rank: 2, username: "gothamchess", rating: 2800 });
  });

  it("defaults to blitz when tc query param is absent", async () => {
    vi.mocked(redis.zrevrangebyscore).mockResolvedValueOnce([]);
    vi.mocked(db.user.findUnique).mockResolvedValue(null);
    vi.mocked(db.rating.findMany).mockResolvedValueOnce([]);

    await request(buildApp()).get("/leaderboard");

    expect(redis.zrevrangebyscore).toHaveBeenCalledWith(
      "leaderboard:viewer1:blitz",
      "+inf",
      "-inf",
      "WITHSCORES"
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && npm test -- --reporter=verbose tests/leaderboard.test.ts
```

Expected: FAIL — `Cannot find module '../src/routes/leaderboard'`

- [ ] **Step 3: Create `backend/src/routes/leaderboard.ts`**

```typescript
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
```

- [ ] **Step 4: Create `backend/src/routes/me.ts`**

```typescript
import { Router } from "express";
import { db } from "../db.js";
import { requireSession } from "../middleware/requireSession.js";

const router = Router();
router.use(requireSession);

router.get("/", async (req, res) => {
  const user = await db.user.findUnique({
    where: { id: req.session.userId! },
    include: { ratings: true },
  });

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(user);
});

export default router;
```

- [ ] **Step 5: Create `backend/src/routes/players.ts`**

```typescript
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
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd backend && npm test -- --reporter=verbose tests/leaderboard.test.ts
```

Expected: 2 tests PASS

- [ ] **Step 7: Commit**

```bash
git add backend/src/routes/leaderboard.ts backend/src/routes/me.ts backend/src/routes/players.ts backend/tests/leaderboard.test.ts
git commit -m "feat: leaderboard, /me, and /players routes"
```

---

### Task 7: WebSocket server + connection map

**Files:**
- Create: `backend/src/connections.ts`
- Create: `backend/src/index.ts`
- Create: `backend/tests/websocket.test.ts`

**Interfaces:**
- Consumes: `sessionParser`, all route modules, `startPoller`
- Produces:
  - `addConnection(userId: string, ws: WebSocket): void`
  - `removeConnection(userId: string): void`
  - `getConnection(userId: string): WebSocket | undefined`
  - HTTP server listening on `PORT` with WebSocket upgrade support
  - Unauthenticated WebSocket connections closed with code 1008

- [ ] **Step 1: Write the failing tests**

```typescript
// backend/tests/websocket.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { WebSocket } from "ws";
import {
  addConnection,
  removeConnection,
  getConnection,
} from "../src/connections";

// Reset module state between tests
beforeEach(() => {
  removeConnection("user1");
  removeConnection("user2");
});

describe("connection map", () => {
  it("stores and retrieves a WebSocket by userId", () => {
    const ws = { readyState: WebSocket.OPEN } as WebSocket;
    addConnection("user1", ws);
    expect(getConnection("user1")).toBe(ws);
  });

  it("returns undefined after removal", () => {
    const ws = { readyState: WebSocket.OPEN } as WebSocket;
    addConnection("user1", ws);
    removeConnection("user1");
    expect(getConnection("user1")).toBeUndefined();
  });

  it("overwrites previous connection for same userId", () => {
    const ws1 = { readyState: WebSocket.OPEN } as WebSocket;
    const ws2 = { readyState: WebSocket.OPEN } as WebSocket;
    addConnection("user1", ws1);
    addConnection("user1", ws2);
    expect(getConnection("user1")).toBe(ws2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && npm test -- --reporter=verbose tests/websocket.test.ts
```

Expected: FAIL — `Cannot find module '../src/connections'`

- [ ] **Step 3: Create `backend/src/connections.ts`**

```typescript
import type { WebSocket } from "ws";

const connections = new Map<string, WebSocket>();

export function addConnection(userId: string, ws: WebSocket): void {
  connections.set(userId, ws);
}

export function removeConnection(userId: string): void {
  connections.delete(userId);
}

export function getConnection(userId: string): WebSocket | undefined {
  return connections.get(userId);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && npm test -- --reporter=verbose tests/websocket.test.ts
```

Expected: 3 tests PASS

- [ ] **Step 5: Create `backend/src/index.ts`**

```typescript
import "dotenv/config";
import http from "http";
import express from "express";
import { WebSocketServer } from "ws";
import { sessionParser } from "./session.js";
import { addConnection, removeConnection } from "./connections.js";
import { startPoller } from "./poller.js";
import authRouter from "./routes/auth.js";
import meRouter from "./routes/me.js";
import playersRouter from "./routes/players.js";
import followsRouter from "./routes/follows.js";
import leaderboardRouter from "./routes/leaderboard.js";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());
app.use(sessionParser);
app.use("/auth", authRouter);
app.use("/me", meRouter);
app.use("/players", playersRouter);
app.use("/follows", followsRouter);
app.use("/leaderboard", leaderboardRouter);

wss.on("connection", (ws, req) => {
  sessionParser(req as any, {} as any, () => {
    const userId = (req as any).session?.userId as string | undefined;
    if (!userId) {
      ws.close(1008, "Unauthorized");
      return;
    }
    addConnection(userId, ws);
    ws.on("close", () => removeConnection(userId));
  });
});

const PORT = process.env.PORT ?? 3001;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  startPoller();
});
```

- [ ] **Step 6: Verify the server starts**

```bash
cd backend && npm run dev
```

Expected: `Server running on http://localhost:3001` — no errors.

- [ ] **Step 7: Commit**

```bash
git add backend/src/connections.ts backend/src/index.ts backend/tests/websocket.test.ts
git commit -m "feat: WebSocket server + connection map"
```

---

### Task 8: Polling job

**Files:**
- Create: `backend/src/poller.ts`
- Create: `backend/tests/poller.test.ts`

**Interfaces:**
- Consumes: `db`, `redis`, `fetchPlayerRatings`, `getConnection`
- Produces:
  - `pollAllRatings(): Promise<void>` — fetches Chess.com for all tracked users, pushes rating_update over WebSocket when changed
  - `startPoller(intervalMs?: number): NodeJS.Timeout`

- [ ] **Step 1: Write the failing tests**

```typescript
// backend/tests/poller.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/db", () => ({
  db: {
    user: { findMany: vi.fn() },
    rating: { upsert: vi.fn() },
    follow: { findMany: vi.fn() },
  },
}));
vi.mock("../src/redis", () => ({
  redis: { zadd: vi.fn() },
}));
vi.mock("../src/chesscom", () => ({
  fetchPlayerRatings: vi.fn(),
}));
vi.mock("../src/connections", () => ({
  getConnection: vi.fn(),
}));

import { db } from "../src/db";
import { redis } from "../src/redis";
import { fetchPlayerRatings } from "../src/chesscom";
import { getConnection } from "../src/connections";
import { pollAllRatings } from "../src/poller";
import { WebSocket } from "ws";

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
  it("updates Postgres and Redis when rating has changed", async () => {
    vi.mocked(db.user.findMany).mockResolvedValueOnce([fakeUser] as any);
    vi.mocked(fetchPlayerRatings).mockResolvedValueOnce([
      { timeControl: "blitz", rating: 3112, wins: 501, losses: 100, draws: 50 },
    ]);
    vi.mocked(db.follow.findMany).mockResolvedValueOnce([
      { followerId: "viewer1", followingId: "user1", createdAt: new Date() },
    ] as any);
    vi.mocked(db.rating.upsert).mockResolvedValueOnce({} as any);
    vi.mocked(getConnection).mockReturnValueOnce(undefined);

    await pollAllRatings();

    expect(db.rating.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_timeControl: { userId: "user1", timeControl: "blitz" },
        },
        update: expect.objectContaining({ rating: 3112 }),
      })
    );
    expect(redis.zadd).toHaveBeenCalledWith(
      "leaderboard:viewer1:blitz",
      3112,
      "hikaru"
    );
  });

  it("pushes rating_update WebSocket message with correct delta", async () => {
    vi.mocked(db.user.findMany).mockResolvedValueOnce([fakeUser] as any);
    vi.mocked(fetchPlayerRatings).mockResolvedValueOnce([
      { timeControl: "blitz", rating: 3112, wins: 501, losses: 100, draws: 50 },
    ]);
    vi.mocked(db.follow.findMany).mockResolvedValueOnce([
      { followerId: "viewer1", followingId: "user1", createdAt: new Date() },
    ] as any);
    vi.mocked(db.rating.upsert).mockResolvedValueOnce({} as any);

    const mockSend = vi.fn();
    vi.mocked(getConnection).mockReturnValueOnce({
      readyState: WebSocket.OPEN,
      send: mockSend,
    } as unknown as WebSocket);

    await pollAllRatings();

    expect(mockSend).toHaveBeenCalledWith(
      JSON.stringify({
        type: "rating_update",
        username: "hikaru",
        timeControl: "blitz",
        rating: 3112,
        delta: 12,
      })
    );
  });

  it("skips update when rating has not changed", async () => {
    vi.mocked(db.user.findMany).mockResolvedValueOnce([fakeUser] as any);
    vi.mocked(fetchPlayerRatings).mockResolvedValueOnce([
      { timeControl: "blitz", rating: 3100, wins: 500, losses: 100, draws: 50 },
    ]);

    await pollAllRatings();

    expect(db.rating.upsert).not.toHaveBeenCalled();
    expect(redis.zadd).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && npm test -- --reporter=verbose tests/poller.test.ts
```

Expected: FAIL — `Cannot find module '../src/poller'`

- [ ] **Step 3: Create `backend/src/poller.ts`**

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && npm test -- --reporter=verbose tests/poller.test.ts
```

Expected: 3 tests PASS

- [ ] **Step 5: Run all backend tests**

```bash
cd backend && npm test
```

Expected: All tests PASS (no failures across all test files)

- [ ] **Step 6: Commit**

```bash
git add backend/src/poller.ts backend/tests/poller.test.ts
git commit -m "feat: polling job with WebSocket fan-out"
```

---

### Task 9: Frontend scaffold + landing page

**Files:**
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/api.ts`
- Create: `frontend/src/pages/Landing.tsx`

**Interfaces:**
- Produces:
  - `claimUsername(username: string): Promise<{ userId: string; chesscomUsername: string }>`
  - `Landing` — form component; on success navigates to `/dashboard`

- [ ] **Step 1: Write the failing tests**

```typescript
// frontend/tests/Landing.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Landing from "../src/pages/Landing";
import * as api from "../src/api";

vi.mock("../src/api", () => ({
  claimUsername: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

beforeEach(() => vi.clearAllMocks());

describe("Landing", () => {
  it("renders the claim form", () => {
    render(<MemoryRouter><Landing /></MemoryRouter>);
    expect(screen.getByPlaceholderText(/chess.com username/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /enter/i })).toBeInTheDocument();
  });

  it("calls claimUsername and navigates to /dashboard on success", async () => {
    vi.mocked(api.claimUsername).mockResolvedValueOnce({
      userId: "u1",
      chesscomUsername: "hikaru",
    });

    render(<MemoryRouter><Landing /></MemoryRouter>);

    await userEvent.type(screen.getByPlaceholderText(/chess.com username/i), "hikaru");
    await userEvent.click(screen.getByRole("button", { name: /enter/i }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/dashboard"));
  });

  it("shows error message when username is not found", async () => {
    vi.mocked(api.claimUsername).mockRejectedValueOnce(new Error("Not found"));

    render(<MemoryRouter><Landing /></MemoryRouter>);

    await userEvent.type(screen.getByPlaceholderText(/chess.com username/i), "nobody");
    await userEvent.click(screen.getByRole("button", { name: /enter/i }));

    await waitFor(() =>
      expect(screen.getByText(/username not found/i)).toBeInTheDocument()
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd frontend && npm test -- --reporter=verbose tests/Landing.test.tsx
```

Expected: FAIL — `Cannot find module '../src/pages/Landing'`

- [ ] **Step 3: Create `frontend/src/api.ts`**

```typescript
const BASE = "/api";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

export interface UserSession {
  userId: string;
  chesscomUsername: string;
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
  isMe: boolean;
}

export function claimUsername(username: string): Promise<UserSession> {
  return apiFetch("/auth/claim", {
    method: "POST",
    body: JSON.stringify({ username }),
  });
}

export function getMe(): Promise<UserSession> {
  return apiFetch("/me");
}

export function getLeaderboard(tc: string): Promise<LeaderboardEntry[]> {
  return apiFetch(`/leaderboard?tc=${tc}`);
}

export function followPlayer(username: string): Promise<void> {
  return apiFetch(`/follows/${username}`, { method: "POST" });
}

export function unfollowPlayer(username: string): Promise<void> {
  return apiFetch(`/follows/${username}`, { method: "DELETE" });
}

export function searchPlayer(username: string): Promise<{ username: string; ratings: LeaderboardEntry[] }> {
  return apiFetch(`/players/${username}`);
}
```

- [ ] **Step 4: Create `frontend/src/pages/Landing.tsx`**

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { claimUsername } from "../api";

export default function Landing() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await claimUsername(username.trim());
      navigate("/dashboard");
    } catch {
      setError("Username not found on Chess.com. Check the spelling and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-6 px-4">
      <h1 className="text-3xl font-bold text-white tracking-tight">Chess Rivals</h1>
      <p className="text-gray-400 text-sm">Track your Chess.com friends in real time.</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 w-full max-w-sm">
        <input
          type="text"
          placeholder="Chess.com username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-green-600 hover:bg-green-500 text-white font-semibold py-2 rounded disabled:opacity-50"
        >
          {loading ? "Checking…" : "Enter"}
        </button>
        {error && <p className="text-red-400 text-sm">{error}</p>}
      </form>
    </main>
  );
}
```

- [ ] **Step 5: Create `frontend/src/main.tsx`**

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 6: Create `frontend/src/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 7: Create `frontend/src/App.tsx`**

```tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Search from "./pages/Search";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/search" element={<Search />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 8: Run tests to verify they pass**

```bash
cd frontend && npm test -- --reporter=verbose tests/Landing.test.tsx
```

Expected: 3 tests PASS

- [ ] **Step 9: Commit**

```bash
git add frontend/src/
git commit -m "feat: frontend scaffold + landing page"
```

---

### Task 10: Leaderboard dashboard

**Files:**
- Create: `frontend/src/components/TimeControlTabs.tsx`
- Create: `frontend/src/components/LeaderboardTable.tsx`
- Create: `frontend/src/hooks/useLeaderboard.ts`
- Create: `frontend/src/pages/Dashboard.tsx`
- Create: `frontend/tests/LeaderboardTable.test.tsx`

**Interfaces:**
- Consumes: `getLeaderboard` from `api.ts`; `LeaderboardEntry` type
- Produces: `Dashboard` — renders leaderboard tab view; `useLeaderboard(tc)` hook returns `{ entries, loading, update }`

- [ ] **Step 1: Write the failing tests**

```typescript
// frontend/tests/LeaderboardTable.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import LeaderboardTable from "../src/components/LeaderboardTable";
import type { LeaderboardEntry } from "../src/api";

const entries: LeaderboardEntry[] = [
  { rank: 1, username: "hikaru", rating: 3100, wins: 500, losses: 100, draws: 50, isMe: false },
  { rank: 2, username: "gothamchess", rating: 2800, wins: 200, losses: 80, draws: 30, isMe: true },
];

describe("LeaderboardTable", () => {
  it("renders rows in rank order", () => {
    render(<LeaderboardTable entries={entries} />);
    const rows = screen.getAllByRole("row");
    expect(rows[1]).toHaveTextContent("hikaru");
    expect(rows[2]).toHaveTextContent("gothamchess");
  });

  it("shows rating for each player", () => {
    render(<LeaderboardTable entries={entries} />);
    expect(screen.getByText("3100")).toBeInTheDocument();
    expect(screen.getByText("2800")).toBeInTheDocument();
  });

  it("highlights the viewer's own row", () => {
    render(<LeaderboardTable entries={entries} />);
    const myRow = screen.getByText("gothamchess").closest("tr");
    expect(myRow).toHaveClass("bg-green-900");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd frontend && npm test -- --reporter=verbose tests/LeaderboardTable.test.tsx
```

Expected: FAIL — `Cannot find module '../src/components/LeaderboardTable'`

- [ ] **Step 3: Create `frontend/src/components/TimeControlTabs.tsx`**

```tsx
const TABS = ["bullet", "blitz", "rapid", "classical"] as const;
export type TimeControl = (typeof TABS)[number];

interface Props {
  active: TimeControl;
  onChange: (tc: TimeControl) => void;
}

export default function TimeControlTabs({ active, onChange }: Props) {
  return (
    <div className="flex gap-1 mb-4">
      {TABS.map((tc) => (
        <button
          key={tc}
          onClick={() => onChange(tc)}
          className={`px-4 py-1.5 rounded text-sm font-medium capitalize ${
            active === tc
              ? "bg-green-600 text-white"
              : "bg-gray-800 text-gray-400 hover:bg-gray-700"
          }`}
        >
          {tc}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Create `frontend/src/components/LeaderboardTable.tsx`**

```tsx
import type { LeaderboardEntry } from "../api";
import DeltaBadge from "./DeltaBadge";

interface Props {
  entries: LeaderboardEntry[];
  deltas?: Record<string, number>;
  onUnfollow?: (username: string) => void;
}

export default function LeaderboardTable({ entries, deltas = {}, onUnfollow }: Props) {
  return (
    <table className="w-full text-sm text-left">
      <thead>
        <tr className="text-gray-500 border-b border-gray-800">
          <th className="pb-2 pr-4 w-10">#</th>
          <th className="pb-2 pr-4">Player</th>
          <th className="pb-2 pr-4 text-right">Rating</th>
          <th className="pb-2 pr-4 text-right">W</th>
          <th className="pb-2 pr-4 text-right">L</th>
          <th className="pb-2 pr-4 text-right">D</th>
          {onUnfollow && <th className="pb-2" />}
        </tr>
      </thead>
      <tbody>
        {entries.map((e) => (
          <tr
            key={e.username}
            className={`border-b border-gray-800 ${
              e.isMe ? "bg-green-900" : "hover:bg-gray-900"
            }`}
          >
            <td className="py-3 pr-4 text-gray-500">{e.rank}</td>
            <td className="py-3 pr-4 font-medium text-white">{e.username}</td>
            <td className="py-3 pr-4 text-right text-white">
              <span className="mr-2">{e.rating}</span>
              {deltas[e.username] != null && (
                <DeltaBadge delta={deltas[e.username]} />
              )}
            </td>
            <td className="py-3 pr-4 text-right text-gray-400">{e.wins}</td>
            <td className="py-3 pr-4 text-right text-gray-400">{e.losses}</td>
            <td className="py-3 pr-4 text-right text-gray-400">{e.draws}</td>
            {onUnfollow && !e.isMe && (
              <td className="py-3 text-right">
                <button
                  onClick={() => onUnfollow(e.username)}
                  className="text-gray-600 hover:text-red-400 text-xs"
                >
                  unfollow
                </button>
              </td>
            )}
            {onUnfollow && e.isMe && <td />}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 5: Create `frontend/src/hooks/useLeaderboard.ts`**

```typescript
import { useState, useEffect, useCallback } from "react";
import { getLeaderboard, type LeaderboardEntry } from "../api";
import type { TimeControl } from "../components/TimeControlTabs";

export function useLeaderboard(tc: TimeControl) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getLeaderboard(tc)
      .then(setEntries)
      .finally(() => setLoading(false));
  }, [tc]);

  const update = useCallback((username: string, rating: number) => {
    setEntries((prev) =>
      prev
        .map((e) => (e.username === username ? { ...e, rating } : e))
        .sort((a, b) => b.rating - a.rating)
        .map((e, i) => ({ ...e, rank: i + 1 }))
    );
  }, []);

  const remove = useCallback((username: string) => {
    setEntries((prev) =>
      prev
        .filter((e) => e.username !== username)
        .map((e, i) => ({ ...e, rank: i + 1 }))
    );
  }, []);

  return { entries, loading, update, remove };
}
```

- [ ] **Step 6: Create `frontend/src/pages/Dashboard.tsx`**

```tsx
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import TimeControlTabs, { type TimeControl } from "../components/TimeControlTabs";
import LeaderboardTable from "../components/LeaderboardTable";
import { useLeaderboard } from "../hooks/useLeaderboard";
import { useWebSocket } from "../hooks/useWebSocket";
import { getMe, unfollowPlayer, type UserSession } from "../api";

export default function Dashboard() {
  const [tc, setTc] = useState<TimeControl>("blitz");
  const { entries, loading, update, remove } = useLeaderboard(tc);
  const [deltas, setDeltas] = useState<Record<string, number>>({});
  const [me, setMe] = useState<UserSession | null>(null);

  useEffect(() => {
    getMe().then(setMe).catch(() => null);
  }, []);

  useWebSocket((msg) => {
    if (msg.type === "rating_update" && msg.timeControl === tc) {
      update(msg.username, msg.rating);
      setDeltas((prev) => ({ ...prev, [msg.username]: msg.delta }));
      setTimeout(() => {
        setDeltas((prev) => {
          const next = { ...prev };
          delete next[msg.username];
          return next;
        });
      }, 3000);
    }
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
        <p className="text-gray-500 text-sm">Loading…</p>
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

- [ ] **Step 7: Run tests to verify they pass**

```bash
cd frontend && npm test -- --reporter=verbose tests/LeaderboardTable.test.tsx
```

Expected: 3 tests PASS

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/ frontend/src/hooks/useLeaderboard.ts frontend/src/pages/Dashboard.tsx frontend/tests/LeaderboardTable.test.tsx
git commit -m "feat: leaderboard dashboard + table + time control tabs"
```

---

### Task 11: WebSocket client + delta badge

**Files:**
- Create: `frontend/src/hooks/useWebSocket.ts`
- Create: `frontend/src/components/DeltaBadge.tsx`
- Create: `frontend/tests/DeltaBadge.test.tsx`
- Create: `frontend/tests/useWebSocket.test.ts`

**Interfaces:**
- Produces:
  - `useWebSocket(onMessage: (msg: WsMessage) => void): void` — opens WebSocket, reconnects with backoff up to 3 times
  - `DeltaBadge({ delta: number })` — renders `+12` in green or `-8` in red

- [ ] **Step 1: Write the failing tests**

```typescript
// frontend/tests/DeltaBadge.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DeltaBadge from "../src/components/DeltaBadge";

describe("DeltaBadge", () => {
  it("renders positive delta in green with + prefix", () => {
    render(<DeltaBadge delta={12} />);
    const badge = screen.getByText("+12");
    expect(badge).toHaveClass("text-green-400");
  });

  it("renders negative delta in red without extra prefix", () => {
    render(<DeltaBadge delta={-8} />);
    const badge = screen.getByText("-8");
    expect(badge).toHaveClass("text-red-400");
  });
});
```

```typescript
// frontend/tests/useWebSocket.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useWebSocket } from "../src/hooks/useWebSocket";

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  send = vi.fn();
  close = vi.fn();
  constructor() { MockWebSocket.instances.push(this); }
}

vi.stubGlobal("WebSocket", MockWebSocket);

beforeEach(() => { MockWebSocket.instances = []; vi.clearAllMocks(); });

describe("useWebSocket", () => {
  it("calls onMessage when a message is received", () => {
    const onMessage = vi.fn();
    renderHook(() => useWebSocket(onMessage));

    const ws = MockWebSocket.instances[0];
    ws.onmessage?.({ data: JSON.stringify({ type: "rating_update", username: "hikaru", timeControl: "blitz", rating: 3100, delta: 12 }) });

    expect(onMessage).toHaveBeenCalledWith({ type: "rating_update", username: "hikaru", timeControl: "blitz", rating: 3100, delta: 12 });
  });

  it("reconnects on close if under 3 attempts", async () => {
    vi.useFakeTimers();
    renderHook(() => useWebSocket(vi.fn()));

    MockWebSocket.instances[0].onclose?.();
    await vi.runAllTimersAsync();

    expect(MockWebSocket.instances.length).toBe(2);
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd frontend && npm test -- --reporter=verbose tests/DeltaBadge.test.tsx tests/useWebSocket.test.ts
```

Expected: FAIL — missing modules

- [ ] **Step 3: Create `frontend/src/components/DeltaBadge.tsx`**

```tsx
interface Props {
  delta: number;
}

export default function DeltaBadge({ delta }: Props) {
  const isPositive = delta >= 0;
  return (
    <span
      className={`text-xs font-semibold ${
        isPositive ? "text-green-400" : "text-red-400"
      }`}
    >
      {isPositive ? `+${delta}` : `${delta}`}
    </span>
  );
}
```

- [ ] **Step 4: Create `frontend/src/hooks/useWebSocket.ts`**

```typescript
import { useEffect, useRef } from "react";

export type WsMessage =
  | {
      type: "rating_update";
      username: string;
      timeControl: string;
      rating: number;
      delta: number;
    }
  | { type: "friend_joined"; username: string };

export function useWebSocket(onMessage: (msg: WsMessage) => void): void {
  const attemptsRef = useRef(0);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    let ws: WebSocket;
    let active = true;

    function connect() {
      ws = new WebSocket(`ws://localhost:3001`);

      ws.onopen = () => {
        attemptsRef.current = 0;
      };

      ws.onmessage = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data as string) as WsMessage;
          onMessageRef.current(msg);
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        if (active && attemptsRef.current < 3) {
          attemptsRef.current++;
          const delay = Math.pow(2, attemptsRef.current) * 1000;
          setTimeout(connect, delay);
        }
      };
    }

    connect();
    return () => {
      active = false;
      ws?.close();
    };
  }, []);
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd frontend && npm test -- --reporter=verbose tests/DeltaBadge.test.tsx tests/useWebSocket.test.ts
```

Expected: 4 tests PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/hooks/useWebSocket.ts frontend/src/components/DeltaBadge.tsx frontend/tests/DeltaBadge.test.tsx frontend/tests/useWebSocket.test.ts
git commit -m "feat: WebSocket hook with reconnect + DeltaBadge component"
```

---

### Task 12: Search page

**Files:**
- Create: `frontend/src/pages/Search.tsx`

**Interfaces:**
- Consumes: `searchPlayer`, `followPlayer` from `api.ts`
- Produces: `Search` — text input searches Chess.com username, shows ratings preview, follow button

- [ ] **Step 1: Create `frontend/src/pages/Search.tsx`**

(No test for this page — it's a thin UI wrapper over already-tested API calls.)

```tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { searchPlayer, followPlayer } from "../api";

interface SearchResult {
  username: string;
  ratings: Array<{ timeControl: string; rating: number }>;
}

export default function Search() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [followed, setFollowed] = useState(false);
  const [searching, setSearching] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setFollowed(false);
    setSearching(true);
    try {
      const data = await searchPlayer(query.trim());
      setResult(data as SearchResult);
    } catch {
      setError("Player not found on Chess.com.");
    } finally {
      setSearching(false);
    }
  }

  async function handleFollow() {
    if (!result) return;
    await followPlayer(result.username);
    setFollowed(true);
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white px-4 py-8 max-w-xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Find Players</h1>
        <Link to="/dashboard" className="text-green-400 text-sm hover:underline">
          ← Back
        </Link>
      </div>
      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <input
          type="text"
          placeholder="Chess.com username"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
          required
        />
        <button
          type="submit"
          disabled={searching}
          className="bg-green-600 hover:bg-green-500 text-white font-semibold px-4 py-2 rounded disabled:opacity-50"
        >
          {searching ? "…" : "Search"}
        </button>
      </form>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {result && (
        <div className="bg-gray-900 rounded p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold text-lg">{result.username}</span>
            <button
              onClick={handleFollow}
              disabled={followed}
              className="bg-green-600 hover:bg-green-500 text-white text-sm font-medium px-3 py-1 rounded disabled:opacity-50"
            >
              {followed ? "Following ✓" : "Follow"}
            </button>
          </div>
          <div className="flex flex-wrap gap-3">
            {result.ratings.map((r) => (
              <div key={r.timeControl} className="text-sm">
                <span className="text-gray-400 capitalize">{r.timeControl}</span>{" "}
                <span className="font-medium">{r.rating}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Run all frontend tests to confirm nothing regressed**

```bash
cd frontend && npm test
```

Expected: All tests PASS

- [ ] **Step 3: Smoke test the full app**

Start both services:
```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

Open `http://localhost:5173`. Walk through:
1. Enter a real Chess.com username (e.g. `hikaru`) → lands on `/dashboard`
2. Visit `/search`, find another player (e.g. `gothamchess`), click Follow
3. Back on `/dashboard` → both players appear in the blitz leaderboard
4. Wait 2 minutes → polling job fires, any rating changes push live via WebSocket

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Search.tsx
git commit -m "feat: search + follow page"
```

---

## Final test count

| Service | Tests |
|---------|-------|
| Backend | chesscom (4) + auth (4) + follows (3) + leaderboard (2) + websocket (3) + poller (3) = **19** |
| Frontend | Landing (3) + LeaderboardTable (3) + DeltaBadge (2) + useWebSocket (2) = **10** |
| **Total** | **29** |
