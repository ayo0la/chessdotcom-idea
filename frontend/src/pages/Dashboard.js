import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import TimeControlTabs from "../components/TimeControlTabs";
import LeaderboardTable from "../components/LeaderboardTable";
import { useLeaderboard } from "../hooks/useLeaderboard";
import { useWebSocket } from "../hooks/useWebSocket";
import { getMe, unfollowPlayer } from "../api";
export default function Dashboard() {
    const navigate = useNavigate();
    const [tc, setTc] = useState("blitz");
    const { entries, loading, update, remove } = useLeaderboard(tc);
    const [deltas, setDeltas] = useState({});
    const [me, setMe] = useState(null);
    useEffect(() => {
        getMe()
            .then(setMe)
            .catch(() => navigate("/"));
    }, [navigate]);
    useWebSocket((msg) => {
        if (msg.type === "rating_update" && "timeControl" in msg && msg.timeControl === tc) {
            const m = msg;
            update(m.username, m.rating);
            setDeltas((prev) => ({ ...prev, [m.username]: m.delta }));
            setTimeout(() => {
                setDeltas((prev) => {
                    const next = { ...prev };
                    delete next[m.username];
                    return next;
                });
            }, 3000);
        }
    });
    async function handleUnfollow(username) {
        await unfollowPlayer(username);
        remove(username);
    }
    return (_jsxs("main", { className: "min-h-screen bg-gray-950 text-white px-4 py-8 max-w-3xl mx-auto", children: [_jsxs("div", { className: "flex items-center justify-between mb-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold", children: "Leaderboard" }), me && (_jsxs("p", { className: "text-gray-400 text-sm mt-1", children: ["Signed in as ", me.chesscomUsername] }))] }), _jsx(Link, { to: "/search", className: "text-green-400 text-sm hover:underline", children: "+ Follow players" })] }), _jsx(TimeControlTabs, { active: tc, onChange: setTc }), loading ? (_jsx("p", { className: "text-gray-500 text-sm", children: "Loading..." })) : entries.length === 0 ? (_jsxs("p", { className: "text-gray-500 text-sm", children: ["No players yet.", " ", _jsx(Link, { to: "/search", className: "text-green-400 hover:underline", children: "Follow someone to get started." })] })) : (_jsx(LeaderboardTable, { entries: entries, deltas: deltas, onUnfollow: handleUnfollow }))] }));
}
