// F1c regressions: password recovery requests the reset email with the exact
// /reset-password redirect, and the reset form never claims success without a
// recovery session + accepted update.
import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ForgotPasswordForm, ResetPasswordForm } from "./password-recovery";

const resetPasswordForEmail = vi.fn();
const updateUser = vi.fn();
const getSession = vi.fn();
const onAuthStateChange = vi.fn(() => ({
  data: { subscription: { unsubscribe: vi.fn() } },
}));

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({
    auth: { resetPasswordForEmail, updateUser, getSession, onAuthStateChange },
  }),
}));

beforeEach(() => {
  resetPasswordForEmail.mockReset().mockResolvedValue({ data: {}, error: null });
  updateUser.mockReset().mockResolvedValue({ data: {}, error: null });
  getSession.mockReset().mockResolvedValue({ data: { session: { user: {} } } });
});

describe("ForgotPasswordForm", () => {
  it("sends the recovery email with the reset-password redirect", async () => {
    render(<ForgotPasswordForm />);
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "person@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    await waitFor(() =>
      expect(resetPasswordForEmail).toHaveBeenCalledWith("person@example.com", {
        redirectTo: `${window.location.origin}/reset-password`,
      }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(/reset link is on its way/i);
  });

  it("surfaces a send failure instead of claiming the email went out", async () => {
    resetPasswordForEmail.mockResolvedValue({ data: null, error: new Error("rate limited") });
    render(<ForgotPasswordForm />);
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "person@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("rate limited");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("ResetPasswordForm", () => {
  it("updates the password through the recovery session", async () => {
    render(<ResetPasswordForm />);
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "newpass1" } });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Set new password" })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Set new password" }));

    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ password: "newpass1" }));
    expect(await screen.findByRole("status")).toHaveTextContent(/password.*set/i);
  });

  it("says the link is invalid when no recovery session exists", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    render(<ResetPasswordForm />);

    expect(await screen.findByText(/invalid or has expired/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /new reset link/i })).toHaveAttribute(
      "href",
      "/forgot-password",
    );
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("surfaces an update failure instead of claiming success", async () => {
    updateUser.mockResolvedValue({ data: null, error: new Error("session expired") });
    render(<ResetPasswordForm />);
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "newpass1" } });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Set new password" })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Set new password" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("session expired");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
