import { Chess } from "chess.js";
import type { LossGame } from "../api.js";

export type MistakeType =
  | "hanging"
  | "missed-win"
  | "time-scramble"
  | "endgame"
  | "mistake";

export interface Mistake {
  gameId: string;
  moveNumber: number;
  san: string;
  type: MistakeType;
  dropCp: number;
}

export interface Fingerprint {
  gamesAnalyzed: number;
  mistakes: number;
  byType: Record<string, number>;
  examples: Mistake[];
}

export interface ExtractedMove {
  san: string;
  clockSeconds: number | null;
}

export interface ExtractedGame {
  fens: string[]; // fens[0] is the start position, fens[i] is after ply i
  moves: ExtractedMove[];
}

const EVAL_CLAMP = 1000;
const MAX_PLIES = 80;

function clockToSeconds(comment: string): number | null {
  const m = comment.match(/\[%clk (\d+):(\d+):(\d+(?:\.\d+)?)\]/);
  if (!m) return null;
  return parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseFloat(m[3]);
}

export function extractGame(pgn: string): ExtractedGame {
  const parsed = new Chess();
  parsed.loadPgn(pgn);
  const clockByFen = new Map<string, number>();
  for (const { fen, comment } of parsed.getComments()) {
    const seconds = clockToSeconds(comment);
    if (seconds != null) clockByFen.set(fen, seconds);
  }

  const replay = new Chess();
  const fens: string[] = [replay.fen()];
  const moves: ExtractedMove[] = [];
  for (const move of parsed.history()) {
    replay.move(move);
    const fen = replay.fen();
    fens.push(fen);
    moves.push({ san: move, clockSeconds: clockByFen.get(fen) ?? null });
  }
  return { fens, moves };
}

function piecesOnBoard(fen: string): number {
  const board = fen.split(" ")[0];
  return (board.match(/[a-zA-Z]/g) ?? []).length;
}

export function classifyMistake(input: {
  dropCp: number;
  evalBefore: number;
  evalAfter: number;
  clockSeconds: number | null;
  piecesLeft: number;
}): MistakeType | null {
  const { dropCp, evalBefore, evalAfter, clockSeconds, piecesLeft } = input;
  if (dropCp < 120) return null;
  if (clockSeconds != null && clockSeconds <= 20) return "time-scramble";
  if (dropCp < 250) return "mistake";
  if (evalBefore >= 150 && evalAfter <= 50) return "missed-win";
  if (piecesLeft <= 12) return "endgame";
  return "hanging";
}

export async function analyzeLosses(
  losses: LossGame[],
  evalFn: (fen: string) => Promise<number>, // centipawns from white's perspective
  onProgress?: (gamesDone: number, totalGames: number) => void
): Promise<Mistake[]> {
  const mistakes: Mistake[] = [];

  for (let g = 0; g < losses.length; g++) {
    const loss = losses[g];
    let game: ExtractedGame;
    try {
      game = extractGame(loss.pgn);
    } catch {
      onProgress?.(g + 1, losses.length);
      continue;
    }

    const plies = Math.min(game.moves.length, MAX_PLIES);
    const sign = loss.color === "white" ? 1 : -1;
    const evals: number[] = [];
    for (let i = 0; i <= plies; i++) {
      const raw = await evalFn(game.fens[i]);
      evals.push(Math.max(-EVAL_CLAMP, Math.min(EVAL_CLAMP, raw * sign)));
    }

    for (let i = 0; i < plies; i++) {
      const isMyMove = (i % 2 === 0) === (loss.color === "white");
      if (!isMyMove) continue;
      const evalBefore = evals[i];
      const evalAfter = evals[i + 1];
      const type = classifyMistake({
        dropCp: evalBefore - evalAfter,
        evalBefore,
        evalAfter,
        clockSeconds: game.moves[i].clockSeconds,
        piecesLeft: piecesOnBoard(game.fens[i]),
      });
      if (type) {
        mistakes.push({
          gameId: loss.gameId,
          moveNumber: Math.floor(i / 2) + 1,
          san: game.moves[i].san,
          type,
          dropCp: evalBefore - evalAfter,
        });
      }
    }
    onProgress?.(g + 1, losses.length);
  }

  return mistakes;
}

export function summarizeFingerprint(
  mistakes: Mistake[],
  gamesAnalyzed: number
): Fingerprint {
  const byType: Record<string, number> = {};
  for (const m of mistakes) byType[m.type] = (byType[m.type] ?? 0) + 1;
  const examples = [...mistakes].sort((a, b) => b.dropCp - a.dropCp).slice(0, 5);
  return { gamesAnalyzed, mistakes: mistakes.length, byType, examples };
}

export const MISTAKE_LABELS: Record<MistakeType, string> = {
  hanging: "Hung material",
  "missed-win": "Threw away a win",
  "time-scramble": "Time scramble",
  endgame: "Endgame technique",
  mistake: "Inaccuracies",
};

export const MISTAKE_ADVICE: Record<MistakeType, string> = {
  hanging:
    "Before every move, do one scan: what of mine is undefended, and what can my opponent capture or fork?",
  "missed-win":
    "When you are clearly winning, slow down and simplify. Trade pieces, not pawns, and shut down counterplay.",
  "time-scramble":
    "You lose games on the clock, not the board. Practice a faster opening routine so you reach the middlegame with more time.",
  endgame:
    "Drill basic endgames: king activity, opposition, and passed pawn races. Ten minutes of endgame practice per day pays fast.",
  mistake:
    "Your small errors add up. After each opponent move, ask what changed before picking your reply.",
};
