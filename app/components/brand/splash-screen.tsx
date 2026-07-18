"use client";

import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState, useSyncExternalStore } from "react";
import { createApi } from "@/lib/api";
import { mediaUrl } from "@/lib/media";
import type { SearchResult } from "@gyf/types";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const TILE_COUNT = 6;

interface SplashScreenProps {
  onDone?: () => void;
}

// Once per session: the brand splash fronts the first navigation and waits for
// the Start tap. The shown-flag is read in the mount effect, NOT a lazy state
// initializer: initializing `visible=false` on the client while SSR rendered
// the splash is a hydration mismatch, and React recovered by orphaning the
// server-rendered splash div — a fiber-less node stuck at z-index 9999 that
// covered the whole app forever ("app not loading"). Server and client now both
// render the splash; repeat sessions dismiss it in the effect, one frame later.
function alreadyShown(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem("gyf_splash_shown") === "1";
  } catch {
    return false;
  }
}

const subscribeSession = () => () => {};

export function SplashScreen({ onDone }: SplashScreenProps) {
  const reduce = useReducedMotion();
  const shown = useSyncExternalStore(subscribeSession, alreadyShown, () => false);
  const [dismissed, setDismissed] = useState(false);
  const [tiles, setTiles] = useState<(SearchResult | null)[]>(() =>
    Array.from({ length: TILE_COUNT }, () => null),
  );
  const [loadedCount, setLoadedCount] = useState(0);

  // Repeat session: dismiss on mount — never block repeat loads.
  useEffect(() => {
    if (shown) onDone?.();
  }, [onDone, shown]);

  // Fill the placeholder tiles with real catalogue outfits (anonymous browse —
  // no auth needed). Failures are silent: tiles simply stay as shimmer slots.
  useEffect(() => {
    if (shown) return;
    const abort = new AbortController();
    createApi(() => null)
      .browse(
        { k: TILE_COUNT, slots: "top,bottom,full_body,footwear", seed: `${Date.now() % 1e6}` },
        abort.signal,
      )
      .then((results) => {
        const withImages = results.filter((r) => r.image_url).slice(0, TILE_COUNT);
        if (withImages.length > 0) {
          setTiles((prev) => prev.map((_, i) => withImages[i] ?? null));
        }
      })
      .catch(() => {});
    return () => abort.abort();
  }, [shown]);

  function dismiss() {
    navigator.vibrate?.([10, 30, 10]); // start-tap confirmation, ignored where unsupported
    setDismissed(true);
    onDone?.();
    try {
      sessionStorage.setItem("gyf_splash_shown", "1");
    } catch {}
  }

  const visible = !shown && !dismissed;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="splash"
          aria-label="Loading GYF"
          role="status"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.45, ease: EASE } }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "var(--bg)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "2rem",
            padding:
              "calc(1.5rem + env(safe-area-inset-top)) 2rem calc(2rem + env(safe-area-inset-bottom))",
            overflow: "hidden",
          }}
        >
          {/* ── Logo mark — breathe in, then a soft glow pulse ── */}
          <motion.div
            initial={reduce ? { opacity: 1 } : { opacity: 0, scale: 0.82, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE }}
            style={{ position: "relative", display: "flex", justifyContent: "center" }}
          >
            {!reduce && (
              <motion.div
                aria-hidden
                animate={{ opacity: [0.25, 0.55, 0.25], scale: [0.9, 1.08, 0.9] }}
                transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
                style={{
                  position: "absolute",
                  inset: "-20%",
                  borderRadius: "50%",
                  background:
                    "radial-gradient(circle, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 65%)",
                  pointerEvents: "none",
                }}
              />
            )}
            <Image
              src="/assets/logo-mark.png"
              alt="GYF — Get Your Fit"
              width={500}
              height={500}
              priority
              style={{ width: 132, height: "auto", filter: "var(--logo-filter)" }}
            />
          </motion.div>

          {/* ── Outfit tiles — shimmer placeholders that pop in as images land ── */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(3, 1fr)`,
              gap: "0.625rem",
              width: "100%",
              maxWidth: 340,
            }}
          >
            {tiles.map((item, i) => {
              const src = item ? mediaUrl(item.image_url, 400) : null;
              return (
                <div
                  key={i}
                  style={{
                    aspectRatio: "3 / 4",
                    borderRadius: 14,
                    overflow: "hidden",
                    background: "var(--surface-high)",
                    position: "relative",
                  }}
                >
                  {/* Shimmer stays underneath until (and unless) the image loads */}
                  {!reduce && (
                    <motion.div
                      aria-hidden
                      animate={{ opacity: [0.25, 0.55, 0.25] }}
                      transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.15 }}
                      style={{ position: "absolute", inset: 0, background: "var(--rule)" }}
                    />
                  )}
                  {src && (
                    <motion.img
                      src={src}
                      alt={item?.title ?? "Outfit"}
                      initial={reduce ? { opacity: 1 } : { opacity: 0, scale: 1.12 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.55, ease: EASE, delay: reduce ? 0 : i * 0.09 }}
                      onLoad={() => {
                        setLoadedCount((n) => n + 1);
                        if (!reduce) navigator.vibrate?.(6); // tick as each look lands
                      }}
                      style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Tagline ── */}
          <motion.p
            initial={reduce ? { opacity: 1 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE, delay: 0.5 }}
            style={{
              fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
              fontSize: "0.6875rem",
              fontWeight: 500,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--text-mid)",
              margin: 0,
              textAlign: "center",
            }}
          >
            {loadedCount > 0 ? "Your stylist is ready" : "Styling your feed…"}
          </motion.p>

          {/* ── Start button — springs in, shimmer sweep, tap to enter ── */}
          <motion.button
            type="button"
            onClick={dismiss}
            initial={reduce ? { opacity: 1 } : { opacity: 0, y: 24, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 320, damping: 22, delay: reduce ? 0 : 0.8 }}
            whileTap={reduce ? undefined : { scale: 0.94 }}
            style={{
              position: "relative",
              overflow: "hidden",
              width: "100%",
              maxWidth: 340,
              minHeight: 56,
              background: "var(--accent)",
              color: "var(--on-accent)",
              border: "none",
              borderRadius: 999,
              fontFamily: "var(--font-body, 'Plus Jakarta Sans', sans-serif)",
              fontSize: "1.0625rem",
              fontWeight: 700,
              letterSpacing: "0.01em",
              cursor: "pointer",
            }}
          >
            {!reduce && (
              <motion.span
                aria-hidden
                animate={{ x: ["-120%", "220%"] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: 1.4 }}
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  width: "40%",
                  background:
                    "linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.22) 50%, transparent 100%)",
                  pointerEvents: "none",
                }}
              />
            )}
            Start
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
