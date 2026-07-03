import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchPlayerExists, fetchPlayerRatings, fetchMonthlyGames, } from "../src/chesscom";
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);
beforeEach(() => mockFetch.mockReset());
describe("fetchPlayerExists", () => {
    it("returns true when Chess.com returns 200", async () => {
        mockFetch.mockResolvedValueOnce({ ok: true });
        expect(await fetchPlayerExists("hikaru")).toBe(true);
        expect(mockFetch).toHaveBeenCalledWith("https://api.chess.com/pub/player/hikaru");
    });
    it("returns false when Chess.com returns 404", async () => {
        mockFetch.mockResolvedValueOnce({ ok: false });
        expect(await fetchPlayerExists("notarealusername_xyz")).toBe(false);
    });
});
describe("fetchPlayerRatings", () => {
    it("maps blitz and rapid ratings from stats response", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                chess_blitz: {
                    last: { rating: 3100 },
                    record: { win: 500, loss: 100, draw: 50 },
                },
                chess_rapid: {
                    last: { rating: 2900 },
                    record: { win: 200, loss: 80, draw: 30 },
                },
            }),
        });
        const ratings = await fetchPlayerRatings("hikaru");
        expect(ratings).toContainEqual({
            timeControl: "blitz",
            rating: 3100,
            wins: 500,
            losses: 100,
            draws: 50,
        });
        expect(ratings).toContainEqual({
            timeControl: "rapid",
            rating: 2900,
            wins: 200,
            losses: 80,
            draws: 30,
        });
    });
    it("omits time controls with no data", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                chess_blitz: {
                    last: { rating: 1500 },
                    record: { win: 10, loss: 5, draw: 2 },
                },
            }),
        });
        const ratings = await fetchPlayerRatings("newplayer");
        expect(ratings).toHaveLength(1);
        expect(ratings[0].timeControl).toBe("blitz");
    });
    it("returns empty array when API fails", async () => {
        mockFetch.mockResolvedValueOnce({ ok: false });
        expect(await fetchPlayerRatings("hikaru")).toEqual([]);
    });
});
describe("fetchMonthlyGames", () => {
    it("fetches the monthly archive with a zero-padded month", async () => {
        const games = [{ url: "u", end_time: 1 }];
        mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ games }) });
        const result = await fetchMonthlyGames("hikaru", 2026, 7);
        expect(mockFetch).toHaveBeenCalledWith("https://api.chess.com/pub/player/hikaru/games/2026/07");
        expect(result).toEqual(games);
    });
    it("returns empty array when the API fails", async () => {
        mockFetch.mockResolvedValueOnce({ ok: false });
        expect(await fetchMonthlyGames("hikaru", 2026, 7)).toEqual([]);
    });
    it("returns empty array when the archive has no games field", async () => {
        mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
        expect(await fetchMonthlyGames("hikaru", 2026, 7)).toEqual([]);
    });
});
