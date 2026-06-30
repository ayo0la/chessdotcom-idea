const BASE = import.meta.env.VITE_API_URL ?? "/api";
async function apiFetch(path, init) {
    const res = await fetch(`${BASE}${path}`, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        ...init,
    });
    if (!res.ok)
        throw new Error(await res.text());
    return res.json();
}
export function claimUsername(username) {
    return apiFetch("/auth/claim", {
        method: "POST",
        body: JSON.stringify({ username }),
    });
}
export function getMe() {
    return apiFetch("/me");
}
export function getLeaderboard(tc) {
    return apiFetch(`/leaderboard?tc=${tc}`);
}
export function followPlayer(username) {
    return apiFetch(`/follows/${username}`, { method: "POST" });
}
export function unfollowPlayer(username) {
    return apiFetch(`/follows/${username}`, { method: "DELETE" });
}
export function searchPlayer(username) {
    return apiFetch(`/players/${username}`);
}
