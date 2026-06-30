import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { claimUsername } from "../api";
export default function Landing() {
    const navigate = useNavigate();
    const [username, setUsername] = useState("");
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    async function handleSubmit(e) {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            await claimUsername(username.trim());
            navigate("/dashboard");
        }
        catch {
            setError("Username not found on Chess.com. Check the spelling and try again.");
        }
        finally {
            setLoading(false);
        }
    }
    return (_jsxs("main", { className: "min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-6 px-4", children: [_jsx("h1", { className: "text-3xl font-bold text-white tracking-tight", children: "Chess Rivals" }), _jsx("p", { className: "text-gray-400 text-sm", children: "Track your Chess.com friends in real time." }), _jsxs("form", { onSubmit: handleSubmit, className: "flex flex-col gap-3 w-full max-w-sm", children: [_jsx("input", { type: "text", placeholder: "Chess.com username", value: username, onChange: (e) => setUsername(e.target.value), className: "bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-green-500", required: true }), _jsx("button", { type: "submit", disabled: loading, className: "bg-green-600 hover:bg-green-500 text-white font-semibold py-2 rounded disabled:opacity-50", children: loading ? "Checking…" : "Enter" }), error && _jsx("p", { className: "text-red-400 text-sm", children: error })] })] }));
}
