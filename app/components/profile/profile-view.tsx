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
    // target 0 is handled by the rAF loop itself (round(eased*0) === 0);
    // no synchronous setState in the effect body (avoids cascading renders).
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
interface Loaded {
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
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
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
      transition={{ duration: 0.35, ease: EASE }}
      style={{ display: "flex", flexDirection: "column", gap: "2rem" }}
    >
      <UserHero profile={data.profile} summary={data.summary} />
      <div style={{ padding: "0 1rem", display: "flex", flexDirection: "column", gap: "2rem" }}>
        <Stats summary={data.summary} />
        {data.summary.badges.length > 0 && <Badges badges={data.summary.badges} />}
        <StyleProfile profile={data.profile} />
        <AccountLink />
      </div>
    </motion.div>
  );
}

/** A value is showable only when the user actually set it — never "unknown". */
function isSet(value: string | null | undefined): value is string {
  return Boolean(value) && value !== "unknown";
}

function memberSince(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

function UserHero({ profile, summary }: { profile: Profile | null; summary: ProfileSummary }) {
  const displayName = summary.display_name || "Style Explorer";
  const since = memberSince(summary.member_since);

  // Styling identity, straight from the user's own profile — only fields they set.
  const identityChips = [
    profile?.gender,
    profile?.body_type,
    profile?.skin_tone,
    profile?.undertone ? `${profile.undertone} undertone` : null,
    profile?.occasion,
  ]
    .filter(isSet)
    .map(titleCase);
  const intentChips = (profile?.style_intent ?? []).filter(isSet).map(titleCase);

  const stats = [
    { label: "Outfits", value: summary.outfits_made },
    { label: "Saved", value: summary.items_saved },
    { label: "Posts", value: summary.posts },
    { label: "Badges", value: summary.badges.length },
  ];

  return (
    <div
      style={{
        background: "linear-gradient(135deg, var(--surface) 0%, var(--bg) 100%)",
        padding: "2.5rem 1.5rem 1.5rem",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "1rem",
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 88,
          height: 88,
          borderRadius: "50%",
          background: "var(--surface-2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "3px solid var(--surface-3)",
          boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "2rem",
            fontWeight: 700,
            color: "var(--text-mid)",
          }}
        >
          {displayName.charAt(0).toUpperCase()}
        </span>
      </div>

      {/* Name */}
      <p
        style={{
          fontFamily: "var(--font-body, 'Plus Jakarta Sans', sans-serif)",
          fontSize: "1.375rem",
          fontWeight: 700,
          color: "var(--text)",
          margin: 0,
          textAlign: "center",
        }}
      >
        {displayName}
      </p>

      {/* Member since + email — real account facts, shown only when known */}
      {(since || summary.email) && (
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.6rem",
            fontWeight: 500,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--text-faint)",
            margin: 0,
            textAlign: "center",
          }}
        >
          {[since ? `Member since ${since}` : null, summary.email].filter(Boolean).join("  ·  ")}
        </p>
      )}

      {/* Styling identity — only what the user actually set, never "unknown" */}
      {(identityChips.length > 0 || intentChips.length > 0) && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "0.5rem",
            maxWidth: 360,
          }}
        >
          {intentChips.map((chip) => (
            <span
              key={`intent-${chip}`}
              style={{
                background: "var(--border)",
                color: "#d4607a",
                borderRadius: "999px",
                padding: "0.25rem 0.875rem",
                fontFamily: "var(--font-body)",
                fontSize: "0.7rem",
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              {chip}
            </span>
          ))}
          {identityChips.map((chip) => (
            <span
              key={`identity-${chip}`}
              style={{
                border: "1px solid var(--border)",
                color: "var(--text-mid)",
                borderRadius: "999px",
                padding: "0.25rem 0.875rem",
                fontFamily: "var(--font-body)",
                fontSize: "0.7rem",
                fontWeight: 500,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              {chip}
            </span>
          ))}
        </div>
      )}

      {/* Stats row */}
      <div style={{ display: "flex", alignItems: "center", gap: 0, width: "100%", maxWidth: 320 }}>
        {stats.map((s, i) => (
          <div
            key={s.label}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.2rem",
              position: "relative",
            }}
          >
            {i > 0 && (
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 1,
                  height: "2rem",
                  background: "var(--border)",
                }}
              />
            )}
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "1.25rem",
                fontWeight: 700,
                color: "var(--text)",
              }}
            >
              {s.value}
            </span>
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "0.7rem",
                color: "var(--text-faint)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {/* Edit profile */}
      <Link
        href="/onboarding"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 44,
          padding: "0 1.75rem",
          width: "100%",
          maxWidth: 200,
          background: "transparent",
          border: "1.5px solid var(--text)",
          borderRadius: "999px",
          fontFamily: "var(--font-body)",
          fontSize: "0.875rem",
          fontWeight: 600,
          color: "var(--text)",
          textDecoration: "none",
        }}
      >
        Edit profile
      </Link>
    </div>
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
          color: "var(--text)",
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1,
        }}
      >
        {displayed}
      </motion.span>
      <span
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "0.55rem",
          fontWeight: 500,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--text-faint)",
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
    background: "var(--bg)",
    padding: "1rem",
    transition: "background 0.2s",
    textDecoration: "none",
  };

  return href ? (
    <Link
      href={href}
      style={cellStyle}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.background = "var(--bg)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.background = "var(--bg)";
      }}
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
        background: "var(--rule)",
      }}
    >
      {items.map((item) => (
        <StatCell key={item.label} {...item} />
      ))}
    </section>
  );
}

