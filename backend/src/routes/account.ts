import { Router } from "express";
import { randomBytes } from "node:crypto";
import { db } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { fetchPlayerExists, fetchPlayerProfile } from "../chesscom.js";

const router = Router();
router.use(requireAuth);

function generateCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(6);
  let code = "";
  for (const b of bytes) code += alphabet[b % alphabet.length];
  return `CR-${code}`;
}

router.get("/status", async (req, res) => {
  const [user, pending] = await Promise.all([
    db.user.findUnique({ where: { authId: req.authId! } }),
    db.pendingLink.findUnique({ where: { authId: req.authId! } }),
  ]);
  res.json({
    user: user ? { userId: user.id, chesscomUsername: user.chesscomUsername } : null,
    pending: pending ? { username: pending.username, code: pending.code } : null,
  });
});

router.post("/link", async (req, res) => {
  const username =
    typeof req.body?.username === "string"
      ? req.body.username.trim().toLowerCase()
      : "";
  if (!username) {
    res.status(400).json({ error: "username is required" });
    return;
  }

  const exists = await fetchPlayerExists(username);
  if (!exists) {
    res.status(404).json({ error: "Chess.com username not found" });
    return;
  }

  const existing = await db.user.findUnique({
    where: { chesscomUsername: username },
  });
  if (existing?.authId && existing.authId !== req.authId) {
    res.status(409).json({ error: "This username is already verified by another account" });
    return;
  }

  const code = generateCode();
  await db.pendingLink.upsert({
    where: { authId: req.authId! },
    update: { username, code },
    create: { authId: req.authId!, username, code },
  });

  res.json({ username, code });
});

router.post("/verify", async (req, res) => {
  const pending = await db.pendingLink.findUnique({
    where: { authId: req.authId! },
  });
  if (!pending) {
    res.status(400).json({ error: "No pending link. Start by entering your username." });
    return;
  }

  const profile = await fetchPlayerProfile(pending.username);
  if (!profile?.location?.includes(pending.code)) {
    res.status(400).json({
      error: `Verification code not found. Put ${pending.code} in the Location field of your Chess.com profile, save, then try again.`,
    });
    return;
  }

  const user = await db.user.upsert({
    where: { chesscomUsername: pending.username },
    update: { authId: req.authId!, claimed: true },
    create: {
      chesscomUsername: pending.username,
      claimed: true,
      authId: req.authId!,
    },
  });
  await db.pendingLink.delete({ where: { authId: req.authId! } });

  res.json({ userId: user.id, chesscomUsername: user.chesscomUsername });
});

export default router;
