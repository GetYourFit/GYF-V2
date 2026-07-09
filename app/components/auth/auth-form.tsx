"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { browserApi } from "@/lib/api-client";
import { COUNTRY_CODES, DEFAULT_COUNTRY_CODE } from "@/lib/country-codes";

type Mode = "login" | "signup";
type SignupStep = "credentials" | "identity";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

async function waitForGuardToAccept(path: string, timeoutMs = 4000): Promise<void> {
  const target = new URL(path, window.location.origin).pathname;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(target, { credentials: "same-origin", redirect: "follow" });
      if (!new URL(res.url).pathname.startsWith("/login")) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
}

const COPY = {
  login: {
    title: "Welcome back",
    subtitle: "Sign in to your stylist",
    cta: "Continue",
    altHref: "/signup",
    altLabel: "Sign Up",
  },
  signup: {
    title: "Enter your email address",
    subtitle: "Sign up or get started",
    cta: "Continue",
    altHref: "/login",
    altLabel: "Log In",
  },
} as const;

/**
 * Ref5/Ref6 field — a giant, borderless, centered ghost input floating on
 * the black canvas. No label, no icon, no underline: the placeholder is
 * the label.
 */
function GhostInput({
  type: typeProp = "text",
  value,
  onChange,
  autoComplete,
  placeholder,
  required,
  minLength,
  big,
}: {
  type?: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  placeholder: string;
  required?: boolean;
  minLength?: number;
  big?: boolean;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = typeProp === "password";
  const inputType = isPassword && showPassword ? "text" : typeProp;

  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
      <input
        type={inputType}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        aria-label={placeholder}
        style={{
          width: "100%",
          background: "transparent",
          border: "none",
          borderRadius: 0,
          padding: isPassword ? "0.5rem 3rem 0.5rem 3rem" : "0.5rem 0",
          fontFamily: "var(--font-body, 'Plus Jakarta Sans', sans-serif)",
          fontSize: big ? "clamp(1.75rem, 8.5vw, 2.5rem)" : "clamp(1.375rem, 6vw, 1.75rem)",
          fontWeight: 500,
          letterSpacing: "-0.01em",
          textAlign: "center",
          color: "var(--text)",
          caretColor: "var(--text)",
          outline: "none",
          minHeight: "56px",
        }}
      />
      {isPassword && (
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          aria-label={showPassword ? "Hide password" : "Show password"}
          style={{
            position: "absolute",
            right: 0,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--text-faint)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 44,
            minHeight: 44,
          }}
        >
          {showPassword ? <EyeOff size={20} aria-hidden /> : <Eye size={20} aria-hidden />}
        </button>
      )}
    </div>
  );
}

