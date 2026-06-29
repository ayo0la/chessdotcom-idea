const BASE = "https://api.chess.com/pub";

export type TimeControl = "bullet" | "blitz" | "rapid" | "classical";

export interface PlayerRating {
  timeControl: TimeControl;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
}

interface ChesscomTimeEntry {
  last: { rating: number };
  record: { win: number; loss: number; draw: number };
}

interface ChesscomStats {
  chess_bullet?: ChesscomTimeEntry;
  chess_blitz?: ChesscomTimeEntry;
  chess_rapid?: ChesscomTimeEntry;
  chess_daily?: ChesscomTimeEntry;
}

const TC_MAP: Array<[TimeControl, keyof ChesscomStats]> = [
  ["bullet", "chess_bullet"],
  ["blitz", "chess_blitz"],
  ["rapid", "chess_rapid"],
  ["classical", "chess_daily"],
];

export async function fetchPlayerExists(username: string): Promise<boolean> {
  const res = await fetch(`${BASE}/player/${username}`);
  return res.ok;
}

export async function fetchPlayerRatings(
  username: string
): Promise<PlayerRating[]> {
  const res = await fetch(`${BASE}/player/${username}/stats`);
  if (!res.ok) return [];

  const data: ChesscomStats = await res.json();

  return TC_MAP.filter(([, key]) => data[key] != null).map(([tc, key]) => {
    const entry = data[key]!;
    return {
      timeControl: tc,
      rating: entry.last.rating,
      wins: entry.record.win,
      losses: entry.record.loss,
      draws: entry.record.draw,
    };
  });
}
