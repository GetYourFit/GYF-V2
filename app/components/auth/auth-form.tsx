"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Mode = "login" | "signup";

const COPY: Record<Mode, { title: string; cta: string; altPrompt: string; altHref: string; altLabel: string }> = {
  login: {
    title: "Welcome back",
    cta: "Sign in",
    altPrompt: "New to GYF?",
    altHref: "/signup",
    altLabel: "Create an account",
  },
  signup: {
    title: "Create your account",
    cta: "Sign up",
    altPrompt: "Already have an account?",
    altHref: "/login",
    altLabel: "Sign in",
  },
};

/** Shared email/password auth form for both login and signup (DRY). On success it
 *  routes to the originally-requested page (?next=) or the stylist surface. */
export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/app";
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
        // When email confirmation is on, there's no session yet — tell the user.
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
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <h1 className="text-2xl font-semibold text-neutral-900">{copy.title}</h1>

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

      {error && (
        <p role="alert" className="text-sm font-medium text-red-600">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm font-medium text-green-700">
          {notice}
        </p>
      )}

      <Button type="submit" disabled={busy} aria-busy={busy} className="w-full">
        {busy ? "Working…" : copy.cta}
      </Button>

      <p className="text-sm text-neutral-600">
        {copy.altPrompt}{" "}
        <Link href={copy.altHref} className="font-medium text-neutral-900 underline underline-offset-4">
          {copy.altLabel}
        </Link>
      </p>
    </form>
  );
}
