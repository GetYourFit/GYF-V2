"use client";

import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import type { Profile, ProfileSummary } from "@gyf/types";
import { browserApi } from "@/lib/api-client";
import { ApiError } from "@/lib/api";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

function useCountUp(target: number, duration = 800): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    const start = performance.now();
    let raf: number;
    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

type Status = "loading" | "ready" | "error";
interface Loaded { profile: Profile | null; summary: ProfileSummary; }

const EMPTY_SUMMARY: ProfileSummary = {
  outfits_made: 0, items_saved: 0, wardrobe_size: 0,
  posts: 0, reactions_received: 0, badges: [],
};

export function ProfileView() {
  const [data, setData] = useState<Loaded | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const fetchData = useCallback(async (): Promise<Loaded> => {
    const api = browserApi();
    const [profile, summary] = await Promise.all([
      api.getProfile().catch((e: unknown) => {
        if (e instanceof ApiError && e.isNotOnboarded) return null;
        throw e;
      }),
      api.getProfileSummary().catch(() => EMPTY_SUMMARY),
    ]);
    return { profile, summary };
  }, []);

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
      .then((d) => { if (!mounted.current) return; setData(d); setStatus("ready"); })
      .catch(() => { if (mounted.current) setStatus("error"); });
  }, [fetchData]);

  if (status === "loading") return <ProfileSkeleton />;
  if (status === "error" || !data) return <ErrorState onRetry={load} />;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, ease: EASE }}
      style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}
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
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "clamp(1.5rem, 6vw, 2rem)",
          fontWeight: 800,
          color: "#e8e4dc",
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1,
        }}
      >
        {displayed}
      </motion.span>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "0.55rem",
          fontWeight: 500,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "#8a8a95",
        }}
      >
        {label}
      </span>
    </>
  );

  const cellStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "0.375rem",
    background: "#0f0f12",
    padding: "1rem",
    transition: "background 0.2s",
    textDecoration: "none",
  };

  return href ? (
    <Link
      href={href}
      style={cellStyle}
      onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "#0f0f12"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "#0f0f12"; }}
    >
      {inner}
    </Link>
  ) : (
    <div style={cellStyle}>{inner}</div>
  );
}

function Stats({ summary }: { summary: ProfileSummary }) {
  const items = [
    { label: "Outfits", value: summary.outfits_made },
    { label: "Saved", value: summary.items_saved, href: "/saved" },
    { label: "Wardrobe", value: summary.wardrobe_size, href: "/wardrobe" },
    { label: "Posts", value: summary.posts, href: "/social" },
    { label: "Reactions", value: summary.reactions_received },
  ];
  return (
    <section
      aria-label="Profile statistics"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: "1px",
        background: "rgba(255,255,255,0.06)",
      }}
    >
      {items.map((item) => <StatCell key={item.label} {...item} />)}
    </section>
  );
}

