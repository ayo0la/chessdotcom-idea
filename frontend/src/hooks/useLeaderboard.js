import { useState, useEffect, useCallback } from "react";
import { getLeaderboard } from "../api";
export function useLeaderboard(tc) {
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        setLoading(true);
        getLeaderboard(tc)
            .then(setEntries)
            .finally(() => setLoading(false));
    }, [tc]);
    const update = useCallback((username, rating) => {
        setEntries((prev) => prev
            .map((e) => (e.username === username ? { ...e, rating } : e))
            .sort((a, b) => b.rating - a.rating)
            .map((e, i) => ({ ...e, rank: i + 1 })));
    }, []);
    const remove = useCallback((username) => {
        setEntries((prev) => prev
            .filter((e) => e.username !== username)
            .map((e, i) => ({ ...e, rank: i + 1 })));
    }, []);
    return { entries, loading, update, remove };
}
