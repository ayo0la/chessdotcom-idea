# Chess Rivals — Design Spec
_2026-06-29_

## Overview

Chess Rivals is a real-time friend leaderboard that tracks Chess.com ratings across your follow network. Users claim their Chess.com username, follow other players, and watch live rating changes pushed over WebSocket as games finish.

Built as a portfolio piece targeting Chess.com's Connect Team. Demonstrates real-time service architecture, social graph design, and TypeScript full-stack development.

---

## Architecture

Two separate services in one monorepo:

```
chess-rivals/
  backend/    Express + TypeScript + WebSocket server + polling job
  frontend/   React + Vite + TypeScript
```

### Backend responsibilities
- REST API (Express) for auth, follow graph, leaderboard queries
- WebSocket server (`ws`) for real-time push to connected clients
- Background polling job (`setInterval`, 2-minute interval) fetching Chess.com public API per tracked username
- Redis Sorted Sets storing leaderboard rankings per time control
- PostgreSQL + Prisma for users and follow relationships
- On rating change detected: update Postgres, update Redis, fan-out via Redis pub/sub to WebSocket server, push to affected clients

### Frontend responsibilities
- Claim your Chess.com username (verified against Chess.com API, no password)
- Follow/unfollow players by username
- Leaderboard view with tabs: Bullet / Blitz / Rapid / Classical
- Live rating delta badges pushed over WebSocket without page refresh

### Data flow

```
Chess.com API
  → polling job (every 2 min)
  → detect delta
  → update Postgres + Redis Sorted Set
  → publish to Redis pub/sub channel
  → WebSocket server subscribes
  → push rating_update to connected clients
```

---

## Data Model

### Prisma schema

```prisma
model User {
  id               String   @id @default(cuid())
  chesscomUsername String   @unique
  createdAt        DateTime @default(now())
  following        Follow[] @relation("follower")
  followers        Follow[] @relation("following")
  ratings          Rating[]
}

model Follow {
  followerId  String
  followingId String
  createdAt   DateTime @default(now())
  follower    User     @relation("follower", fields: [followerId], references: [id])
  following   User     @relation("following", fields: [followingId], references: [id])
  @@id([followerId, followingId])
}

model Rating {
  id          String   @id @default(cuid())
  userId      String
  timeControl String   // "bullet" | "blitz" | "rapid" | "classical"
  rating      Int
  wins        Int
  losses      Int
  draws       Int
  updatedAt   DateTime @updatedAt
  user        User     @relation(fields: [userId], references: [id])
  @@unique([userId, timeControl])
}
```

### Redis keys
- `leaderboard:{viewerUserId}:{timeControl}` — Sorted Set, score = rating, member = chesscomUsername
- `connections:{chesscomUsername}` — Set of WebSocket client IDs to fan-out to

---

## API Design

### REST endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/claim` | Verify username exists on Chess.com, create User, set session cookie |
| DELETE | `/auth/session` | Clear session |
| GET | `/me` | Return current user + their ratings |
| GET | `/players/:username` | Proxy + cache Chess.com player stats |
| POST | `/follows/:username` | Follow a player, seed their ratings into Postgres + Redis |
| DELETE | `/follows/:username` | Unfollow, remove from leaderboard |
| GET | `/leaderboard?tc=blitz` | Return follow network ranked by rating for given time control |

### WebSocket protocol

```
Client → Server:
  { type: "auth", sessionId: "..." }

Server → Client:
  { type: "rating_update", username: "hikaru", timeControl: "blitz", rating: 3201, delta: 12 }
  { type: "friend_joined", username: "gothamchess" }
```

### Polling job
- Runs on `setInterval` every 2 minutes inside the Express process
- Fetches `https://api.chess.com/pub/player/{username}/stats` for all tracked usernames
- Compares to cached `Rating` row in Postgres
- On change: updates Postgres + Redis Sorted Set, publishes `rating_update` to Redis pub/sub
- WebSocket server subscribes to pub/sub and pushes to affected clients

---

## Frontend

### Routes

| Path | Description |
|------|-------------|
| `/` | Landing: enter Chess.com username to claim |
| `/dashboard` | Main leaderboard, protected |
| `/search` | Find and follow players by username |

### Dashboard layout
- Header: your username, rating summary, unfollow controls
- Time control tabs: Bullet / Blitz / Rapid / Classical
- Leaderboard table per tab: Rank, Username, Rating, Record (W/L/D), Delta badge
- Delta badges flash green (gain) or red (loss) on WebSocket push, fade after 3 seconds
- Your row highlighted for instant position awareness

### WebSocket client
- Single `useWebSocket` hook opened on dashboard mount
- On `rating_update`: update matching row in local state, set delta badge
- On disconnect: auto-reconnect with exponential backoff (max 3 attempts)

### State management
`useState` + `useReducer` for leaderboard rows. No external state library needed at this scope.

### Styling
Tailwind CSS, dark theme.

---

## Testing

### Backend (Vitest, ~10-12 tests)
- Polling job: mock Chess.com API, assert delta detection, assert Redis Sorted Set update
- Leaderboard query: seed follow graph + ratings, assert correct ranking order per time control
- Follow/unfollow: assert graph updates and Redis reflects change
- WebSocket: mock connected client, trigger rating update, assert correct message pushed

### Frontend (Vitest + React Testing Library, ~6-8 tests)
- Leaderboard table renders correct ranked order from mock API response
- Delta badge appears with correct sign and color on WebSocket message
- Badge fades after 3 seconds
- Reconnect logic fires on socket close

**Target: ~15-20 tests total.**

---

## Out of Scope

- Password auth (username claim only, no credentials)
- Mobile-optimized layout (desktop-first)
- Historical rating charts
- Notifications for games completed (not just rating changes)
- Deployment (local dev only for now)