export function AuthForm({ mode }: { mode: Mode }) {
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const copy = COPY[mode];
  const reduce = useReducedMotion();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Signup only: a second step collects name + phone once the account
  // itself exists (it needs an authed session to save, via PUT /profile).
  // Both fields are optional — onboarding never blocks on a field the user
  // skips, same policy as the rest of profile setup.
  const [step, setStep] = useState<SignupStep>("credentials");
  const [fullName, setFullName] = useState("");
  const [phoneCountryCode, setPhoneCountryCode] = useState(DEFAULT_COUNTRY_CODE);
  const [phoneNumber, setPhoneNumber] = useState("");

  const canSubmit =
    step === "credentials" ? email.length > 0 && password.length >= 6 && !busy : !busy;

  async function finishSignup(next: string) {
    const trimmedName = fullName.trim();
    const trimmedPhone = phoneNumber.trim();
    if (trimmedName || trimmedPhone) {
      try {
        await browserApi().putProfile({
          ...(trimmedName ? { display_name: trimmedName } : {}),
          ...(trimmedPhone
            ? { phone_country_code: phoneCountryCode, phone_number: trimmedPhone }
            : {}),
        });
      } catch {
        // Best-effort: never block entry into the app over the identity step —
        // the profile page lets the user set/retry these later.
      }
    }
    await waitForGuardToAccept(next);
    window.location.assign(next);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (mode === "signup" && step === "identity") {
        await finishSignup(next);
        return;
      }
      const supabase = createSupabaseBrowserClient();
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
        if (!data.session) {
          setNotice("Check your email to confirm your account, then sign in.");
          return;
        }
        // Session exists immediately (no email confirmation required) — collect
        // name + phone before entering the app instead of redirecting now.
        setStep("identity");
        return;
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      await waitForGuardToAccept(next);
      window.location.assign(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        gap: "1rem",
        minHeight: "60dvh",
      }}
    >
      {/* Mode switch — top-right, Ref6 */}
      {step === "credentials" && (
        <Link
          href={copy.altHref}
          style={{
            position: "fixed",
            top: "calc(1.25rem + env(safe-area-inset-top))",
            right: "1.5rem",
            zIndex: 10,
            fontFamily: "var(--font-body)",
            fontSize: "1rem",
            fontWeight: 500,
            color: "var(--text-mid)",
            textDecoration: "none",
          }}
        >
          {copy.altLabel}
        </Link>
      )}

      {/* Centered header, Ref5/Ref6 */}
      <motion.div
        initial={reduce ? { opacity: 1 } : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: EASE }}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0.5rem",
          textAlign: "center",
        }}
      >
        <h1
          style={{
            fontFamily: "var(--font-body, 'Plus Jakarta Sans', sans-serif)",
            fontSize: "clamp(1.375rem, 6vw, 1.625rem)",
            fontWeight: 700,
            letterSpacing: "-0.01em",
            color: "var(--text)",
            margin: 0,
          }}
        >
          {step === "identity" ? "Tell us who you are" : copy.title}
        </h1>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "1.0625rem",
            color: "var(--text-mid)",
            margin: 0,
          }}
        >
          {step === "identity" ? "Your name and phone number (optional)" : copy.subtitle}
        </p>
      </motion.div>

      {/* Giant ghost fields floating mid-screen */}
      <motion.div
        initial={reduce ? { opacity: 1 } : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35, ease: EASE, delay: 0.1 }}
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: "1.75rem",
        }}
      >
        {step === "credentials" ? (
          <>
            <GhostInput
              type="email"
              value={email}
              onChange={setEmail}
              autoComplete="email"
              placeholder="Email address"
              required
              big
            />
            <GhostInput
              type="password"
              value={password}
              onChange={setPassword}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              placeholder="Password"
              required
              minLength={6}
            />
          </>
        ) : (
          <>
            <GhostInput
              type="text"
              value={fullName}
              onChange={setFullName}
              autoComplete="name"
              placeholder="Full name"
              big
            />
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <select
                value={phoneCountryCode}
                onChange={(e) => setPhoneCountryCode(e.target.value)}
                aria-label="Country code"
                style={{
                  background: "var(--surface-high)",
                  color: "var(--text)",
                  border: "none",
                  borderRadius: 999,
                  padding: "0.625rem 0.75rem",
                  fontFamily: "var(--font-body)",
                  fontSize: "1rem",
                  fontWeight: 500,
                }}
              >
                {COUNTRY_CODES.map((c) => (
                  <option key={c.iso2} value={c.code}>
                    {c.code} {c.iso2}
                  </option>
                ))}
              </select>
              <div style={{ flex: 1 }}>
                <GhostInput
                  type="tel"
                  value={phoneNumber}
                  onChange={setPhoneNumber}
                  autoComplete="tel-national"
                  placeholder="Phone number"
                />
              </div>
            </div>
          </>
        )}
      </motion.div>

      {step === "identity" && (
        <button
          type="button"
          onClick={() => void finishSignup(next)}
          style={{
            background: "none",
            border: "none",
            color: "var(--text-faint)",
            fontFamily: "var(--font-body)",
            fontSize: "0.9375rem",
            textAlign: "center",
            cursor: "pointer",
            padding: "0.5rem",
          }}
        >
          Skip for now
        </button>
      )}

      {/* Error / notice */}
      <AnimatePresence>
        {error && (
          <motion.p
            key="error"
            role="alert"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "0.875rem",
              color: "var(--error)",
              margin: 0,
              textAlign: "center",
            }}
          >
            {error}
          </motion.p>
        )}
        {notice && (
          <motion.p
            key="notice"
            role="status"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "0.875rem",
              color: "var(--success)",
              margin: 0,
              textAlign: "center",
            }}
          >
            {notice}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Full-width pill Continue — dim until the form is fillable (Ref5) */}
      <motion.button
        type="submit"
        disabled={!canSubmit}
        aria-busy={busy}
        whileTap={reduce || !canSubmit ? undefined : { scale: 0.97 }}
        transition={{ type: "spring", stiffness: 500, damping: 28 }}
        style={{
          width: "100%",
          minHeight: "56px",
          background: canSubmit ? "var(--accent)" : "var(--surface-high)",
          color: canSubmit ? "var(--on-accent)" : "var(--text-faint)",
          border: "none",
          borderRadius: 999,
          fontFamily: "var(--font-body, 'Plus Jakarta Sans', sans-serif)",
          fontSize: "1.0625rem",
          fontWeight: 600,
          cursor: canSubmit ? "pointer" : "default",
          transition: "background 0.2s, color 0.2s",
        }}
      >
        {busy ? "Working…" : step === "identity" ? "Finish" : copy.cta}
      </motion.button>
    </form>
  );
}