function Badges({ badges }: { badges: string[] }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <p style={{
        fontFamily: "var(--font-mono)", fontSize: "0.55rem", fontWeight: 500,
        letterSpacing: "0.1em", textTransform: "uppercase", color: "#8a8a95",
      }}>
        Badges earned
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.625rem" }}>
        {badges.map((b) => (
          <span
            key={b}
            style={{
              display: "inline-flex", alignItems: "center",
              border: "1px solid rgba(255,255,255,0.1)",
              padding: "0.375rem 0.875rem",
              fontFamily: "var(--font-mono)", fontSize: "0.6rem",
              fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase",
              color: "#c4c7c8",
            }}
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
      <section style={{
        display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "1.25rem",
        border: "1px solid rgba(255,255,255,0.1)", background: "#0f0f12", padding: "1.5rem",
      }}>
        <div>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "1.125rem", fontWeight: 700, color: "#e8e4dc", marginBottom: "0.5rem" }}>
            No style profile yet
          </p>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "#8e9192", maxWidth: "280px", lineHeight: 1.55 }}>
            Tell GYF about your skin tone, body type, and the looks you love — it sharpens every recommendation.
          </p>
        </div>
        <Link
          href="/onboarding"
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            minHeight: "44px", padding: "0 2rem",
            background: "#ffffff", color: "#0f0f12",
            fontFamily: "var(--font-mono)", fontSize: "0.6rem", fontWeight: 600,
            letterSpacing: "0.1em", textTransform: "uppercase", textDecoration: "none",
            borderRadius: "999px",
          }}
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
    ["Style", profile.style_intent?.length ? profile.style_intent.map(titleCase).join(", ") : "—"],
    ["Budget", budget && (budget.min || budget.max) ? `${budget.currency} ${budget.min ?? 0}–${budget.max ?? "∞"}` : "—"],
  ];

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <p style={{
          fontFamily: "var(--font-mono)", fontSize: "0.55rem", fontWeight: 500,
          letterSpacing: "0.1em", textTransform: "uppercase", color: "#8a8a95",
        }}>
          Style profile
        </p>
        <Link href="/onboarding" style={{
          fontFamily: "var(--font-mono)", fontSize: "0.6rem", color: "#8e9192",
          textDecoration: "underline", textUnderlineOffset: "3px",
        }}>
          Edit
        </Link>
      </div>
      <dl style={{
        display: "grid", gridTemplateColumns: "1fr 1fr",
        gap: "1px", background: "rgba(255,255,255,0.06)",
      }}>
        {rows.map(([label, value]) => (
          <div key={label} style={{
            display: "flex", flexDirection: "column", gap: "0.375rem",
            background: "#0f0f12", padding: "1rem",
          }}>
            <dt style={{
              fontFamily: "var(--font-mono)", fontSize: "0.55rem", fontWeight: 500,
              letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a8a95",
            }}>
              {label}
            </dt>
            <dd style={{
              fontFamily: "var(--font-body)", fontSize: "0.875rem",
              color: "#e2e2e9", margin: 0,
            }}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function AccountLink() {
  return (
    <section style={{
      display: "flex", flexDirection: "column", gap: "1rem",
      borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "2rem",
    }}>
      <p style={{
        fontFamily: "var(--font-mono)", fontSize: "0.55rem", fontWeight: 500,
        letterSpacing: "0.1em", textTransform: "uppercase", color: "#8a8a95",
      }}>
        Account
      </p>
      <Link
        href="/account"
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: "1rem", border: "1px solid rgba(255,255,255,0.1)",
          background: "#0f0f12", padding: "1.25rem",
          textDecoration: "none", transition: "background 0.2s, border-color 0.2s",
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLAnchorElement;
          el.style.background = "#0f0f12";
          el.style.borderColor = "rgba(255,255,255,0.14)";
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLAnchorElement;
          el.style.background = "#0f0f12";
          el.style.borderColor = "rgba(255,255,255,0.1)";
        }}
      >
        <span style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <span style={{ fontFamily: "var(--font-body)", fontSize: "0.9375rem", fontWeight: 600, color: "#e8e4dc" }}>
            Privacy &amp; data
          </span>
          <span style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "#8e9192" }}>
            Manage consent, download your data, sign out, or delete your account.
          </span>
        </span>
        <ChevronRight size={18} aria-hidden style={{ flexShrink: 0, color: "#8a8a95" }} />
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
      transition={{ duration: 0.4, ease: EASE }}
      style={{ textAlign: "center", padding: "5rem 1rem" }}
    >
      <p style={{ fontFamily: "var(--font-body)", fontSize: "1.125rem", fontWeight: 700, color: "#e8e4dc", marginBottom: "0.75rem" }}>
        Couldn&apos;t load your profile
      </p>
      <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "#8e9192", marginBottom: "2rem" }}>
        Something went wrong reaching the stylist. Your data is safe — try again.
      </p>
      <button
        type="button"
        onClick={onRetry}
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          minHeight: "44px", padding: "0 1.5rem",
          border: "1px solid rgba(255,255,255,0.2)", background: "transparent",
          color: "#e8e4dc", cursor: "pointer",
          fontFamily: "var(--font-mono)", fontSize: "0.6rem",
          fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase",
        }}
      >
        Retry
      </button>
    </motion.div>
  );
}

function ProfileSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }} aria-hidden>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1px", background: "rgba(255,255,255,0.06)" }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={`stat-${i}`} style={{ height: "80px", background: "#0f0f12", opacity: 0.6 }} />
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1px", background: "rgba(255,255,255,0.06)" }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={`row-${i}`} style={{ height: "64px", background: "#0f0f12", opacity: 0.6 }} />
        ))}
      </div>
    </div>
  );
}
