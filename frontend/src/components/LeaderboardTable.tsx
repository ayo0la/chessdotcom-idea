import { Link } from "react-router-dom";
import type { LeaderboardEntry } from "../api";
import DeltaBadge from "./DeltaBadge";

interface Props {
  entries: LeaderboardEntry[];
  deltas?: Record<string, number>;
  onUnfollow?: (username: string) => void;
}

const MEDALS = ["🥇", "🥈", "🥉"];

export default function LeaderboardTable({ entries, deltas = {}, onUnfollow }: Props) {
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b border-white/[0.08] text-xs uppercase tracking-wider text-gray-500">
          <th className="w-10 pb-2 pr-4 font-medium">#</th>
          <th className="pb-2 pr-4 font-medium">Player</th>
          <th className="pb-2 pr-4 text-right font-medium">Rating</th>
          <th className="pb-2 pr-4 text-right font-medium">W</th>
          <th className="pb-2 pr-4 text-right font-medium">L</th>
          <th className="pb-2 pr-4 text-right font-medium">D</th>
          {onUnfollow && <th className="pb-2" />}
        </tr>
      </thead>
      <tbody>
        {entries.map((e) => (
          <tr
            key={e.username}
            data-me={e.isMe || undefined}
            className={`border-b border-white/[0.06] transition-colors duration-150 ${
              e.isMe ? "bg-emerald-500/[0.08]" : "hover:bg-white/[0.04]"
            }`}
          >
            <td className="py-3 pr-4 text-gray-500">
              {MEDALS[e.rank - 1] ?? e.rank}
            </td>
            <td className="py-3 pr-4 font-medium text-white">
              {e.isMe ? (
                <span>
                  {e.username}
                  <span className="ml-2 rounded-full border border-emerald-500/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
                    you
                  </span>
                </span>
              ) : (
                <Link
                  to={`/search?u=${encodeURIComponent(e.username)}`}
                  className="transition-colors hover:text-emerald-400"
                  title={`Scout ${e.username}`}
                >
                  {e.username}
                </Link>
              )}
            </td>
            <td className="py-3 pr-4 text-right font-semibold tabular-nums text-white">
              <span className="mr-2">{e.rating}</span>
              {deltas[e.username] != null && <DeltaBadge delta={deltas[e.username]} />}
            </td>
            <td className="py-3 pr-4 text-right tabular-nums text-gray-400">{e.wins}</td>
            <td className="py-3 pr-4 text-right tabular-nums text-gray-400">{e.losses}</td>
            <td className="py-3 pr-4 text-right tabular-nums text-gray-400">{e.draws}</td>
            {onUnfollow && !e.isMe && (
              <td className="py-3 text-right">
                <button
                  onClick={() => onUnfollow(e.username)}
                  className="text-xs text-gray-600 transition-colors hover:text-red-400"
                >
                  unfollow
                </button>
              </td>
            )}
            {onUnfollow && e.isMe && <td />}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
