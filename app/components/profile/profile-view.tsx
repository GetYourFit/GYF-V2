"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import type { Profile, ProfileSummary } from "@gyf/types";

import { browserApi } from "@/lib/api-client";
import { ApiError } from "@/lib/api";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const lux = [0.16, 1, 0.3, 1] as const;

type Status = "loading" | "ready" | "error";

interface Loaded {
  /** null when the user is authenticated but hasn't onboarded yet (404). */
  profile: Profile | null;
  summary: ProfileSummary;
}

const EMPTY_SUMMARY: ProfileSummary = {
  outfits_made: 0,
  items_saved: 0,
  wardrobe_size: 0,
  posts: 0,
  reactions_received: 0,
  badges: [],
};

export function ProfileView() {
  const [data, setData] = useState<Loaded | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  const fetchData = useCallback(async (): Promise<Loaded> => {
    const api = browserApi();
    const [profile, summary] = await Promise.all([
      api.getProfile().catch((e: unknown) => {
        if (e instanceof ApiError && e.isNotOnboarded) return null;
        throw e;
      }),
      // The summary is best-effort: a brand-new account has nothing to count.
      api.getProfileSummary().catch(() => EMPTY_SUMMARY),
    ]);
    return { profile, summary };
  }, []);

  // Retry handler (invoked from a click, not an effect — setState here is fine).
  const load = useCallback(async () => {
    setStatus("loading");
    try {
      setData(await fetchData());
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [fetchData]);

  useEffect(() => {
    let active = true;
    fetchData()
      .then((d) => {
        if (!active) return;
        setData(d);
        setStatus("ready");
      })
      .catch(() => {
        if (active) setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [fetchData]);

  if (status === "loading") return <ProfileSkeleton />;
  if (status === "error" || !data) return <ErrorState onRetry={load} />;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, ease: lux }}
      className="flex flex-col gap-10"
    >
      <Stats summary={data.summary} />
      {data.summary.badges.length > 0 && <Badges badges={data.summary.badges} />}
      <StyleProfile profile={data.profile} />
      <AccountControls />
    </motion.div>
  );
}

function Stats({ summary }: { summary: ProfileSummary }) {
  const items: Array<{ label: string; value: number; href?: string }> = [
    { label: "Outfits", value: summary.outfits_made },
    { label: "Saved", value: summary.items_saved, href: "/saved" },
    { label: "Wardrobe", value: summary.wardrobe_size, href: "/wardrobe" },
    { label: "Posts", value: summary.posts, href: "/social" },
    { label: "Reactions", value: summary.reactions_received },
  ];
  return (
    <section
      aria-label="Profile statistics"
      className="grid grid-cols-3 gap-px border border-border bg-border sm:grid-cols-5"
    >
      {items.map(({ label, value, href }) => {
        const inner = (
          <>
            <span className="t-display text-text">{value}</span>
            <span className="t-label text-text-faint">{label}</span>
          </>
        );
        return href ? (
          <Link
            key={label}
            href={href}
            className="flex flex-col gap-1 bg-surface p-5 transition-colors hover:bg-surface-2"
          >
            {inner}
          </Link>
        ) : (
          <div key={label} className="flex flex-col gap-1 bg-surface p-5">
            {inner}
          </div>
        );
      })}
    </section>
  );
}

function Badges({ badges }: { badges: string[] }) {
  return (
    <section className="flex flex-col gap-3">
      <p className="t-label text-text-faint">Badges earned</p>
      <div className="flex flex-wrap gap-3">
        {badges.map((b) => (
          <span
            key={b}
            className="inline-flex items-center border border-border-hi px-4 py-2 t-label text-text"
          >
            {b}
          </span>
        ))}
      </div>
    </section>
  );
}

function StyleProfile({ profile }: { profile: Profile | null }) {
  if (!profile) {
    return (
      <section className="flex flex-col items-start gap-4 border border-border bg-surface p-6">
        <div>
          <p className="t-headline text-text">No style profile yet</p>
          <p className="mt-2 t-caption max-w-[320px]">
            Tell GYF about your skin tone, body type, and the looks you love — it sharpens every
            recommendation.
          </p>
        </div>
        <Link
          href="/onboarding"
          className="inline-flex min-h-11 items-center bg-accent px-8 t-label text-bg hover:bg-text-mid transition-colors duration-[180ms]"
        >
          Set up my profile
        </Link>
      </section>
    );
  }

  const budget = profile.budget_range;
  const rows: Array<[string, string]> = [
    ["Skin tone", titleCase(profile.skin_tone)],
    ["Undertone", titleCase(profile.undertone)],
    ["Body type", titleCase(profile.body_type)],
    ["Occasion", titleCase(profile.occasion)],
    [
      "Style",
      profile.style_intent && profile.style_intent.length > 0
        ? profile.style_intent.map(titleCase).join(", ")
        : "—",
    ],
    [
      "Budget",
      budget && (budget.min || budget.max)
        ? `${budget.currency} ${budget.min ?? 0}–${budget.max ?? "∞"}`
        : "—",
    ],
  ];

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <p className="t-label text-text-faint">Style profile</p>
        <Link
          href="/onboarding"
          className="t-label text-text-mid underline-offset-4 hover:text-text hover:underline"
        >
          Edit
        </Link>
      </div>
      <dl className="grid grid-cols-1 gap-px border border-border bg-border sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-col gap-1 bg-surface p-4">
            <dt className="t-label text-text-faint">{label}</dt>
            <dd className="t-body text-text">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function AccountControls() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signOut = useCallback(async () => {
    setBusy(true);
    try {
      await createSupabaseBrowserClient().auth.signOut();
      router.push("/login");
      router.refresh();
    } catch {
      setBusy(false);
    }
  }, [router]);

  const deleteAccount = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await browserApi().deleteAccount();
      await createSupabaseBrowserClient().auth.signOut();
      router.push("/login");
      router.refresh();
    } catch {
      setError("Couldn't delete your account. Please try again.");
      setBusy(false);
    }
  }, [router]);

  return (
    <section className="flex flex-col gap-4 border-t border-border pt-8">
      <p className="t-label text-text-faint">Account</p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={signOut}
          disabled={busy}
          className="inline-flex min-h-11 items-center border border-border-hi px-6 t-label text-text hover:bg-surface-2 transition-colors duration-[180ms] disabled:opacity-50"
        >
          Sign out
        </button>
        {!confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={busy}
            className="inline-flex min-h-11 items-center border border-border-hi px-6 t-label text-[var(--danger,#c0392b)] hover:bg-surface-2 transition-colors duration-[180ms] disabled:opacity-50"
          >
            Delete my data
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <span className="t-caption text-text-mid">Delete everything? This can&apos;t be undone.</span>
            <button
              type="button"
              onClick={deleteAccount}
              disabled={busy}
              className="inline-flex min-h-11 items-center bg-[var(--danger,#c0392b)] px-6 t-label text-white transition-opacity duration-[180ms] hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Deleting…" : "Confirm delete"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={busy}
              className="t-label text-text-mid hover:text-text"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
      {error && (
        <p role="alert" className="t-caption text-[var(--danger,#c0392b)]">
          {error}
        </p>
      )}
      <p className="t-caption text-text-faint max-w-[420px]">
        Deleting erases your profile, saved looks, wardrobe, and posts. Your data is yours — GYF
        removes it on request.
      </p>
    </section>
  );
}

function titleCase(value: string | null | undefined): string {
  if (!value) return "—";
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: lux }}
      className="mx-auto max-w-sm py-20 text-center"
    >
      <p className="t-headline text-text">Couldn&apos;t load your profile</p>
      <p className="mt-3 t-caption max-w-[260px] mx-auto">
        Something went wrong reaching the stylist. Your data is safe — try again.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-8 inline-flex min-h-11 items-center border border-border-hi px-8 t-label text-text hover:bg-surface-2 transition-colors duration-[180ms]"
      >
        Retry
      </button>
    </motion.div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="flex flex-col gap-10" aria-hidden>
      <div className="grid grid-cols-3 gap-px sm:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 skeleton" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-px sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 skeleton" />
        ))}
      </div>
    </div>
  );
}
