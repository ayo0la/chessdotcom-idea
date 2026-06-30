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

---

## Next: Tilt Detector

Detect when a user is tilting (loss sequences + rushing) and push a real-time warning via WebSocket. Runs on the existing polling infrastructure.

**Data signals:**
- 2+ losses in the last 45 minutes (Chess.com `/games` endpoint or rating delta tracking)
- Move speed increasing across consecutive games (avg seconds/move from PGN)

**Implementation:**
- `backend/services/analysis/tilt-detector.ts` — stateful loss-sequence monitor per user
- Extend `poller.ts` to call tilt check after each rating update
- New WS message type: `{ type: "tilt_warning", lossCount: number, suggestion: string }`
- Frontend: `TiltBanner.tsx` — dismissible banner on Dashboard when tilt warning received

**Effort:** ~2 days

---

## Then: Opening DNA

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

## Later: Play Style Profile

Classify each user on three axes from PGN analysis: Tactical vs. Positional, Aggressive vs. Defensive, Time Manager vs. Scrambler. Show as a profile card on the leaderboard.

**Depends on:** Opening DNA (reuses PGN fetch + parse pipeline)

**Implementation:**
- `backend/services/analysis/style-classifier.ts` — heuristics on move patterns, exchange frequency, pawn push rates, clock usage
- Add `styleProfile` JSON column to `User` model
- Frontend: `StyleCard.tsx` — 3-axis radar or pill badges

**Effort:** ~3 days

---

## Later: Post-Game Debrief

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
