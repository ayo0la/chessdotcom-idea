import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import LinkAccount from "../src/pages/LinkAccount";

vi.mock("../src/api", () => ({
  getAccountStatus: vi.fn(),
  linkUsername: vi.fn(),
  verifyUsername: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(public status: number, message: string) {
      super(message);
    }
  },
}));
vi.mock("../src/lib/supabase", () => ({
  supabase: { auth: { signOut: vi.fn() } },
}));

import { getAccountStatus, linkUsername, verifyUsername } from "../src/api";

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/link"]}>
      <Routes>
        <Route path="/link" element={<LinkAccount />} />
        <Route path="/dashboard" element={<div>DASHBOARD</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAccountStatus).mockResolvedValue({ user: null, pending: null });
});

describe("LinkAccount", () => {
  it("asks for a chess.com username when nothing is linked", async () => {
    renderPage();
    expect(
      await screen.findByPlaceholderText(/chess\.com username/i)
    ).toBeInTheDocument();
  });

  it("redirects straight to the dashboard when already linked", async () => {
    vi.mocked(getAccountStatus).mockResolvedValue({
      user: { userId: "u1", chesscomUsername: "babayaro11" },
      pending: null,
    });

    renderPage();
    expect(await screen.findByText("DASHBOARD")).toBeInTheDocument();
  });

  it("requests a code and shows verification instructions", async () => {
    vi.mocked(linkUsername).mockResolvedValue({
      username: "babayaro11",
      code: "CR-XYZ789",
    });

    renderPage();
    await userEvent.type(
      await screen.findByPlaceholderText(/chess\.com username/i),
      "BabaYaro11"
    );
    await userEvent.click(screen.getByRole("button", { name: /get code/i }));

    expect(linkUsername).toHaveBeenCalledWith("BabaYaro11");
    expect(await screen.findByText("CR-XYZ789")).toBeInTheDocument();
    expect(screen.getByText(/location/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /verify/i })).toBeInTheDocument();
  });

  it("resumes a pending verification from status", async () => {
    vi.mocked(getAccountStatus).mockResolvedValue({
      user: null,
      pending: { username: "babayaro11", code: "CR-OLD111" },
    });

    renderPage();
    expect(await screen.findByText("CR-OLD111")).toBeInTheDocument();
  });

  it("verifies and lands on the dashboard", async () => {
    vi.mocked(getAccountStatus).mockResolvedValue({
      user: null,
      pending: { username: "babayaro11", code: "CR-OLD111" },
    });
    vi.mocked(verifyUsername).mockResolvedValue({
      userId: "u1",
      chesscomUsername: "babayaro11",
    });

    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: /verify/i }));

    expect(await screen.findByText("DASHBOARD")).toBeInTheDocument();
  });

  it("shows the server error when verification fails", async () => {
    vi.mocked(getAccountStatus).mockResolvedValue({
      user: null,
      pending: { username: "babayaro11", code: "CR-OLD111" },
    });
    vi.mocked(verifyUsername).mockRejectedValue(
      new Error("Verification code not found. Put CR-OLD111 in the Location field.")
    );

    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: /verify/i }));

    expect(await screen.findByText(/code not found/i)).toBeInTheDocument();
  });
});
