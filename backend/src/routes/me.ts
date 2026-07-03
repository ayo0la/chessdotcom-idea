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

router.get("/tilt", async (req, res) => {
  const since = new Date(Date.now() - 45 * 60 * 1000);
  const event = await db.tiltEvent.findFirst({
    where: { userId: req.session.userId!, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
  });
  res.json(event ?? null);
});

export default router;
