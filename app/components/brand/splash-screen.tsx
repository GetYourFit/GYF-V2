"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { randomQuote } from "@/lib/fashionQuotes";
import { GYFLogo } from "./gyf-logo";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const MIN_SHOW_MS = 2400;
const QUOTE_INTERVAL_MS = 3500;

interface SplashScreenProps {
  onDone?: () => void;
}

export function SplashScreen({ onDone }: SplashScreenProps) {
  const reduce = useReducedMotion();
  const [visible, setVisible] = useState(true);
  const [quoteState, setQuoteState] = useState(() => randomQuote());
  const [quoteVisible, setQuoteVisible] = useState(false);

  // Show quote after logo animates in
  useEffect(() => {
    const t = setTimeout(() => setQuoteVisible(true), reduce ? 200 : 900);
    return () => clearTimeout(t);
  }, [reduce]);

  // Rotate quotes while splash is showing
  useEffect(() => {
    if (reduce) return;
    const interval = setInterval(() => {
      setQuoteVisible(false);
      setTimeout(() => {
        setQuoteState((prev) => randomQuote(prev.index));
        setQuoteVisible(true);
      }, 350);
    }, QUOTE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [reduce]);

  // Hide splash after minimum show time (effect runs at mount, so the timer
  // starts from first paint — no impure Date.now() read during render).
  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false);
      onDone?.();
      try {
        sessionStorage.setItem("gyf_splash_shown", "1");
      } catch {}
    }, MIN_SHOW_MS);
    return () => clearTimeout(t);
  }, [onDone]);

  const activeDot = quoteState.index % 3;

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
            padding: "0 2rem",
          }}
        >
          {/* ── GYF Logo ── */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <GYFLogo width={160} />
          </motion.div>

          {/* ── Progress line — ochre sweep ── */}
          {!reduce && (
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 0.85 }}
              transition={{ duration: 2.2, ease: "easeOut", delay: 0.3 }}
              style={{
                marginTop: "2.5rem",
                width: "160px",
                height: "1px",
                background: "var(--secondary)",
                transformOrigin: "left",
              }}
            />
          )}

          {/* ── Quote carousel ── */}
          <div
            style={{
              marginTop: "2.5rem",
              minHeight: "96px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              maxWidth: "280px",
              textAlign: "center",
            }}
          >
            <AnimatePresence mode="wait">
              {quoteVisible && (
                <motion.div
                  key={quoteState.index}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE } }}
                  exit={{ opacity: 0, y: -8, transition: { duration: 0.25, ease: EASE } }}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "0.75rem",
                  }}
                >
                  <p
                    style={{
                      fontFamily: "var(--font-body, 'Plus Jakarta Sans', sans-serif)",
                      fontSize: "0.875rem",
                      fontWeight: 400,
                      lineHeight: 1.6,
                      color: "var(--text-mid)",
                      margin: 0,
                    }}
                  >
                    &ldquo;{quoteState.quote.quote}&rdquo;
                  </p>
                  <p
                    style={{
                      fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                      fontSize: "0.6875rem",
                      fontWeight: 500,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      color: "var(--text-faint)",
                      opacity: 0.7,
                      margin: 0,
                    }}
                  >
                    — {quoteState.quote.author}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── 3-dot indicator ── */}
          <div style={{ marginTop: "2rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                animate={{ opacity: i === activeDot ? 1 : 0.28 }}
                transition={{ duration: 0.3 }}
                style={{
                  width: i === activeDot ? 20 : 6,
                  height: 6,
                  borderRadius: 3,
                  background: i === activeDot ? "var(--secondary)" : "var(--text-faint)",
                  display: "block",
                }}
              />
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
