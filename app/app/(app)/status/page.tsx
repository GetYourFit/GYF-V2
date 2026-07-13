"use client";

// The M8.5 trust surface (CLAUDE.md §2 "Trust & transparency"): an honest,
// human-readable report of what is live, what is experimental (beta/shadow),
// what is degraded (and what carries the flow instead), and what is planned
// but not built. Every value comes from GET /system/status — real runtime
// state, never hard-coded optimism.

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { PageContainer } from "@/components/layout/page-container";
import { browserApi } from "@/lib/api-client";
import type { ModelRegistryStatus, SystemStatus } from "@gyf/types";

const STATE_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  live: { label: "Live", color: "#1c6b3c", bg: "rgba(28, 107, 60, 0.10)" },
  beta: { label: "Beta", color: "#8a6d1a", bg: "rgba(138, 109, 26, 0.10)" },
  shadow: { label: "Shadow", color: "var(--text-mid)", bg: "rgba(92, 86, 80, 0.10)" },
  degraded: { label: "Degraded", color: "var(--error)", bg: "rgba(160, 69, 69, 0.10)" },
  planned: { label: "Planned", color: "var(--text-faint)", bg: "rgba(154, 148, 144, 0.12)" },
};

const CAPABILITY_LABEL: Record<string, string> = {
  outfit_recommendations: "Outfit recommendations",
  text_search: "Catalog text search",
  photo_body_type: "Photo onboarding — body type",
  photo_skin_tone: "Photo onboarding — skin tone",
  virtual_try_on: "Virtual try-on",
  affiliate_commerce: "Shopping & affiliate links",
};

export default function StatusPage() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [models, setModels] = useState<ModelRegistryStatus | null>(null);
  const [failed, setFailed] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    let cancelled = false;
    const api = browserApi();
    api
      .systemStatus()
      .then((s) => {
        if (!cancelled) setStatus(s);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    // Operator model view is best-effort: its absence never fails the page.
    api
      .systemModels()
      .then((m) => {
        if (!cancelled) setModels(m);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PageContainer width="narrow">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        style={{ marginBottom: "2rem" }}
      >
        <p
          style={{
            fontSize: "0.7rem",
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--secondary)",
            marginBottom: "0.5rem",
          }}
        >
          Trust &amp; transparency
        </p>
        <h1
          style={{
            fontSize: "clamp(1.75rem, 5vw, 2.5rem)",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: "var(--text)",
            lineHeight: 1.1,
            marginBottom: "0.75rem",
          }}
        >
          System status
        </h1>
        <p style={{ fontSize: "0.9rem", color: "var(--text-mid)", lineHeight: 1.65 }}>
          What&rsquo;s live, what&rsquo;s experimental, and what isn&rsquo;t built yet — reported
          from the system&rsquo;s real state, never marketing.
        </p>
      </motion.div>

      {failed && (
        <p style={{ fontSize: "0.85rem", color: "var(--error)" }}>
          The status report itself is unreachable right now — which is a status of its own. Try
          again shortly.
        </p>
      )}

      {status && (
        <>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {Object.entries(status.capabilities).map(([key, cap]) => {
              const style = STATE_STYLE[cap.status] ?? STATE_STYLE.shadow;
              return (
                <li
                  key={key}
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: "0.75rem",
                    padding: "0.9rem 0",
                    borderBottom: "1px solid var(--rule)",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.6rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: style.color,
                      background: style.bg,
                      borderRadius: "999px",
                      padding: "0.25rem 0.6rem",
                      flexShrink: 0,
                      minWidth: "4.5rem",
                      textAlign: "center",
                    }}
                  >
                    {style.label}
                  </span>
                  <span style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                    <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text)" }}>
                      {CAPABILITY_LABEL[key] ?? key.replace(/_/g, " ")}
                    </span>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-mid)", lineHeight: 1.5 }}>
                      {cap.detail}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>

          <p
            style={{
              marginTop: "1.5rem",
              fontSize: "0.7rem",
              color: "var(--text-faint)",
              letterSpacing: "0.02em",
            }}
          >
            Environment: {status.environment} · Database: {status.database} · Catalog:{" "}
            {status.catalog.items ?? "?"} items
            {status.catalog.with_price != null && ` (${status.catalog.with_price} priced)`}
          </p>
        </>
      )}

      {models?.available && models.models.length > 0 && <ModelLanes models={models.models} />}
    </PageContainer>
  );
}

/** Operator surface: every model behind a capability port and whether policy
 *  permits it to serve. Actual serving state is reported by the capabilities above. */
function ModelLanes({ models }: { models: ModelRegistryStatus["models"] }) {
  const production = models.filter((m) => m.lane === "production");
  const research = models.filter((m) => m.lane !== "production");

  const row = (m: ModelRegistryStatus["models"][number]) => {
    const eligible = m.runtime_servable === true;
    const label = m.runtime_servable == null ? "Not checked" : eligible ? "Eligible" : "Blocked";
    const blockers = [...m.blockers, ...m.runtime_blockers];
    return (
      <li
        key={m.name}
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: "0.75rem",
          padding: "0.75rem 0",
          borderBottom: "1px solid var(--rule)",
        }}
      >
        <span
          style={{
            fontSize: "0.6rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: eligible ? "#1c6b3c" : "var(--text-faint)",
            background: eligible ? "rgba(28, 107, 60, 0.10)" : "rgba(154, 148, 144, 0.12)",
            borderRadius: "999px",
            padding: "0.25rem 0.6rem",
            flexShrink: 0,
            minWidth: "4.5rem",
            textAlign: "center",
          }}
        >
          {label}
        </span>
        <span style={{ display: "flex", flexDirection: "column", gap: "0.15rem", minWidth: 0 }}>
          <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text)" }}>
            {m.name}{" "}
            <span style={{ fontWeight: 400, color: "var(--text-faint)" }}>· {m.capability}</span>
          </span>
          <span style={{ fontSize: "0.78rem", color: "var(--text-mid)", lineHeight: 1.5 }}>
            {m.provider} · {m.license}
            {blockers.length > 0 && ` — blocked: ${blockers.join("; ")}`}
          </span>
        </span>
      </li>
    );
  };

  return (
    <section style={{ marginTop: "2.5rem" }}>
      <h2
        style={{
          fontSize: "0.7rem",
          fontWeight: 600,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--secondary)",
          marginBottom: "0.5rem",
        }}
      >
        Models &amp; lanes
      </h2>
      <p
        style={{
          fontSize: "0.8rem",
          color: "var(--text-mid)",
          lineHeight: 1.6,
          marginBottom: "1rem",
        }}
      >
        Every model GYF can load and whether policy permits it to serve — not proof that it is
        currently serving. Live runtime state appears above. Research-lane models are offline
        north-stars, never in the live path.
      </p>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {production.map(row)}
        {research.map(row)}
      </ul>
    </section>
  );
}
