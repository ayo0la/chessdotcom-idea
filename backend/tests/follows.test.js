import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
vi.mock("../src/chesscom", () => ({
    fetchPlayerExists: vi.fn(),
    fetchPlayerRatings: vi.fn(),
}));
vi.mock("../src/db", () => ({
    db: {
        user: { upsert: vi.fn(), findUnique: vi.fn() },
        follow: { upsert: vi.fn(), delete: vi.fn() },
        rating: { upsert: vi.fn() },
    },
}));
vi.mock("../src/middleware/requireSession", () => ({
    requireSession: (_req, _res, next) => next(),
}));
import { fetchPlayerExists, fetchPlayerRatings } from "../src/chesscom";
import { db } from "../src/db";
import followsRouter from "../src/routes/follows";
function buildApp(userId = "viewer1") {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.session = { userId };
        next();
    });
    app.use("/follows", followsRouter);
    return app;
}
beforeEach(() => vi.clearAllMocks());
describe("POST /follows/:username", () => {
    it("returns 404 when target does not exist on Chess.com", async () => {
        vi.mocked(fetchPlayerExists).mockResolvedValueOnce(false);
        const res = await request(buildApp()).post("/follows/nobody");
        expect(res.status).toBe(404);
    });
    it("creates follow (upsert) and seeds ratings into Postgres", async () => {
        vi.mocked(fetchPlayerExists).mockResolvedValueOnce(true);
        vi.mocked(fetchPlayerRatings).mockResolvedValueOnce([
            { timeControl: "blitz", rating: 3100, wins: 500, losses: 100, draws: 50 },
        ]);
        vi.mocked(db.user.upsert).mockResolvedValueOnce({
            id: "target1",
            chesscomUsername: "hikaru",
            claimed: false,
            createdAt: new Date(),
        });
        vi.mocked(db.follow.upsert).mockResolvedValueOnce({});
        vi.mocked(db.rating.upsert).mockResolvedValueOnce({});
        const res = await request(buildApp()).post("/follows/hikaru");
        expect(res.status).toBe(201);
        expect(db.follow.upsert).toHaveBeenCalledWith({
            where: { followerId_followingId: { followerId: "viewer1", followingId: "target1" } },
            update: {},
            create: { followerId: "viewer1", followingId: "target1" },
        });
        expect(db.rating.upsert).toHaveBeenCalled();
    });
    it("returns 201 on duplicate follow (idempotent)", async () => {
        vi.mocked(fetchPlayerExists).mockResolvedValueOnce(true);
        vi.mocked(fetchPlayerRatings).mockResolvedValueOnce([]);
        vi.mocked(db.user.upsert).mockResolvedValueOnce({
            id: "target1",
            chesscomUsername: "hikaru",
            claimed: false,
            createdAt: new Date(),
        });
        vi.mocked(db.follow.upsert).mockResolvedValueOnce({});
        const res = await request(buildApp()).post("/follows/hikaru");
        expect(res.status).toBe(201);
    });
});
describe("DELETE /follows/:username", () => {
    it("returns 404 when target player is not in DB", async () => {
        vi.mocked(db.user.findUnique).mockResolvedValueOnce(null);
        const res = await request(buildApp()).delete("/follows/ghost");
        expect(res.status).toBe(404);
    });
    it("deletes the follow relationship and returns 204", async () => {
        vi.mocked(db.user.findUnique).mockResolvedValueOnce({
            id: "target1",
            chesscomUsername: "hikaru",
            claimed: false,
            createdAt: new Date(),
        });
        vi.mocked(db.follow.delete).mockResolvedValueOnce({});
        const res = await request(buildApp()).delete("/follows/hikaru");
        expect(res.status).toBe(204);
        expect(db.follow.delete).toHaveBeenCalledWith({
            where: {
                followerId_followingId: { followerId: "viewer1", followingId: "target1" },
            },
        });
    });
    it("returns 204 when follow does not exist (P2025 idempotent delete)", async () => {
        vi.mocked(db.user.findUnique).mockResolvedValueOnce({
            id: "target1",
            chesscomUsername: "hikaru",
            claimed: false,
            createdAt: new Date(),
        });
        const p2025Error = Object.assign(new Error("Record not found"), { code: "P2025" });
        vi.mocked(db.follow.delete).mockRejectedValueOnce(p2025Error);
        const res = await request(buildApp()).delete("/follows/hikaru");
        expect(res.status).toBe(204);
    });
});
