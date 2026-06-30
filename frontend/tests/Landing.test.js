import { jsx as _jsx } from "react/jsx-runtime";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Landing from "../src/pages/Landing";
import * as api from "../src/api";
vi.mock("../src/api", () => ({
    claimUsername: vi.fn(),
}));
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual("react-router-dom");
    return { ...actual, useNavigate: () => mockNavigate };
});
beforeEach(() => {
    vi.clearAllMocks();
});
describe("Landing", () => {
    it("renders the claim form", () => {
        render(_jsx(MemoryRouter, { children: _jsx(Landing, {}) }));
        expect(screen.getByPlaceholderText(/chess.com username/i)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /enter/i })).toBeInTheDocument();
    });
    it("calls claimUsername and navigates to /dashboard on success", async () => {
        vi.mocked(api.claimUsername).mockResolvedValueOnce({
            userId: "u1",
            chesscomUsername: "hikaru",
        });
        render(_jsx(MemoryRouter, { children: _jsx(Landing, {}) }));
        await userEvent.type(screen.getByPlaceholderText(/chess.com username/i), "hikaru");
        await userEvent.click(screen.getByRole("button", { name: /enter/i }));
        await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/dashboard"));
    });
    it("shows error message when username is not found", async () => {
        vi.mocked(api.claimUsername).mockRejectedValueOnce(new Error("Not found"));
        render(_jsx(MemoryRouter, { children: _jsx(Landing, {}) }));
        await userEvent.type(screen.getByPlaceholderText(/chess.com username/i), "nobody");
        await userEvent.click(screen.getByRole("button", { name: /enter/i }));
        await waitFor(() => expect(screen.getByText(/username not found/i)).toBeInTheDocument());
    });
});
