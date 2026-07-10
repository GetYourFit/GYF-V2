import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthForm } from "./auth-form";

let next: string | null = null;
const signInWithPassword = vi.fn();
const signUp = vi.fn();

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: () => next }),
}));
vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({ auth: { signInWithPassword, signUp } }),
}));
vi.mock("@/lib/api-client", () => ({
  browserApi: () => ({ putProfile: vi.fn() }),
}));

function fillCredentials() {
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "person@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret1" } });
}

function captureRedirect() {
  const assign = vi.fn();
  vi.stubGlobal("window", {
    location: { assign, origin: "http://localhost:3000" },
  });
  return assign;
}

beforeEach(() => {
  next = null;
  signInWithPassword.mockReset().mockResolvedValue({ error: null });
  signUp.mockReset().mockResolvedValue({ data: { session: {} }, error: null });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ url: "http://localhost:3000/", redirected: false }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AuthForm redirects", () => {
  it("keeps a same-origin relative next path", async () => {
    next = "/closet?tab=favorites";
    render(<AuthForm mode="login" />);
    fillCredentials();
    const assign = captureRedirect();

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith("/closet?tab=favorites"), {
      container: document.body,
    });
  });

  it.each(["https://evil.example/steal", "//evil.example/steal", "/\\evil.example/steal"])(
    "rejects unsafe next path %s",
    async (unsafeNext) => {
      next = unsafeNext;
      render(<AuthForm mode="login" />);
      fillCredentials();
      const assign = captureRedirect();

      fireEvent.click(screen.getByRole("button", { name: "Continue" }));

      await waitFor(() => expect(assign).toHaveBeenCalledWith("/"), { container: document.body });
    },
  );

  it("sends signup without an explicit next path to onboarding", async () => {
    render(<AuthForm mode="signup" />);
    fillCredentials();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("heading", { name: "Tell us who you are" });
    const assign = captureRedirect();

    fireEvent.click(screen.getByRole("button", { name: "Skip for now" }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith("/onboarding"), {
      container: document.body,
    });
  });

  it("keeps login's default path at root", async () => {
    render(<AuthForm mode="login" />);
    fillCredentials();
    const assign = captureRedirect();

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith("/"), { container: document.body });
  });
});
