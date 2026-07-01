"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Mode = "login" | "signup";

/** Poll the destination until the server-side auth guard accepts the freshly
 *  written session, then we can navigate without the guard bouncing us back to
 *  /login. @supabase/ssr commits the session cookie asynchronously after sign-in,
 *  so the *first* request to a guarded route can race that write; rather than
 *  guess at the timing, we ask the guard directly (a same-origin GET that the
 *  middleware redirects to /login while still anonymous) and proceed only once it
 *  stops redirecting. Falls through after a bounded wait so login never hangs. */
async function waitForGuardToAccept(path: string, timeoutMs = 4000): Promise<void> {
  const target = new URL(path, window.location.origin).pathname;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(target, { credentials: "same-origin", redirect: "follow" });
      // The guard sends anonymous callers to /login; once authed, the request
      // resolves on the target itself.
      if (!new URL(res.url).pathname.startsWith("/login")) return;
    } catch {
      // network hiccup — retry until the deadline
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

const COPY: Record<
  Mode,
  {
    title: string;
    subtitle: string;
    cta: string;
    altPrompt: string;
    altHref: string;
    altLabel: string;
  }
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
      // @supabase/ssr writes the session cookie asynchronously (via the
      // auth-state-change event) *after* the sign-in promise resolves, so a
      // navigation fired immediately races that write — the server guard then
      // sees no session and bounces back to /login (intermittent "stuck on
      // login"). Wait until the auth cookie is actually committed, then do a
      // full-page navigation so the guard runs against the freshly-set cookie.
      await waitForGuardToAccept(next);
      window.location.assign(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="h-px w-10 bg-accent" aria-hidden />
          <p className="t-label text-accent">{mode === "login" ? "Sign in" : "Join GYF"}</p>
        </div>
        <h1 className="t-display text-text">{copy.title}</h1>
        <p className="t-body text-text-mid">{copy.subtitle}</p>
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
        <p role="alert" className="t-caption text-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="t-caption text-accent">
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
          className="text-text underline underline-offset-4 hover:no-underline"
        >
          {copy.altLabel}
        </Link>
      </p>
    </form>
  );
}
