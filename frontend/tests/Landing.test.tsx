import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import Landing from "../src/pages/Landing";

vi.mock("../src/lib/supabase", () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
    },
  },
}));

import { supabase } from "../src/lib/supabase";

function renderLanding() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/link" element={<div>LINK PAGE</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Landing", () => {
  it("renders the sign-in form", () => {
    renderLanding();
    expect(screen.getByPlaceholderText(/email/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("signs in and moves on", async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { session: {} },
      error: null,
    } as any);

    renderLanding();
    await userEvent.type(screen.getByPlaceholderText(/email/i), "ayo@test.com");
    await userEvent.type(screen.getByPlaceholderText(/password/i), "secret123");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "ayo@test.com",
      password: "secret123",
    });
    expect(await screen.findByText("LINK PAGE")).toBeInTheDocument();
  });

  it("shows an error when sign-in fails", async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { session: null },
      error: { message: "Invalid login credentials" },
    } as any);

    renderLanding();
    await userEvent.type(screen.getByPlaceholderText(/email/i), "ayo@test.com");
    await userEvent.type(screen.getByPlaceholderText(/password/i), "wrong");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText(/invalid login/i)).toBeInTheDocument();
  });

  it("switches to sign-up mode and creates an account", async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { session: {} },
      error: null,
    } as any);

    renderLanding();
    await userEvent.click(screen.getByRole("button", { name: /create one/i }));
    await userEvent.type(screen.getByPlaceholderText(/email/i), "new@test.com");
    await userEvent.type(screen.getByPlaceholderText(/password/i), "secret123");
    await userEvent.click(screen.getByRole("button", { name: /sign up/i }));

    expect(supabase.auth.signUp).toHaveBeenCalledWith({
      email: "new@test.com",
      password: "secret123",
    });
  });
});
