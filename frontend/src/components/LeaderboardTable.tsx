import { Link } from "react-router-dom";
import type { LeaderboardEntry } from "../api";
import DeltaBadge from "./DeltaBadge";

interface Props {
  entries: LeaderboardEntry[];
  deltas?: Record<string, number>;
  onUnfollow?: (username: string) => void;
}

export default function LeaderboardTable({ entries, deltas = {}, onUnfollow }: Props) {
  return (
    <table className="w-full text-sm text-left">
      <thead>
        <tr className="text-gray-500 border-b border-gray-800">
          <th className="pb-2 pr-4 w-10">#</th>
          <th className="pb-2 pr-4">Player</th>
          <th className="pb-2 pr-4 text-right">Rating</th>
          <th className="pb-2 pr-4 text-right">W</th>
          <th className="pb-2 pr-4 text-right">L</th>
          <th className="pb-2 pr-4 text-right">D</th>
          {onUnfollow && <th className="pb-2" />}
        </tr>
      </thead>
      <tbody>
        {entries.map((e) => (
          <tr
            key={e.username}
            className={`border-b border-gray-800 ${
              e.isMe ? "bg-green-900" : "hover:bg-gray-900"
            }`}
          >
            <td className="py-3 pr-4 text-gray-500">{e.rank}</td>
            <td className="py-3 pr-4 font-medium text-white">
              {e.isMe ? (
                e.username
              ) : (
                <Link
                  to={`/search?u=${encodeURIComponent(e.username)}`}
                  className="hover:text-green-400 hover:underline"
                  title={`Scout ${e.username}`}
                >
                  {e.username}
                </Link>
              )}
            </td>
            <td className="py-3 pr-4 text-right text-white">
              <span className="mr-2">{e.rating}</span>
              {deltas[e.username] != null && (
                <DeltaBadge delta={deltas[e.username]} />
              )}
            </td>
            <td className="py-3 pr-4 text-right text-gray-400">{e.wins}</td>
            <td className="py-3 pr-4 text-right text-gray-400">{e.losses}</td>
            <td className="py-3 pr-4 text-right text-gray-400">{e.draws}</td>
            {onUnfollow && !e.isMe && (
              <td className="py-3 text-right">
                <button
                  onClick={() => onUnfollow(e.username)}
                  className="text-gray-600 hover:text-red-400 text-xs"
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
