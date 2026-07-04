import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { db } from "../db.js";
import { requireAuth, requireLinkedUser } from "../middleware/requireAuth.js";
import { computeStreak } from "../services/debriefs.js";
import { claudeEnabled, generateText } from "../services/claude.js";
import { fetchRecentGames } from "../services/analysis/pgn-fetcher.js";
import { lossesForUser } from "../services/analysis/scout.js";

const DIAGNOSIS_MIN_DEBRIEFS = 10;

const router = Router();
router.use(requireAuth, requireLinkedUser);

router.get("/", async (req, res) => {
  const user = await db.user.findUnique({
    where: { id: req.userId! },
    include: { ratings: true },
  });

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(user);
});

router.get("/tilt", async (req, res) => {
  const since = new Date(Date.now() - 45 * 60 * 1000);
  const event = await db.tiltEvent.findFirst({
    where: { userId: req.userId!, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
  });
  res.json(event ?? null);
});

router.get("/losses", async (req, res) => {
  const me = await db.user.findUnique({ where: { id: req.userId! } });
  if (!me) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const limit = Math.min(parseInt((req.query.limit as string) ?? "10", 10) || 10, 30);
  try {
    const games = await fetchRecentGames(me.chesscomUsername);
    res.json(lossesForUser(games, me.chesscomUsername, limit));
  } catch {
    res.status(502).json({ error: "Could not fetch game history" });
  }
});

router.get("/fingerprint", async (req, res) => {
  const me = await db.user.findUnique({ where: { id: req.userId! } });
  res.json({
    fingerprint: me?.blunderFingerprint ?? null,
    computedAt: me?.fingerprintComputedAt ?? null,
  });
});

router.post("/fingerprint", async (req, res) => {
  const fingerprint = req.body?.fingerprint;
  if (!fingerprint || typeof fingerprint !== "object") {
    res.status(400).json({ error: "fingerprint is required" });
    return;
  }
  await db.user.update({
    where: { id: req.userId! },
    data: {
      blunderFingerprint: fingerprint as Prisma.InputJsonValue,
      fingerprintComputedAt: new Date(),
    },
  });
  res.json({ ok: true });
});

router.get("/rating-history", async (req, res) => {
  const tc = (req.query.tc as string) || "blitz";
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const snapshots = await db.ratingSnapshot.findMany({
    where: { userId: req.userId!, timeControl: tc, createdAt: { gte: since } },
    orderBy: { createdAt: "asc" },
    take: 500,
  });
  res.json(snapshots.map((s) => ({ rating: s.rating, at: s.createdAt })));
});

router.get("/debrief-prompt", async (req, res) => {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const prompt = await db.debriefPrompt.findFirst({
    where: { userId: req.userId!, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
  });
  if (!prompt) {
    res.json(null);
    return;
  }
  const answered = await db.debrief.findFirst({
    where: { userId: req.userId!, gameId: prompt.gameId },
  });
  res.json(answered ? null : prompt);
});

router.post("/debriefs", async (req, res) => {
  const gameId = typeof req.body?.gameId === "string" ? req.body.gameId : "";
  const answers = req.body?.answers;
  const hasAnswers =
    answers && typeof answers === "object" && Object.keys(answers).length > 0;
  if (!gameId || !hasAnswers) {
    res.status(400).json({ error: "gameId and answers are required" });
    return;
  }

  const existing = await db.debrief.findFirst({
    where: { userId: req.userId!, gameId },
  });
  if (existing) {
    res.status(409).json({ error: "Debrief already submitted for this game" });
    return;
  }

  await db.debrief.create({
    data: {
      userId: req.userId!,
      gameId,
      answers: answers as Prisma.InputJsonValue,
    },
  });
  res.status(201).json({ ok: true });
});

router.get("/debriefs/summary", async (req, res) => {
  const userId = req.userId!;
  const count = await db.debrief.count({ where: { userId } });
  const recent = await db.debrief.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  const streak = computeStreak(recent.map((d) => d.createdAt));

  const wantsNarrative = req.query.narrative === "1";
  if (!wantsNarrative || count < DIAGNOSIS_MIN_DEBRIEFS) {
    res.json({ count, streak, narrative: null });
    return;
  }

  if (!claudeEnabled()) {
    res.status(503).json({ error: "Debrief diagnosis is not configured" });
    return;
  }

  try {
    const prompt = [
      "You are a chess coach. A player filled in a short debrief after each recent loss.",
      "Diagnose the recurring patterns in their losses and give 2-3 concrete, prioritized fixes.",
      "Keep it to one short paragraph, plain text, addressed directly to the player.",
      "",
      "Debrief answers, most recent first:",
      ...recent.map((d, i) => `${i + 1}. ${JSON.stringify(d.answers)}`),
    ].join("\n");
    const narrative = await generateText(prompt);
    res.json({ count, streak, narrative });
  } catch {
    res.status(502).json({ error: "Diagnosis failed" });
  }
});

export default router;
