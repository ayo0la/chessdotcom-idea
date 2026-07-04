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
    debriefPrompt: { findFirst: vi.fn() },
    debrief: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), count: vi.fn() },
  },
}));
vi.mock("../src/services/claude", () => ({
  claudeEnabled: vi.fn(),
  generateText: vi.fn(),
}));

import { db } from "../src/db";
import { claudeEnabled, generateText } from "../src/services/claude";
import meRouter from "../src/routes/me";

const ANSWERS = {
  opening: "Sicilian",
  phase: "middlegame",
  losingMoment: "hung the knight on move 24",
  cause: "blunder",
  hadPlan: "no",
  tooFast: "yes",
  emotion: "tilted",
  nextTime: "slow down after captures",
};

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

describe("GET /me/debrief-prompt", () => {
  it("returns the latest unanswered prompt", async () => {
    const prompt = { id: "p1", gameId: "g1", gameUrl: "https://chess.com/game/1" };
    vi.mocked(db.debriefPrompt.findFirst).mockResolvedValueOnce(prompt as any);
    vi.mocked(db.debrief.findFirst).mockResolvedValueOnce(null);

    const res = await request(buildApp("user1")).get("/me/debrief-prompt");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ gameId: "g1" });
  });

  it("returns null when the prompt was already answered", async () => {
    vi.mocked(db.debriefPrompt.findFirst).mockResolvedValueOnce({
      id: "p1",
      gameId: "g1",
    } as any);
    vi.mocked(db.debrief.findFirst).mockResolvedValueOnce({ id: "d1" } as any);

    const res = await request(buildApp("user1")).get("/me/debrief-prompt");

    expect(res.body).toBeNull();
  });

  it("returns null when there is no recent prompt", async () => {
    vi.mocked(db.debriefPrompt.findFirst).mockResolvedValueOnce(null);

    const res = await request(buildApp("user1")).get("/me/debrief-prompt");

    expect(res.body).toBeNull();
  });
});

describe("POST /me/debriefs", () => {
  it("stores a debrief with its answers", async () => {
    vi.mocked(db.debrief.findFirst).mockResolvedValueOnce(null);
    vi.mocked(db.debrief.create).mockResolvedValueOnce({ id: "d1" } as any);

    const res = await request(buildApp("user1"))
      .post("/me/debriefs")
      .send({ gameId: "g1", answers: ANSWERS });

    expect(res.status).toBe(201);
    expect(db.debrief.create).toHaveBeenCalledWith({
      data: { userId: "user1", gameId: "g1", answers: ANSWERS },
    });
  });

  it("rejects a submission without a gameId", async () => {
    const res = await request(buildApp("user1"))
      .post("/me/debriefs")
      .send({ answers: ANSWERS });
    expect(res.status).toBe(400);
  });

  it("rejects a submission with empty answers", async () => {
    const res = await request(buildApp("user1"))
      .post("/me/debriefs")
      .send({ gameId: "g1", answers: {} });
    expect(res.status).toBe(400);
  });

  it("rejects a duplicate debrief for the same game", async () => {
    vi.mocked(db.debrief.findFirst).mockResolvedValueOnce({ id: "d1" } as any);

    const res = await request(buildApp("user1"))
      .post("/me/debriefs")
      .send({ gameId: "g1", answers: ANSWERS });

    expect(res.status).toBe(409);
  });

  it("requires a session", async () => {
    const res = await request(buildApp(undefined))
      .post("/me/debriefs")
      .send({ gameId: "g1", answers: ANSWERS });
    expect(res.status).toBe(401);
  });
});

describe("GET /me/debriefs/summary", () => {
  it("returns count and streak without a narrative when below 10 debriefs", async () => {
    vi.mocked(db.debrief.count).mockResolvedValueOnce(4);
    vi.mocked(db.debrief.findMany).mockResolvedValueOnce([
      { createdAt: new Date() },
    ] as any);

    const res = await request(buildApp("user1")).get("/me/debriefs/summary");

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(4);
    expect(typeof res.body.streak).toBe("number");
    expect(res.body.narrative).toBeNull();
    expect(generateText).not.toHaveBeenCalled();
  });

  it("generates a Claude diagnosis when requested with 10+ debriefs", async () => {
    vi.mocked(db.debrief.count).mockResolvedValueOnce(12);
    vi.mocked(db.debrief.findMany).mockResolvedValue([
      { createdAt: new Date(), answers: ANSWERS },
    ] as any);
    vi.mocked(claudeEnabled).mockReturnValue(true);
    vi.mocked(generateText).mockResolvedValueOnce("You consistently rush after captures.");

    const res = await request(buildApp("user1")).get(
      "/me/debriefs/summary?narrative=1"
    );

    expect(res.status).toBe(200);
    expect(res.body.narrative).toBe("You consistently rush after captures.");
  });

  it("does not generate a narrative below 10 debriefs even when requested", async () => {
    vi.mocked(db.debrief.count).mockResolvedValueOnce(3);
    vi.mocked(db.debrief.findMany).mockResolvedValue([] as any);

    const res = await request(buildApp("user1")).get(
      "/me/debriefs/summary?narrative=1"
    );

    expect(res.body.narrative).toBeNull();
    expect(generateText).not.toHaveBeenCalled();
  });

  it("returns 503 when a narrative is requested but Claude is not configured", async () => {
    vi.mocked(db.debrief.count).mockResolvedValueOnce(12);
    vi.mocked(db.debrief.findMany).mockResolvedValue([] as any);
    vi.mocked(claudeEnabled).mockReturnValue(false);

    const res = await request(buildApp("user1")).get(
      "/me/debriefs/summary?narrative=1"
    );

    expect(res.status).toBe(503);
  });
});
