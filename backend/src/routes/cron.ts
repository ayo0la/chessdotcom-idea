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
