import { describe, it, expect } from "vitest";
import type { MonthlyGame } from "../src/chesscom";
import { computeStyleProfile } from "../src/services/analysis/style-classifier";

function makeGame(opts: {
  moves: string; // movetext without headers
  timeControl?: string;
  whiteClks?: string[];
  color?: "white" | "black";
}): MonthlyGame {
  const color = opts.color ?? "white";
  const me = { username: "TestUser", result: "win", rating: 1500 };
  const opp = { username: "opponent", result: "resigned", rating: 1500 };
  const tc = opts.timeControl ?? "180";
  return {
    url: "u",
    pgn: `[Event "Live Chess"]\n[TimeControl "${tc}"]\n\n${opts.moves} 1-0`,
    time_control: tc,
    time_class: "blitz",
    end_time: 1,
    white: color === "white" ? me : opp,
    black: color === "black" ? me : opp,
  };
}

describe("computeStyleProfile", () => {
  it("returns null when there are no games to analyze", () => {
    expect(computeStyleProfile([], "testuser")).toBeNull();
  });

  it("scores capture-and-check heavy play as tactical", () => {
    // every white move is a capture or check
    const game = makeGame({
      moves: "1. exd5 a6 2. Qxd5+ b6 3. Rxa6 c6 4. Bxc6+ d6",
    });
    const profile = computeStyleProfile([game], "testuser")!;
    expect(profile.tactical).toBe(100);
    expect(profile.labels.style).toBe("Tactical");
  });

  it("scores quiet maneuvering play as positional", () => {
    const game = makeGame({
      moves: "1. Nf3 d5 2. g3 c5 3. Bg2 Nc6 4. O-O e5",
    });
    const profile = computeStyleProfile([game], "testuser")!;
    expect(profile.tactical).toBe(0);
    expect(profile.labels.style).toBe("Positional");
  });

  it("scores deep pawn advances as aggressive", () => {
    // white pawns pushed into the opponent's half on every move
    const game = makeGame({
      moves: "1. e5 a6 2. f5 b6 3. g5 c6 4. h5 d6",
    });
    const profile = computeStyleProfile([game], "testuser")!;
    expect(profile.aggressive).toBe(100);
    expect(profile.labels.approach).toBe("Aggressive");
  });

  it("counts black's pawn advances toward white's half correctly", () => {
    const game = makeGame({
      moves: "1. Nf3 e4 2. Ng1 d4 3. Nf3 c4 4. Ng1 b4",
      color: "black",
    });
    const profile = computeStyleProfile([game], "testuser")!;
    expect(profile.labels.approach).toBe("Aggressive");
  });

  it("labels players who keep time in reserve as time managers", () => {
    // base 180s, ends with 2:30 left => 83% remaining
    const game = makeGame({
      moves: "1. e4 {[%clk 0:02:50]} e5 {[%clk 0:02:50]} 2. Nf3 {[%clk 0:02:30]} Nc6 {[%clk 0:02:30]}",
    });
    const profile = computeStyleProfile([game], "testuser")!;
    expect(profile.timeManagement).toBeGreaterThanOrEqual(50);
    expect(profile.labels.clock).toBe("Time Manager");
  });

  it("labels players who burn their clock as scramblers", () => {
    // base 180s, ends with 2s left
    const game = makeGame({
      moves: "1. e4 {[%clk 0:00:05]} e5 {[%clk 0:02:50]} 2. Nf3 {[%clk 0:00:02]} Nc6 {[%clk 0:02:30]}",
    });
    const profile = computeStyleProfile([game], "testuser")!;
    expect(profile.timeManagement).toBeLessThan(50);
    expect(profile.labels.clock).toBe("Scrambler");
  });

  it("reports how many games were analyzed", () => {
    const games = [
      makeGame({ moves: "1. e4 e5" }),
      makeGame({ moves: "1. d4 d5" }),
    ];
    expect(computeStyleProfile(games, "testuser")!.gamesAnalyzed).toBe(2);
  });

  it("keeps scores within 0-100", () => {
    const game = makeGame({
      moves: "1. exd5+ a6 2. Qxd5+ b6 3. e5 c6 4. f5 d6",
    });
    const profile = computeStyleProfile([game], "testuser")!;
    for (const v of [profile.tactical, profile.aggressive, profile.timeManagement]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });
});
