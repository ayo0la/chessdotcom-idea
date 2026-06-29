import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// Mock dependencies before importing routes
vi.mock("../src/chesscom", () => ({
  fetchPlayerExists: vi.fn(),
}));
vi.mock("../src/db", () => ({
  db: {
    user: {
      upsert: vi.fn(),
    },
  },
}));
vi.mock("../src/session", () => ({
  sessionParser: (
    _req: express.Request,
    _res: express.Response,
    next: express.NextFunction
  ) => next(),
}));

import { fetchPlayerExists } from "../src/chesscom";
import { db } from "../src/db";
import authRouter from "../src/routes/auth";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).session = { userId: undefined, destroy: vi.fn((cb) => cb()) };
    next();
  });
  app.use("/auth", authRouter);
  return app;
}

beforeEach(() => vi.clearAllMocks());

describe("POST /auth/claim", () => {
  it("returns 400 when username is missing", async () => {
    const res = await request(buildApp()).post("/auth/claim").send({});
    expect(res.status).toBe(400);
  });

  it("returns 404 when username does not exist on Chess.com", async () => {
    vi.mocked(fetchPlayerExists).mockResolvedValueOnce(false);
    const res = await request(buildApp())
      .post("/auth/claim")
      .send({ username: "notreal_xyz" });
    expect(res.status).toBe(404);
  });

  it("creates user and returns 200 with userId when username is valid", async () => {
    vi.mocked(fetchPlayerExists).mockResolvedValueOnce(true);
    vi.mocked(db.user.upsert).mockResolvedValueOnce({
      id: "user1",
      chesscomUsername: "hikaru",
      claimed: true,
      createdAt: new Date(),
    } as any);

    const res = await request(buildApp())
      .post("/auth/claim")
      .send({ username: "hikaru" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ userId: "user1", chesscomUsername: "hikaru" });
  });
});

describe("DELETE /auth/session", () => {
  it("returns 204 and destroys session", async () => {
    const res = await request(buildApp()).delete("/auth/session");
    expect(res.status).toBe(204);
  });
});
