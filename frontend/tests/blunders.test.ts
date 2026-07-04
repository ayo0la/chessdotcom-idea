import { describe, it, expect } from "vitest";
import {
  extractGame,
  classifyMistake,
  analyzeLosses,
  summarizeFingerprint,
} from "../src/lib/blunders";
import type { LossGame } from "../src/api";

// White walks into fool's mate: 1. f3 e5 2. g4 Qh4#
const FOOLS_MATE_PGN = [
  '[Event "Live Chess"]',
  '[TimeControl "180"]',
  "",
  "1. f3 {[%clk 0:02:55]} e5 {[%clk 0:02:58]} 2. g4 {[%clk 0:02:50]} Qh4# {[%clk 0:02:57]} 0-1",
].join("\n");

const loss: LossGame = {
  gameId: "https://chess.com/game/1",
  pgn: FOOLS_MATE_PGN,
  color: "white",
  timeControl: "180",
  endTime: 1,
};

describe("extractGame", () => {
  it("produces a fen for every position and parses clocks", () => {
    const game = extractGame(FOOLS_MATE_PGN);

    expect(game.fens).toHaveLength(5); // start + 4 plies
    expect(game.fens[0]).toContain("rnbqkbnr/pppppppp");
    expect(game.moves).toHaveLength(4);
    expect(game.moves[0]).toMatchObject({ san: "f3", clockSeconds: 175 });
    expect(game.moves[3].san).toBe("Qh4#");
  });
});

describe("classifyMistake", () => {
  const base = {
    dropCp: 300,
    evalBefore: 20,
    evalAfter: -280,
    clockSeconds: 100,
    piecesLeft: 28,
  };

  it("ignores small eval drops", () => {
    expect(classifyMistake({ ...base, dropCp: 80 })).toBeNull();
  });

  it("labels moderate drops as mistakes", () => {
    expect(classifyMistake({ ...base, dropCp: 150 })).toBe("mistake");
  });

  it("labels big drops as hanging material", () => {
    expect(classifyMistake(base)).toBe("hanging");
  });

  it("blames the clock when seconds are nearly gone", () => {
    expect(classifyMistake({ ...base, clockSeconds: 8 })).toBe("time-scramble");
  });

  it("flags throwing away a winning position", () => {
    expect(
      classifyMistake({ ...base, dropCp: 400, evalBefore: 350, evalAfter: -50 })
    ).toBe("missed-win");
  });

  it("flags endgame technique with few pieces left", () => {
    expect(classifyMistake({ ...base, piecesLeft: 9 })).toBe("endgame");
  });
});

describe("analyzeLosses", () => {
  it("finds my blunders using engine evals", async () => {
    // evals from white's perspective per fen: start, after f3, after e5, after g4, mate
    const evalByIndex = [20, 0, 0, -1000, -1000];
    let call = 0;
    const evalFn = async () => evalByIndex[call++];

    const progress: Array<[number, number]> = [];
    const mistakes = await analyzeLosses([loss], evalFn, (done, total) =>
      progress.push([done, total])
    );

    expect(mistakes).toHaveLength(1);
    expect(mistakes[0]).toMatchObject({
      gameId: "https://chess.com/game/1",
      san: "g4",
      moveNumber: 2,
      type: "hanging",
    });
    expect(progress[progress.length - 1]).toEqual([1, 1]);
  });

  it("negates evals when I played black", async () => {
    const blackLoss: LossGame = { ...loss, color: "black" };
    // white perspective evals: black's e5 is fine, so no black blunder here
    const evalByIndex = [20, 0, 0, -1000, -1000];
    let call = 0;
    const evalFn = async () => evalByIndex[call++];

    const mistakes = await analyzeLosses([blackLoss], evalFn);

    expect(mistakes).toHaveLength(0);
  });
});

describe("summarizeFingerprint", () => {
  it("aggregates by type and keeps the worst examples", () => {
    const mistakes = [
      { gameId: "g1", moveNumber: 5, san: "Qh5", type: "hanging" as const, dropCp: 400 },
      { gameId: "g1", moveNumber: 22, san: "Rd8", type: "hanging" as const, dropCp: 700 },
      { gameId: "g2", moveNumber: 40, san: "Kg2", type: "time-scramble" as const, dropCp: 300 },
    ];

    const fp = summarizeFingerprint(mistakes, 8);

    expect(fp.gamesAnalyzed).toBe(8);
    expect(fp.mistakes).toBe(3);
    expect(fp.byType).toMatchObject({ hanging: 2, "time-scramble": 1 });
    expect(fp.examples[0]).toMatchObject({ san: "Rd8", dropCp: 700 });
    expect(fp.examples.length).toBeLessThanOrEqual(5);
  });
});
