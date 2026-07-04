import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const mockGetUser = vi.hoisted(() => vi.fn());

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ auth: { getUser: mockGetUser } })),
}));
vi.mock("../src/db", () => ({
  db: { user: { findUnique: vi.fn() } },
}));

import { db } from "../src/db";
import { requireAuth, requireLinkedUser } from "../src/middleware/requireAuth";

function buildApp() {
  const app = express();
  app.get("/protected", requireAuth, (req, res) => {
    res.json({ authId: req.authId });
  });
  app.get("/linked", requireAuth, requireLinkedUser, (req, res) => {
    res.json({ userId: req.userId });
  });
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_ANON_KEY = "test-anon-key";
});

describe("requireAuth", () => {
  it("rejects requests without a bearer token", async () => {
    const res = await request(buildApp()).get("/protected");
    expect(res.status).toBe(401);
  });

  it("rejects invalid tokens", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: { message: "bad" } });
    const res = await request(buildApp())
      .get("/protected")
      .set("Authorization", "Bearer bad-token");
    expect(res.status).toBe(401);
  });

  it("attaches the auth id for valid tokens", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "auth-1" } }, error: null });
    const res = await request(buildApp())
      .get("/protected")
      .set("Authorization", "Bearer good-token");
    expect(res.status).toBe(200);
    expect(res.body.authId).toBe("auth-1");
    expect(mockGetUser).toHaveBeenCalledWith("good-token");
  });
});

describe("requireLinkedUser", () => {
  it("rejects authenticated users with no linked chess.com account", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "auth-1" } }, error: null });
    vi.mocked(db.user.findUnique).mockResolvedValueOnce(null);

    const res = await request(buildApp())
      .get("/linked")
      .set("Authorization", "Bearer good-token");
    expect(res.status).toBe(403);
  });

  it("attaches the app user id when linked", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "auth-1" } }, error: null });
    vi.mocked(db.user.findUnique).mockResolvedValueOnce({ id: "user-9" } as any);

    const res = await request(buildApp())
      .get("/linked")
      .set("Authorization", "Bearer good-token");
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe("user-9");
    expect(db.user.findUnique).toHaveBeenCalledWith({ where: { authId: "auth-1" } });
  });
});
