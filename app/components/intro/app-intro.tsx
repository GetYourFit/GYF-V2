"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

const SESSION_KEY = "gyf_intro_shown";

const LETTERS = ["G", "Y", "F"];

const lux = [0.16, 1, 0.3, 1] as const;

export function AppIntro() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, "1");

    // Reveal on the next frame so the state update is not a synchronous setState
    // in the effect body (avoids cascading-render lint) while staying instant.
    const raf = requestAnimationFrame(() => setVisible(true));
    const t = setTimeout(() => setVisible(false), 2800);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="gyf-intro"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.55, ease: lux }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0A0A0A]"
          aria-hidden="true"
        >
          {/* Scan line */}
          <motion.div
            className="pointer-events-none absolute inset-x-0 h-[1px] bg-white/10"
            initial={{ top: "0%", opacity: 0 }}
            animate={{ top: "100%", opacity: [0, 1, 1, 0] }}
            transition={{ duration: 1.6, ease: "linear", delay: 0.1 }}
          />

          {/* GYF wordmark — letters stagger in */}
          <div className="flex items-end gap-[0.05em] overflow-hidden">
            {LETTERS.map((letter, i) => (
              <motion.span
                key={letter}
                initial={{ y: 60, opacity: 0, rotateX: 30 }}
                animate={{ y: 0, opacity: 1, rotateX: 0 }}
                transition={{
                  duration: 0.65,
                  delay: 0.15 + i * 0.1,
                  ease: lux,
                }}
                className="select-none font-[family-name:var(--font-display)] text-[clamp(4.5rem,14vw,9rem)] font-400 leading-none tracking-[-0.04em] text-white"
              >
                {letter}
              </motion.span>
            ))}
          </div>

          {/* Tagline */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.65, ease: lux }}
            className="mt-4 font-[family-name:var(--font-mono)] text-[0.65rem] uppercase tracking-[0.35em] text-white/35"
          >
            Get Your Fit
          </motion.p>

          {/* Bottom rule that extends out */}
          <motion.div
            className="absolute bottom-[12%] h-[1px] bg-white/12"
            initial={{ width: 0 }}
            animate={{ width: "clamp(120px, 20vw, 280px)" }}
            transition={{ duration: 0.9, delay: 0.5, ease: lux }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
