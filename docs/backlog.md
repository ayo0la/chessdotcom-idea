# Chess Rivals — Backlog

## Now: Deploy

Free stack: Koyeb (backend, always-on) + Neon (Postgres) + Upstash (Redis) + Vercel (frontend)
No credit card required across the board.

- [ ] Push local repo to GitHub (`git remote add origin <url> && git push -u origin main`)
- [ ] Neon (neon.tech) — new project, copy `DATABASE_URL`
- [ ] Upstash (upstash.com) — new Redis database, copy `REDIS_URL`
- [ ] Koyeb (koyeb.com) — sign up with GitHub, New App → GitHub → select repo
  - Service type: Web Service, Builder: Buildpack
  - Root directory: `backend`
  - Build: `npm install && npm run build`
  - Start: `npx prisma migrate deploy && node dist/index.js`
  - Port: `3001`
  - Env vars: `DATABASE_URL`, `REDIS_URL`, `SESSION_SECRET`, `NODE_ENV=production`
- [ ] Note Koyeb app URL (e.g. `https://chess-rivals.koyeb.app`)
- [ ] Vercel (vercel.com) — connect GitHub repo, root: `frontend`
  - Env vars: `VITE_API_URL=https://<koyeb-url>/api`, `VITE_WS_URL=wss://<koyeb-url>`
- [ ] Smoke test: claim username, follow a player, check leaderboard loads
- [ ] Verify WebSocket works (browser DevTools > Network > WS tab)

> Deploy notes added 2026-07-02 (after the analysis features shipped):
> - This checklist predates the Supabase Realtime refactor — the DB must be Supabase
>   (not Neon) for realtime pushes, and no always-on WS server is needed anymore.
> - Three new migrations to apply via `npx prisma migrate deploy`: `add_tilt_event`,
>   `add_style_profile`, `add_debriefs`. On Supabase they also add `TiltEvent` and
>   `DebriefPrompt` to the `supabase_realtime` publication automatically (guarded,
>   no-op elsewhere) — verify the migration role has permission, or add the tables
>   via the dashboard like `Rating`.
> - New backend env vars: `ANTHROPIC_API_KEY` (required for the Opening DNA compare
>   and debrief diagnosis endpoints; they return 503 without it) and optional
>   `CLAUDE_MODEL` (defaults to `claude-opus-4-8`).

---

## Done: Tilt Detector (shipped 2026-07-02)

Detect when a user is tilting (loss sequences + rushing) and push a real-time warning via Supabase Realtime. Runs on the existing polling infrastructure.

> Spec updated 2026-07-02: originally written for the custom WebSocket fan-out, which was
> removed in the Supabase Realtime refactor. The warning now travels as a `TiltEvent` row
> insert that Supabase Realtime broadcasts to the subscribed client (same pattern as
> `Rating` updates), instead of a custom WS message.

**Data signals:**
- 2+ losses in the last 45 minutes (Chess.com monthly games archive)
- Move speed increasing across consecutive games (avg seconds/move from PGN `%clk` tags)

**Implementation:**
- `backend/src/services/analysis/tilt-detector.ts` — loss-sequence monitor per user; state lives in the `TiltEvent` table (a recent event suppresses duplicates, so it survives serverless restarts)
- Extend `poller.ts` to run the tilt check when a user's loss count increases
- `TiltEvent` Prisma model (`userId`, `lossCount`, `rushing`, `suggestion`, `createdAt`); INSERT is broadcast via the `supabase_realtime` publication (migration adds the table to the publication when it exists)
- `GET /me/tilt` — latest tilt event from the last 45 minutes, so a page refresh keeps the banner
- Frontend: `TiltBanner.tsx` — dismissible banner on Dashboard, driven by a `postgres_changes` INSERT subscription filtered by `userId`

**Effort:** ~2 days

---

## Done: Opening DNA (shipped 2026-07-02)

Aggregate a user's Chess.com game history by ECO opening code, compute win rates, surface weapons and vulnerabilities. Use Claude API to generate a friend-comparison narrative.

**Data source:** Chess.com `/pub/player/{username}/games/{year}/{month}` — returns PGNs with ECO codes

**Implementation:**
- `backend/services/analysis/pgn-fetcher.ts` — fetch + cache last 200 games per user
- `backend/services/analysis/opening-dna.ts` — ECO aggregation, win/loss/draw per opening
- `GET /players/:username/openings` — return top openings + win rates
- `POST /analysis/compare` — Claude API call comparing two players' opening DNA
- Frontend: `OpeningDNA.tsx` — bar chart of top 5 openings with win rates; compare button

**Effort:** ~3 days

---

## Done: Play Style Profile (shipped 2026-07-02)

Classify each user on three axes from PGN analysis: Tactical vs. Positional, Aggressive vs. Defensive, Time Manager vs. Scrambler. Show as a profile card on the leaderboard.

**Depends on:** Opening DNA (reuses PGN fetch + parse pipeline)

**Implementation:**
- `backend/services/analysis/style-classifier.ts` — heuristics on move patterns, exchange frequency, pawn push rates, clock usage
- Add `styleProfile` JSON column to `User` model
- Frontend: `StyleCard.tsx` — 3-axis radar or pill badges

**Effort:** ~3 days

---

## Done: Post-Game Debrief (shipped 2026-07-02)

Condensed (8-question) version of the Rating Breakout Analysis Sheet triggered after each loss. Answers accumulate to surface patterns. Claude generates a diagnosis after 10+ debriefs.

**Implementation:**
- `Debrief` Prisma model: `userId`, `gameId`, `answers` (JSON), `createdAt`
- WS message after loss detected: `{ type: "debrief_prompt", gameId }`
- `DebriefModal.tsx` — 8-question form, 90-second target
- `GET /me/debrief-summary` — Claude API call over last N answers
- Frontend: debrief streak counter on Dashboard header

**Effort:** ~4 days

---

## Parking Lot

- **Skill Gap Leaderboard** — requires manual self-assessment, weak user story. Revisit if debrief data proves insufficient.
- **Opponent Weakness Scout** — on-demand scouting report for any Chess.com username via Claude API. Low effort after Opening DNA is built.
- **Personalized Study Queue** — maps Rating Breakout weak areas to Skills Blueprint categories. Only meaningful after 10+ debriefs.
