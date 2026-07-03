import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("../src/db", () => ({
    db: {
        tiltEvent: { findFirst: vi.fn(), create: vi.fn() },
    },
}));
vi.mock("../src/chesscom", async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, fetchMonthlyGames: vi.fn() };
});
import { db } from "../src/db";
import { fetchMonthlyGames } from "../src/chesscom";
import { avgSecondsPerMove, analyzeTilt, checkTiltForUser, } from "../src/services/analysis/tilt-detector";
const NOW = new Date("2026-07-02T12:00:00Z");
function pgnWith(timeControl, whiteClks, blackClks) {
    const moves = [];
    const n = Math.max(whiteClks.length, blackClks.length);
    for (let i = 0; i < n; i++) {
        let move = `${i + 1}.`;
        if (whiteClks[i])
            move += ` e4 {[%clk ${whiteClks[i]}]}`;
        if (blackClks[i])
            move += ` e5 {[%clk ${blackClks[i]}]}`;
        moves.push(move);
    }
    return `[Event "Live Chess"]\n[TimeControl "${timeControl}"]\n\n${moves.join(" ")} 1-0`;
}
function makeGame(opts) {
    const color = opts.color ?? "white";
    const me = { username: "TestUser", result: opts.result, rating: 1500 };
    const opp = {
        username: "opponent",
        result: opts.result === "win" ? "resigned" : "win",
        rating: 1500,
    };
    return {
        url: "https://chess.com/game/1",
        pgn: opts.pgn ?? pgnWith("180", ["0:02:00"], ["0:02:00"]),
        time_control: "180",
        time_class: "blitz",
        end_time: Math.floor((NOW.getTime() - opts.minsAgo * 60_000) / 1000),
        white: color === "white" ? me : opp,
        black: color === "black" ? me : opp,
    };
}
beforeEach(() => vi.clearAllMocks());
describe("avgSecondsPerMove", () => {
    it("computes average seconds per move from TimeControl and %clk tags", () => {
        // base 180s, white's last clock 2:00 => used 60s over 3 moves => 20s/move
        const pgn = pgnWith("180", ["0:02:50", "0:02:20", "0:02:00"], ["0:02:55", "0:02:50", "0:02:45"]);
        expect(avgSecondsPerMove(pgn, "white")).toBe(20);
    });
    it("accounts for increment in time controls like 180+2", () => {
        // base 180, inc 2: used = 180 - 170 + 2*2 = 14 over 2 moves => 7s/move
        const pgn = pgnWith("180+2", ["0:02:55", "0:02:50"], ["0:02:58", "0:02:56"]);
        expect(avgSecondsPerMove(pgn, "white")).toBe(7);
    });
    it("returns null when the PGN has no clock annotations", () => {
        const pgn = `[TimeControl "180"]\n\n1. e4 e5 2. Nf3 Nc6 1-0`;
        expect(avgSecondsPerMove(pgn, "white")).toBeNull();
    });
});
describe("analyzeTilt", () => {
    it("flags tilt when the user has 2 losses within 45 minutes", () => {
        const games = [
            makeGame({ minsAgo: 30, result: "checkmated" }),
            makeGame({ minsAgo: 10, result: "resigned" }),
        ];
        const result = analyzeTilt(games, "testuser", NOW);
        expect(result.tilting).toBe(true);
        expect(result.lossCount).toBe(2);
    });
    it("does not flag tilt on a single loss", () => {
        const games = [makeGame({ minsAgo: 10, result: "timeout" })];
        expect(analyzeTilt(games, "testuser", NOW).tilting).toBe(false);
    });
    it("ignores losses older than 45 minutes", () => {
        const games = [
            makeGame({ minsAgo: 90, result: "checkmated" }),
            makeGame({ minsAgo: 50, result: "resigned" }),
            makeGame({ minsAgo: 10, result: "checkmated" }),
        ];
        const result = analyzeTilt(games, "testuser", NOW);
        expect(result.tilting).toBe(false);
        expect(result.lossCount).toBe(1);
    });
    it("does not count wins or draws as losses", () => {
        const games = [
            makeGame({ minsAgo: 20, result: "win" }),
            makeGame({ minsAgo: 15, result: "agreed" }),
            makeGame({ minsAgo: 10, result: "stalemate" }),
        ];
        expect(analyzeTilt(games, "testuser", NOW).lossCount).toBe(0);
    });
    it("counts losses when the user played black", () => {
        const games = [
            makeGame({ minsAgo: 20, result: "checkmated", color: "black" }),
            makeGame({ minsAgo: 10, result: "resigned", color: "black" }),
        ];
        expect(analyzeTilt(games, "testuser", NOW).tilting).toBe(true);
    });
    it("detects rushing when move speed increases across consecutive games", () => {
        const slow = pgnWith("180", ["0:02:00"], ["0:02:30"]); // 60s over 1 move
        const fast = pgnWith("180", ["0:02:50"], ["0:02:30"]); // 10s over 1 move
        const games = [
            makeGame({ minsAgo: 30, result: "checkmated", pgn: slow }),
            makeGame({ minsAgo: 10, result: "resigned", pgn: fast }),
        ];
        const result = analyzeTilt(games, "testuser", NOW);
        expect(result.rushing).toBe(true);
        expect(result.suggestion).toMatch(/faster/i);
    });
    it("does not report rushing when move speed is steady or slower", () => {
        const fast = pgnWith("180", ["0:02:50"], ["0:02:30"]);
        const slow = pgnWith("180", ["0:02:00"], ["0:02:30"]);
        const games = [
            makeGame({ minsAgo: 30, result: "checkmated", pgn: fast }),
            makeGame({ minsAgo: 10, result: "resigned", pgn: slow }),
        ];
        expect(analyzeTilt(games, "testuser", NOW).rushing).toBe(false);
    });
});
describe("checkTiltForUser", () => {
    const user = { id: "user1", chesscomUsername: "testuser" };
    it("creates a TiltEvent when the user is tilting", async () => {
        vi.mocked(fetchMonthlyGames).mockResolvedValue([
            makeGame({ minsAgo: 30, result: "checkmated" }),
            makeGame({ minsAgo: 10, result: "resigned" }),
        ]);
        vi.mocked(db.tiltEvent.findFirst).mockResolvedValue(null);
        await checkTiltForUser(user, NOW);
        expect(db.tiltEvent.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ userId: "user1", lossCount: 2 }),
        }));
    });
    it("does not create a duplicate when a recent TiltEvent exists", async () => {
        vi.mocked(fetchMonthlyGames).mockResolvedValue([
            makeGame({ minsAgo: 30, result: "checkmated" }),
            makeGame({ minsAgo: 10, result: "resigned" }),
        ]);
        vi.mocked(db.tiltEvent.findFirst).mockResolvedValue({ id: "existing" });
        await checkTiltForUser(user, NOW);
        expect(db.tiltEvent.create).not.toHaveBeenCalled();
    });
    it("does nothing when the user is not tilting", async () => {
        vi.mocked(fetchMonthlyGames).mockResolvedValue([
            makeGame({ minsAgo: 10, result: "win" }),
        ]);
        await checkTiltForUser(user, NOW);
        expect(db.tiltEvent.create).not.toHaveBeenCalled();
    });
    it("also fetches the previous month when the window crosses a month boundary", async () => {
        const monthStart = new Date("2026-07-01T00:10:00Z");
        vi.mocked(fetchMonthlyGames).mockResolvedValue([]);
        await checkTiltForUser(user, monthStart);
        expect(fetchMonthlyGames).toHaveBeenCalledWith("testuser", 2026, 7);
        expect(fetchMonthlyGames).toHaveBeenCalledWith("testuser", 2026, 6);
    });
});
