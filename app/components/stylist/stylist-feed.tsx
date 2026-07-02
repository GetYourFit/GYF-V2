"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

import { OutfitCard } from "@/components/stylist/outfit-card";
import { StylistControls, type StylistQuery } from "@/components/stylist/stylist-controls";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api";
import { browserApi } from "@/lib/api-client";
import type { InteractionAction } from "@gyf/types";
import type { OutfitRecommendation } from "@gyf/types";

const EMPTY_QUERY: StylistQuery = { goal: "", occasion: "" };
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export function StylistFeed() {
  const { toast } = useToast();
  const reduce = useReducedMotion();
  const [query, setQuery] = useState<StylistQuery>(EMPTY_QUERY);
  const [data, setData] = useState<OutfitRecommendation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [saved, setSaved] = useState<Set<number>>(new Set());
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  const load = useCallback(async (q: StylistQuery) => {
    setLoading(true);
    setError(null);
    try {
      const res = await browserApi().recommend({
        goal: q.goal || undefined,
        occasion: q.occasion || undefined,
        k: 6,
      });
      setData(res);
      setSaved(new Set());
      setDismissed(new Set());
    } catch (e) {
      if (e instanceof ApiError && e.isNotOnboarded) setNeedsOnboarding(true);
      else setError(e instanceof Error ? e.message : "Could not reach your stylist.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => load(EMPTY_QUERY));
  }, [load]);

  function apply(q: StylistQuery) {
    setQuery(q);
    void load(q);
  }

  async function sendFeedback(index: number, action: InteractionAction) {
    if (!data) return;
    const outfit = data.outfits[index];
    if (!outfit) return;
    await Promise.all(
      outfit.items.map((item) =>
        browserApi().feedback({
          target_type: "item",
          target_id: item.item_id,
          action,
          context: { recommendation_id: data.recommendation_id },
        }),
      ),
    );
  }

  function onShopCart(itemId: string) {
    if (!data) return;
    void browserApi()
      .feedback({
        target_type: "item",
        target_id: itemId,
        action: "cart",
        context: { recommendation_id: data.recommendation_id },
      })
      .catch(() => {});
  }

  function onSave(index: number) {
    if (!data) return;
    const outfit = data.outfits[index];
    if (!outfit) return;
    setSaved((s) => new Set(s).add(index));
    void browserApi()
      .saveOutfit({
        outfit_key: `${data.recommendation_id}:${index}`,
        item_ids: outfit.items.map((i) => i.item_id),
        recommendation_id: data.recommendation_id,
        occasion: data.occasion,
        explanation: outfit.explanation,
        score: outfit.score,
        confidence: outfit.confidence,
      })
      .then(() => toast({ title: "Saved to your looks", description: "Find it on your Saved page.", variant: "success" }))
      .catch(() => {
        setSaved((s) => { const n = new Set(s); n.delete(index); return n; });
        toast({ title: "Couldn't save that look", description: "Please try again.", variant: "error" });
      });
    void sendFeedback(index, "save").catch(() => {});
  }

  function onDismiss(index: number) {
    setDismissed((d) => new Set(d).add(index));
    toast({ title: "Look removed", description: "We'll show fewer like it.", variant: "info" });
    void sendFeedback(index, "skip").catch(() =>
      setDismissed((d) => { const n = new Set(d); n.delete(index); return n; }),
    );
  }

  function undoDismiss(index: number) {
    setDismissed((d) => { const n = new Set(d); n.delete(index); return n; });
  }

  // ── Needs onboarding ──
  if (needsOnboarding) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60dvh", padding: "2rem" }}>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", maxWidth: "280px" }}
        >
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.6rem",
              color: "#d4a96a",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginBottom: "1rem",
            }}
          >
            Setup required
          </p>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "1.25rem",
              fontWeight: 700,
              color: "#e8e4dc",
              lineHeight: 1.25,
              marginBottom: "0.75rem",
            }}
          >
            First, tell GYF about you
          </p>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "#8e9192", marginBottom: "2rem" }}>
            A few quick preferences and your stylist gets to work.
          </p>
          <Link
            href="/onboarding"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "48px",
              padding: "0 2rem",
              background: "#ffffff",
              color: "#0f0f12",
              fontFamily: "var(--font-mono)",
              fontSize: "0.6rem",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              textDecoration: "none",
              borderRadius: "999px",
            }}
          >
            Set up my profile
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div style={{ padding: "1.25rem 1rem 1rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* ── Page header ── */}
      <motion.header
        initial={reduce ? { opacity: 1 } : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
        style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.6rem",
            fontWeight: 500,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#d4a96a",
          }}
        >
          Your stylist
        </span>
        <h1
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "clamp(1.625rem, 7vw, 2.25rem)",
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: "-0.03em",
            color: "#e8e4dc",
            margin: 0,
          }}
        >
          Complete looks,{" "}
          <em style={{ fontStyle: "italic", fontWeight: 300, color: "#c4c7c8" }}>made for you</em>
        </h1>
        {data && <StatusLine data={data} />}
      </motion.header>

      {/* ── Controls ── */}
      <StylistControls value={query} busy={loading} onApply={apply} />

      {/* ── Error ── */}
      <AnimatePresence>
        {error && (
          <motion.div
            key="error"
            role="alert"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            style={{
              padding: "0.875rem 1rem",
              border: "1px solid rgba(255,180,171,0.2)",
              background: "rgba(255,180,171,0.05)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "0.75rem",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "0.8125rem",
                color: "#ffb4ab",
              }}
            >
              {error}
            </span>
            <button
              type="button"
              onClick={() => void load(query)}
              aria-label="Retry"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.375rem",
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#8e9192",
                padding: "0.375rem 0.75rem",
                cursor: "pointer",
                fontFamily: "var(--font-mono)",
                fontSize: "0.55rem",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                flexShrink: 0,
              }}
            >
              <RefreshCw size={12} aria-hidden />
              Retry
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Skeleton ── */}
      {loading && <SkeletonGrid />}

      {/* ── Empty state ── */}
      {!loading && data && data.outfits.length === 0 && (
        <div style={{ textAlign: "center", padding: "3rem 1rem" }}>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
          >
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "1rem",
                fontWeight: 600,
                color: "#e8e4dc",
                marginBottom: "0.5rem",
              }}
            >
              No complete looks for this just yet
            </p>
            <p style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "#8a8a95" }}>
              Try a different occasion or clear your goal.
            </p>
          </motion.div>
        </div>
      )}

      {/* ── Outfit cards ── */}
      {!loading && data && data.outfits.length > 0 && (
        <motion.div
          key={data.recommendation_id}
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          <AnimatePresence mode="popLayout">
            {data.outfits.map((outfit, i) =>
              dismissed.has(i) ? (
                <motion.div
                  key={`undo-${i}`}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.2 }}
                >
                  <UndoStrip index={i} onUndo={() => undoDismiss(i)} />
                </motion.div>
              ) : (
                <motion.div
                  key={`outfit-${i}`}
                  initial={{ opacity: 0, y: reduce ? 0 : 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -40 }}
                  transition={{
                    duration: reduce ? 0.2 : 0.4,
                    delay: reduce ? 0 : i * 0.06,
                    ease: EASE,
                  }}
                >
                  <OutfitCard
                    outfit={outfit}
                    index={i}
                    saved={saved.has(i)}
                    onSave={() => onSave(i)}
                    onDismiss={() => onDismiss(i)}
                    onShopCart={onShopCart}
                  />
                </motion.div>
              ),
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}

function StatusLine({ data }: { data: OutfitRecommendation }) {
  const parts: string[] = [];
  parts.push(data.cold_start ? "Cold start" : "Personalized");
  if (data.personalized && data.taste_strength > 0) {
    parts.push(`taste ${Math.round(data.taste_strength * 100)}%`);
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem", marginTop: "0.25rem" }}>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "0.55rem",
          color: "#8a8a95",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        {parts.join(" · ")}
      </span>
      {data.applied_goals.map((g) => (
        <span
          key={g}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.55rem",
            color: "#8e9192",
            border: "1px solid rgba(255,255,255,0.1)",
            padding: "0.125rem 0.5rem",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          {g}
        </span>
      ))}
    </div>
  );
}

function UndoStrip({ index, onUndo }: { index: number; onUndo: () => void }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        minHeight: "72px",
        padding: "1rem",
        border: "1px dashed rgba(255,255,255,0.1)",
        background: "rgba(255,255,255,0.04)",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "0.6rem",
          color: "#8a8a95",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        Removed look {index + 1}
      </span>
      <button
        type="button"
        onClick={onUndo}
        style={{
          background: "transparent",
          border: "none",
          fontFamily: "var(--font-mono)",
          fontSize: "0.6rem",
          color: "#c4c7c8",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          textDecoration: "underline",
          textUnderlineOffset: "3px",
          cursor: "pointer",
          minHeight: "44px",
          padding: "0 0.5rem",
        }}
      >
        Undo
      </button>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div
      aria-hidden
      aria-label="Loading outfits"
      style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
    >
      {Array.from({ length: 3 }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.6, 0.4] }}
          transition={{ duration: 1.4, delay: i * 0.1, repeat: Infinity, repeatType: "reverse" }}
          style={{
            border: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(255,255,255,0.04)",
            borderRadius: "16px",
            overflow: "hidden",
          }}
        >
          <div style={{ aspectRatio: "16/9", background: "rgba(255,255,255,0.06)" }} />
          <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div style={{ height: "10px", width: "60%", background: "rgba(255,255,255,0.06)", borderRadius: "999px" }} />
            <div style={{ height: "8px", width: "40%", background: "rgba(255,255,255,0.06)", borderRadius: "999px" }} />
          </div>
        </motion.div>
      ))}
    </div>
  );
}
