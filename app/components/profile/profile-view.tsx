"use client";

import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

function useCountUp(target: number, duration = 800): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    const start = performance.now();
    let raf: number;
    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

import type { Profile, ProfileSummary } from "@gyf/types";

import { Button } from "@/components/ui/button";
import { browserApi } from "@/lib/api-client";
import { ApiError } from "@/lib/api";

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

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Retry handler (invoked from a click). Guarded so a fetch that resolves after
  // the user navigates away never writes to an unmounted component.
  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const d = await fetchData();
      if (!mounted.current) return;
      setData(d);
      setStatus("ready");
    } catch {
      if (mounted.current) setStatus("error");
    }
  }, [fetchData]);

  useEffect(() => {
    fetchData()
      .then((d) => {
        if (!mounted.current) return;
        setData(d);
        setStatus("ready");
      })
      .catch(() => {
        if (mounted.current) setStatus("error");
      });
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
      <AccountLink />
    </motion.div>
  );
}

function StatCell({ label, value, href }: { label: string; value: number; href?: string }) {
  const displayed = useCountUp(value, 700);
  const inner = (
    <>
      <motion.span
        className="t-display text-text tabular-nums"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        {displayed}
      </motion.span>
      <span className="t-label text-text-faint">{label}</span>
    </>
  );
  return href ? (
    <Link
      href={href}
      className="group flex flex-col gap-1 bg-surface p-4 sm:p-5 transition-colors duration-200 hover:bg-surface-2 active:bg-surface-3"
    >
      {inner}
      <span className="mt-0.5 h-px w-0 bg-accent-warm transition-all duration-300 group-hover:w-full" aria-hidden />
    </Link>
  ) : (
    <div className="flex flex-col gap-1 bg-surface p-4 sm:p-5">
      {inner}
    </div>
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
      {items.map((item) => (
        <StatCell key={item.label} {...item} />
      ))}
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
          <p className="mt-2 t-caption max-w-xs">
            Tell GYF about your skin tone, body type, and the looks you love — it sharpens every
            recommendation.
          </p>
        </div>
        <Link
          href="/onboarding"
          className="inline-flex min-h-11 items-center bg-accent px-8 t-label text-bg transition-colors duration-200 hover:bg-text-mid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
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

function AccountLink() {
  return (
    <section className="flex flex-col gap-4 border-t border-border pt-8">
      <p className="t-label text-text-faint">Account</p>
      <Link
        href="/account"
        className="group flex items-center justify-between gap-4 border border-border bg-surface p-5 transition-colors hover:border-border-hi hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        <span className="flex flex-col gap-1">
          <span className="t-title text-text">Privacy & data</span>
          <span className="t-caption max-w-prose">
            Manage consent, download your data, sign out, or delete your account.
          </span>
        </span>
        <ChevronRight
          size={18}
          aria-hidden
          className="shrink-0 text-text-faint transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-text"
        />
      </Link>
    </section>
  );
}

function titleCase(value: string | null | undefined): string {
  if (!value) return "—";
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
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
      <p className="mt-3 t-caption mx-auto max-w-xs">
        Something went wrong reaching the stylist. Your data is safe — try again.
      </p>
      <Button type="button" variant="secondary" onClick={onRetry} className="mt-8">
        Retry
      </Button>
    </motion.div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="flex flex-col gap-10" aria-hidden>
      <div className="grid grid-cols-3 gap-px sm:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={`stat-${i}`} className="h-20 skeleton" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-px sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={`row-${i}`} className="h-16 skeleton" />
        ))}
      </div>
    </div>
  );
}