function Badges({ badges }: { badges: string[] }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "0.55rem",
          fontWeight: 500,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--text-faint)",
        }}
      >
        Badges earned
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.625rem" }}>
        {badges.map((b) => (
          <span
            key={b}
            style={{
              display: "inline-flex",
              alignItems: "center",
              border: "1px solid var(--border)",
              padding: "0.375rem 0.875rem",
              fontFamily: "var(--font-body)",
              fontSize: "0.6rem",
              fontWeight: 500,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--text-mid)",
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
      <section
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: "1.25rem",
          border: "1px solid var(--border)",
          background: "var(--bg)",
          padding: "1.5rem",
        }}
      >
        <div>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "1.125rem",
              fontWeight: 700,
              color: "var(--text)",
              marginBottom: "0.5rem",
            }}
          >
            No style profile yet
          </p>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "0.8125rem",
              color: "var(--text-faint)",
              maxWidth: "280px",
              lineHeight: 1.55,
            }}
          >
            Tell GYF about your skin tone, body type, and the looks you love — it sharpens every
            recommendation.
          </p>
        </div>
        <Link
          href="/onboarding"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "44px",
            padding: "0 2rem",
            background: "var(--accent)",
            color: "var(--on-accent)",
            fontFamily: "var(--font-body)",
            fontSize: "0.875rem",
            fontWeight: 600,
            textDecoration: "none",
            borderRadius: "999px",
          }}
        >
          Set up my profile
        </Link>
      </section>
    );
  }

  const budget = profile.budget_range;
  // "unknown" is an explicit non-answer — show the honest em-dash, not "Unknown".
  const shown = (v: string | null | undefined) => (isSet(v) ? titleCase(v) : "—");
  const rows: Array<[string, string]> = [
    ["Skin tone", shown(profile.skin_tone)],
    ["Undertone", shown(profile.undertone)],
    ["Body type", shown(profile.body_type)],
    ["Occasion", shown(profile.occasion)],
    ["Style", profile.style_intent?.length ? profile.style_intent.map(titleCase).join(", ") : "—"],
    [
      "Budget",
      budget && (budget.min || budget.max)
        ? `${budget.currency} ${budget.min ?? 0}–${budget.max ?? "∞"}`
        : "—",
    ],
  ];

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "0.7rem",
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--text-faint)",
          }}
        >
          Style profile
        </p>
        <Link
          href="/onboarding"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "0.6rem",
            color: "var(--text-faint)",
            textDecoration: "underline",
            textUnderlineOffset: "3px",
          }}
        >
          Edit
        </Link>
      </div>
      <dl
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1px",
          background: "var(--rule)",
        }}
      >
        {rows.map(([label, value]) => (
          <div
            key={label}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.375rem",
              background: "var(--bg)",
              padding: "1rem",
            }}
          >
            <dt
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "0.55rem",
                fontWeight: 500,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--text-faint)",
              }}
            >
              {label}
            </dt>
            <dd
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "0.875rem",
                color: "var(--text)",
                margin: 0,
              }}
            >
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
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        borderTop: "1px solid var(--border)",
        paddingTop: "2rem",
      }}
    >
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "0.55rem",
          fontWeight: 500,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--text-faint)",
        }}
      >
        Account
      </p>
      <Link
        href="/account"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          border: "1px solid var(--border)",
          background: "var(--bg)",
          padding: "1.25rem",
          textDecoration: "none",
          transition: "background 0.2s, border-color 0.2s",
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLAnchorElement;
          el.style.background = "var(--bg)";
          el.style.borderColor = "var(--border)";
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLAnchorElement;
          el.style.background = "var(--bg)";
          el.style.borderColor = "var(--border)";
        }}
      >
        <span style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "0.9375rem",
              fontWeight: 600,
              color: "var(--text)",
            }}
          >
            Privacy &amp; data
          </span>
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "0.8125rem",
              color: "var(--text-faint)",
            }}
          >
            Manage consent, download your data, sign out, or delete your account.
          </span>
        </span>
        <ChevronRight size={18} aria-hidden style={{ flexShrink: 0, color: "var(--text-faint)" }} />
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
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "1.125rem",
          fontWeight: 700,
          color: "var(--text)",
          marginBottom: "0.75rem",
        }}
      >
        Couldn&apos;t load your profile
      </p>
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "0.8125rem",
          color: "var(--text-faint)",
          marginBottom: "2rem",
        }}
      >
        Something went wrong reaching the stylist. Your data is safe — try again.
      </p>
      <button
        type="button"
        onClick={onRetry}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "44px",
          padding: "0 1.5rem",
          border: "1px solid var(--border-mid)",
          background: "transparent",
          color: "var(--text)",
          cursor: "pointer",
          fontFamily: "var(--font-body)",
          fontSize: "0.6rem",
          fontWeight: 500,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
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
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "1px",
          background: "var(--rule)",
        }}
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={`stat-${i}`} style={{ height: "80px", background: "var(--bg)", opacity: 0.6 }} />
        ))}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1px",
          background: "var(--rule)",
        }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={`row-${i}`} style={{ height: "64px", background: "var(--bg)", opacity: 0.6 }} />
        ))}
      </div>
    </div>
  );
}
