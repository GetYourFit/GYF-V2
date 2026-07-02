"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ArrowRight, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Mode = "login" | "signup";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

async function waitForGuardToAccept(path: string, timeoutMs = 4000): Promise<void> {
  const target = new URL(path, window.location.origin).pathname;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(target, { credentials: "same-origin", redirect: "follow" });
      if (!new URL(res.url).pathname.startsWith("/login")) return;
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 100));
  }
}

const COPY = {
  login: {
    eyebrow: "SIGN IN",
    title: "Welcome back.",
    subtitle: "Your stylist is waiting.",
    cta: "Sign in",
    altPrompt: "New to GYF?",
    altHref: "/signup",
    altLabel: "Create account",
  },
  signup: {
    eyebrow: "JOIN GYF",
    title: "Start dressing with intelligence.",
    subtitle: "Free. Instant. Personal to you.",
    cta: "Get started",
    altPrompt: "Already have an account?",
    altHref: "/login",
    altLabel: "Sign in",
  },
} as const;

function IndustrialInput({
  label,
  type: typeProp = "text",
  value,
  onChange,
  autoComplete,
  placeholder,
  required,
  minLength,
  icon: Icon,
  delay = 0,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  icon: React.ElementType;
  delay?: number;
}) {
  const [focused, setFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const reduce = useReducedMotion();
  const isPassword = typeProp === "password";
  const inputType = isPassword && showPassword ? "text" : typeProp;

  return (
    <motion.div
      initial={reduce ? { opacity: 1 } : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: EASE, delay }}
      style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}
    >
      <label
        style={{
          fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
          fontSize: "0.6875rem",
          fontWeight: 500,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: focused ? "#ffffff" : "#8e9192",
          transition: "color 0.2s",
        }}
      >
        {label}
      </label>
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <Icon
          size={16}
          aria-hidden
          style={{
            position: "absolute",
            left: 0,
            color: focused ? "#ffffff" : "#8a8a95",
            transition: "color 0.2s",
            flexShrink: 0,
          }}
        />
        <input
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required={required}
          minLength={minLength}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: "100%",
            background: "transparent",
            border: "none",
            borderBottom: `1px solid ${focused ? "#ffffff" : "#444748"}`,
            borderRadius: 0,
            padding: "0.75rem 2rem 0.75rem 1.75rem",
            fontFamily: "var(--font-body, 'Plus Jakarta Sans', sans-serif)",
            fontSize: "1rem",
            color: "#e2e2e9",
            outline: "none",
            transition: "border-color 0.2s",
            minHeight: "44px",
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
              color: "#8a8a95",
              padding: "0.25rem",
              display: "flex",
              alignItems: "center",
              minWidth: 44,
              minHeight: 44,
              justifyContent: "center",
            }}
          >
            {showPassword ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
          </button>
        )}
      </div>
    </motion.div>
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

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
        if (!data.session) {
          setNotice("Check your email to confirm your account, then sign in.");
          return;
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      }
      await waitForGuardToAccept(next);
      window.location.assign(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>

      {/* Header */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <motion.p
          initial={reduce ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, ease: EASE }}
          style={{
            fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
            fontSize: "0.6875rem",
            fontWeight: 500,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#d4a96a",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <span
            aria-hidden
            style={{
              display: "inline-block",
              width: 24,
              height: 1,
              background: "#d4a96a",
              flexShrink: 0,
            }}
          />
          {copy.eyebrow}
        </motion.p>

        <motion.h1
          initial={reduce ? { opacity: 1 } : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: EASE, delay: 0.05 }}
          style={{
            fontFamily: "var(--font-body, 'Plus Jakarta Sans', sans-serif)",
            fontSize: "clamp(1.75rem, 8vw, 2.25rem)",
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: "-0.03em",
            color: "#e8e4dc",
            margin: 0,
          }}
        >
          {copy.title}
        </motion.h1>

        <motion.p
          initial={reduce ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, ease: EASE, delay: 0.12 }}
          style={{
            fontFamily: "var(--font-body, 'Plus Jakarta Sans', sans-serif)",
            fontSize: "0.9375rem",
            color: "#8e9192",
            margin: 0,
          }}
        >
          {copy.subtitle}
        </motion.p>
      </div>

      {/* Fields */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <IndustrialInput
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          placeholder="you@example.com"
          required
          icon={Mail}
          delay={0.15}
        />
        <IndustrialInput
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          required
          minLength={6}
          icon={Lock}
          delay={0.22}
        />
      </div>

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
              color: "#ffb4ab",
              margin: 0,
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
              color: "#10B981",
              margin: 0,
            }}
          >
            {notice}
          </motion.p>
        )}
      </AnimatePresence>

      {/* CTA */}
      <motion.div
        initial={reduce ? { opacity: 1 } : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: EASE, delay: 0.3 }}
        style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
      >
        <motion.button
          type="submit"
          disabled={busy}
          aria-busy={busy}
          whileTap={reduce ? undefined : { scale: 0.97 }}
          transition={{ type: "spring", stiffness: 500, damping: 28 }}
          style={{
            width: "100%",
            minHeight: "52px",
            background: busy ? "#333" : "#ffffff",
            color: "#0f0f12",
            border: "none",
            borderRadius: "16px",
            fontFamily: "var(--font-body, 'Plus Jakarta Sans', sans-serif)",
            fontSize: "0.875rem",
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            cursor: busy ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
            transition: "background 0.2s",
          }}
        >
          {busy ? (
            <motion.span
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              Working...
            </motion.span>
          ) : (
            <>
              {copy.cta}
              <ArrowRight size={16} aria-hidden />
            </>
          )}
        </motion.button>

        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "0.8125rem",
            color: "#8a8a95",
            textAlign: "center",
            margin: 0,
          }}
        >
          {copy.altPrompt}{" "}
          <Link
            href={copy.altHref}
            style={{
              color: "#c4c7c8",
              textDecoration: "underline",
              textUnderlineOffset: "3px",
            }}
          >
            {copy.altLabel}
          </Link>
        </p>
      </motion.div>
    </form>
  );
}
