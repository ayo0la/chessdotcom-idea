import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { Link } from "react-router-dom";
import { searchPlayer, followPlayer } from "../api";
export default function Search() {
    const [query, setQuery] = useState("");
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [followed, setFollowed] = useState(false);
    const [searching, setSearching] = useState(false);
    async function handleSearch(e) {
        e.preventDefault();
        setError(null);
        setResult(null);
        setFollowed(false);
        setSearching(true);
        try {
            const data = await searchPlayer(query.trim());
            setResult(data);
        }
        catch {
            setError("Player not found on Chess.com.");
        }
        finally {
            setSearching(false);
        }
    }
    async function handleFollow() {
        if (!result)
            return;
        await followPlayer(result.username);
        setFollowed(true);
    }
    return (_jsxs("main", { className: "min-h-screen bg-gray-950 text-white px-4 py-8 max-w-xl mx-auto", children: [_jsxs("div", { className: "flex items-center justify-between mb-6", children: [_jsx("h1", { className: "text-2xl font-bold", children: "Find Players" }), _jsx(Link, { to: "/dashboard", className: "text-green-400 text-sm hover:underline", children: "\u2190 Back" })] }), _jsxs("form", { onSubmit: handleSearch, className: "flex gap-2 mb-6", children: [_jsx("input", { type: "text", placeholder: "Chess.com username", value: query, onChange: (e) => setQuery(e.target.value), className: "flex-1 bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-green-500", required: true }), _jsx("button", { type: "submit", disabled: searching, className: "bg-green-600 hover:bg-green-500 text-white font-semibold px-4 py-2 rounded disabled:opacity-50", children: searching ? "…" : "Search" })] }), error && _jsx("p", { className: "text-red-400 text-sm mb-4", children: error }), result && (_jsxs("div", { className: "bg-gray-900 rounded p-4", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsx("span", { className: "font-semibold text-lg", children: result.username }), _jsx("button", { onClick: handleFollow, disabled: followed, className: "bg-green-600 hover:bg-green-500 text-white text-sm font-medium px-3 py-1 rounded disabled:opacity-50", children: followed ? "Following ✓" : "Follow" })] }), _jsx("div", { className: "flex flex-wrap gap-3", children: result.ratings.map((r) => (_jsxs("div", { className: "text-sm", children: [_jsx("span", { className: "text-gray-400 capitalize", children: r.timeControl }), " ", _jsx("span", { className: "font-medium", children: r.rating })] }, r.timeControl))) })] }))] }));
}
