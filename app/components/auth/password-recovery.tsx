"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties, type FormEvent } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import { GhostInput } from "./auth-form";

const HEADING: CSSProperties = {
  fontFamily: "var(--font-body, 'Plus Jakarta Sans', sans-serif)",
  fontSize: "clamp(1.375rem, 6vw, 1.625rem)",
  fontWeight: 700,
  letterSpacing: "-0.01em",
  color: "var(--text)",
  margin: 0,
  textAlign: "center",
};

const SUBTITLE: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "1.0625rem",
  color: "var(--text-mid)",
  margin: 0,
  textAlign: "center",
};

const MESSAGE: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "0.875rem",
  margin: 0,
  textAlign: "center",
};

const SUBMIT: CSSProperties = {
  width: "100%",
  minHeight: "56px",
  border: "none",
  borderRadius: 999,
  fontFamily: "var(--font-body, 'Plus Jakarta Sans', sans-serif)",
  fontSize: "1.0625rem",
  fontWeight: 600,
  transition: "background 0.2s, color 0.2s",
};

const BACK_LINK: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "0.9375rem",
  color: "var(--text-faint)",
  textDecoration: "none",
  textAlign: "center",
};

function submitStyle(enabled: boolean): CSSProperties {
  return {
    ...SUBMIT,
    background: enabled ? "var(--accent)" : "var(--surface-high)",
    color: enabled ? "var(--on-accent)" : "var(--text-faint)",
    cursor: enabled ? "pointer" : "default",
  };
}

const FORM: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  justifyContent: "center",
  gap: "1.75rem",
  minHeight: "60dvh",
};

/** Requests a password-recovery email (F1c). */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canSubmit = email.length > 0 && !busy;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetError) throw resetError;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div style={FORM}>
        <h1 style={HEADING}>Check your email</h1>
        <p role="status" style={SUBTITLE}>
          If an account exists for {email}, a reset link is on its way. Open it on this device to
          choose a new password.
        </p>
        <Link href="/login" style={BACK_LINK}>
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate style={FORM}>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <h1 style={HEADING}>Reset your password</h1>
        <p style={SUBTITLE}>Enter your email and we&apos;ll send a reset link</p>
      </div>
      <GhostInput
        type="email"
        value={email}
        onChange={setEmail}
        autoComplete="email"
        placeholder="Email address"
        required
        big
      />
      {error && (
        <p role="alert" style={{ ...MESSAGE, color: "var(--error)" }}>
          {error}
        </p>
      )}
      <button type="submit" disabled={!canSubmit} aria-busy={busy} style={submitStyle(canSubmit)}>
        {busy ? "Working…" : "Send reset link"}
      </button>
      <Link href="/login" style={BACK_LINK}>
        Back to sign in
      </Link>
    </form>
  );
}

/**
 * Sets the new password after the recovery link lands (F1c). The Supabase
 * browser client exchanges the link's code for a recovery session on load;
 * without that session updateUser fails and the user is told to request a
 * fresh link — the form never pretends a reset happened when it didn't.
 */
export function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const canSubmit = password.length >= 6 && !busy && hasSession !== false;

  useEffect(() => {
    let active = true;
    const supabase = createSupabaseBrowserClient();
    // The client's detectSessionInUrl consumes the recovery code asynchronously;
    // onAuthStateChange catches the session the moment the exchange completes,
    // getSession covers a session that already existed.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active && session) setHasSession(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (active) setHasSession((known) => known ?? data.session !== null);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setDone(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not update the password. Request a new reset link and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div style={FORM}>
        <h1 style={HEADING}>Password updated</h1>
        <p role="status" style={SUBTITLE}>
          Your new password is set — you&apos;re signed in.
        </p>
        <Link href="/" style={{ ...BACK_LINK, color: "var(--text-mid)" }}>
          Continue to GYF
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate style={FORM}>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <h1 style={HEADING}>Choose a new password</h1>
        <p style={SUBTITLE}>
          {hasSession === false
            ? "This reset link is invalid or has expired."
            : "At least 6 characters"}
        </p>
      </div>
      <GhostInput
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        placeholder="New password"
        required
        minLength={6}
      />
      {error && (
        <p role="alert" style={{ ...MESSAGE, color: "var(--error)" }}>
          {error}
        </p>
      )}
      <button type="submit" disabled={!canSubmit} aria-busy={busy} style={submitStyle(canSubmit)}>
        {busy ? "Working…" : "Set new password"}
      </button>
      {hasSession === false && (
        <Link href="/forgot-password" style={BACK_LINK}>
          Request a new reset link
        </Link>
      )}
    </form>
  );
}
