import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("../src/middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    const authId = req.headers["x-test-auth"];
    if (!authId) return res.status(401).json({ error: "Unauthorized" });
    req.authId = authId;
    next();
  },
  requireLinkedUser: (req: any, res: any, next: any) => next(),
}));
vi.mock("../src/db", () => ({
  db: {
    user: { findUnique: vi.fn(), upsert: vi.fn() },
    pendingLink: { findUnique: vi.fn(), upsert: vi.fn(), delete: vi.fn() },
  },
}));
vi.mock("../src/chesscom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/chesscom")>();
  return { ...actual, fetchPlayerExists: vi.fn(), fetchPlayerProfile: vi.fn() };
});

import { db } from "../src/db";
import { fetchPlayerExists, fetchPlayerProfile } from "../src/chesscom";
import accountRouter from "../src/routes/account";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/account", accountRouter);
  return app;
}

beforeEach(() => vi.clearAllMocks());

describe("GET /account/status", () => {
  it("requires authentication", async () => {
    const res = await request(buildApp()).get("/account/status");
    expect(res.status).toBe(401);
  });

  it("reports linked user and pending link state", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValueOnce({
      id: "u1",
      chesscomUsername: "babayaro11",
    } as any);
    vi.mocked(db.pendingLink.findUnique).mockResolvedValueOnce(null);

    const res = await request(buildApp())
      .get("/account/status")
      .set("x-test-auth", "auth-1");

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ userId: "u1", chesscomUsername: "babayaro11" });
    expect(res.body.pending).toBeNull();
  });
});

describe("POST /account/link", () => {
  it("rejects usernames that do not exist on Chess.com", async () => {
    vi.mocked(fetchPlayerExists).mockResolvedValueOnce(false);

    const res = await request(buildApp())
      .post("/account/link")
      .set("x-test-auth", "auth-1")
      .send({ username: "nope_xyz" });

    expect(res.status).toBe(404);
  });

  it("rejects usernames already verified by another account", async () => {
    vi.mocked(fetchPlayerExists).mockResolvedValueOnce(true);
    vi.mocked(db.user.findUnique).mockResolvedValueOnce({
      id: "u2",
      authId: "someone-else",
    } as any);

    const res = await request(buildApp())
      .post("/account/link")
      .set("x-test-auth", "auth-1")
      .send({ username: "babayaro11" });

    expect(res.status).toBe(409);
  });

  it("creates a pending link with a verification code", async () => {
    vi.mocked(fetchPlayerExists).mockResolvedValueOnce(true);
    vi.mocked(db.user.findUnique).mockResolvedValueOnce(null);
    vi.mocked(db.pendingLink.upsert).mockResolvedValueOnce({} as any);

    const res = await request(buildApp())
      .post("/account/link")
      .set("x-test-auth", "auth-1")
      .send({ username: "BabaYaro11" });

    expect(res.status).toBe(200);
    expect(res.body.username).toBe("babayaro11");
    expect(res.body.code).toMatch(/^CR-[A-Z0-9]{6}$/);
    expect(db.pendingLink.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { authId: "auth-1" } })
    );
  });
});

describe("POST /account/verify", () => {
  const pending = { authId: "auth-1", username: "babayaro11", code: "CR-ABC123" };

  it("fails when there is no pending link", async () => {
    vi.mocked(db.pendingLink.findUnique).mockResolvedValueOnce(null);

    const res = await request(buildApp())
      .post("/account/verify")
      .set("x-test-auth", "auth-1");

    expect(res.status).toBe(400);
  });

  it("fails when the code is not in the profile location", async () => {
    vi.mocked(db.pendingLink.findUnique).mockResolvedValueOnce(pending as any);
    vi.mocked(fetchPlayerProfile).mockResolvedValueOnce({ location: "Atlanta" } as any);

    const res = await request(buildApp())
      .post("/account/verify")
      .set("x-test-auth", "auth-1");

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/code/i);
  });

  it("links the account when the code is present and cleans up", async () => {
    vi.mocked(db.pendingLink.findUnique).mockResolvedValueOnce(pending as any);
    vi.mocked(fetchPlayerProfile).mockResolvedValueOnce({
      location: "Atlanta CR-ABC123",
    } as any);
    vi.mocked(db.user.upsert).mockResolvedValueOnce({
      id: "u1",
      chesscomUsername: "babayaro11",
    } as any);
    vi.mocked(db.pendingLink.delete).mockResolvedValueOnce({} as any);

    const res = await request(buildApp())
      .post("/account/verify")
      .set("x-test-auth", "auth-1");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ userId: "u1", chesscomUsername: "babayaro11" });
    expect(db.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { chesscomUsername: "babayaro11" },
        update: expect.objectContaining({ authId: "auth-1", claimed: true }),
      })
    );
    expect(db.pendingLink.delete).toHaveBeenCalled();
  });
});

describe("fetchPlayerProfile contract", () => {
  it("is exported from chesscom", () => {
    expect(typeof fetchPlayerProfile).toBe("function");
  });
});
