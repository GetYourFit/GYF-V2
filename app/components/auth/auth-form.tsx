"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Mode = "login" | "signup";

const COPY: Record<
  Mode,
  { title: string; subtitle: string; cta: string; altPrompt: string; altHref: string; altLabel: string }
> = {
  login: {
    title: "Welcome back",
    subtitle: "Sign in to your GYF account.",
    cta: "Sign in",
    altPrompt: "New to GYF?",
    altHref: "/signup",
    altLabel: "Create an account",
  },
  signup: {
    title: "Create account",
    subtitle: "Start dressing better, instantly.",
    cta: "Get started",
    altPrompt: "Already have an account?",
    altHref: "/login",
    altLabel: "Sign in",
  },
};

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const copy = COPY[mode];

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
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      <div>
        <h1 className="t-headline text-[var(--text)]">{copy.title}</h1>
        <p className="mt-1 t-caption">{copy.subtitle}</p>
      </div>

      <div className="flex flex-col gap-4">
        <Field label="Email">
          {(p) => (
            <Input
              {...p}
              type="email"
              name="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          )}
        </Field>

        <Field label="Password" hint={mode === "signup" ? "At least 6 characters." : undefined}>
          {(p) => (
            <Input
              {...p}
              type="password"
              name="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>
      </div>

      {error && (
        <p role="alert" className="t-caption text-[var(--error)]">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="t-caption text-[var(--accent-warm)]">
          {notice}
        </p>
      )}

      <Button type="submit" disabled={busy} aria-busy={busy} className="w-full">
        {busy ? "Working…" : copy.cta}
      </Button>

      <p className="t-caption text-center">
        {copy.altPrompt}{" "}
        <Link
          href={copy.altHref}
          className="text-[var(--text)] underline underline-offset-4 hover:no-underline"
        >
          {copy.altLabel}
        </Link>
      </p>
    </form>
  );
}
