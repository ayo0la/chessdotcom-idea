import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("../src/middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) =>
    req.userId ? next() : res.status(401).json({ error: "Unauthorized" }),
  requireLinkedUser: (_req: any, _res: any, next: any) => next(),
}));
vi.mock("../src/db", () => ({
  db: {
    user: { findUnique: vi.fn() },
    tiltEvent: { findFirst: vi.fn() },
  },
}));

import { db } from "../src/db";
import meRouter from "../src/routes/me";

function buildApp(userId?: string) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).userId = userId;
    next();
  });
  app.use("/me", meRouter);
  return app;
}

beforeEach(() => vi.clearAllMocks());

describe("GET /me/tilt", () => {
  it("returns the latest tilt event from the last 45 minutes", async () => {
    const event = {
      id: "t1",
      userId: "user1",
      lossCount: 3,
      rushing: true,
      suggestion: "Take a break.",
      createdAt: new Date().toISOString(),
    };
    vi.mocked(db.tiltEvent.findFirst).mockResolvedValueOnce(event as any);

    const res = await request(buildApp("user1")).get("/me/tilt");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ lossCount: 3, suggestion: "Take a break." });
    expect(db.tiltEvent.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "user1" }),
        orderBy: { createdAt: "desc" },
      })
    );
  });

  it("returns null when there is no recent tilt event", async () => {
    vi.mocked(db.tiltEvent.findFirst).mockResolvedValueOnce(null);

    const res = await request(buildApp("user1")).get("/me/tilt");

    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });

  it("requires a session", async () => {
    const res = await request(buildApp(undefined)).get("/me/tilt");
    expect(res.status).toBe(401);
  });
});
