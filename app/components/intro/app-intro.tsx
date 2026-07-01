"use client";

import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

const SESSION_KEY = "gyf_intro_shown";
const lux = [0.16, 1, 0.3, 1] as const;

export function AppIntro() {
  const [visible, setVisible] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, "1");

    const raf = requestAnimationFrame(() => setVisible(true));
    const t = setTimeout(() => setVisible(false), reduce ? 1400 : 2800);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [reduce]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="gyf-intro"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: lux }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0A0A0A]"
          aria-hidden="true"
        >
          {/* Ambient radial glow behind the mark */}
          {!reduce && (
            <motion.div
              className="pointer-events-none absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.18, 0.18, 0] }}
              transition={{ duration: 2.4, times: [0, 0.3, 0.7, 1], ease: "easeInOut" }}
              style={{
                background:
                  "radial-gradient(ellipse 50% 40% at 50% 50%, rgba(201,168,106,1) 0%, transparent 100%)",
              }}
            />
          )}

          {/* Scan line — subtle editorial texture */}
          {!reduce && (
            <motion.div
              className="pointer-events-none absolute inset-x-0 h-[1px] bg-white/8"
              initial={{ top: "0%", opacity: 0 }}
              animate={{ top: "100%", opacity: [0, 0.7, 0.7, 0] }}
              transition={{ duration: 1.8, ease: "linear", delay: 0.2 }}
            />
          )}

          {/* Logo mark */}
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={
              reduce
                ? { duration: 0.3 }
                : { duration: 0.7, ease: lux, delay: 0.1 }
            }
            className="relative flex items-center justify-center"
          >
            <Image
              src="/assets/logo.png"
              alt="GYF"
              width={120}
              height={120}
              priority
              className="select-none"
              style={{
                filter: "brightness(0) invert(1)",
                width: "clamp(80px, 18vw, 120px)",
                height: "auto",
              }}
            />
          </motion.div>

          {/* Tagline */}
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={
              reduce
                ? { duration: 0.3, delay: 0.15 }
                : { duration: 0.5, delay: 0.6, ease: lux }
            }
            className="mt-5 font-[family-name:var(--font-mono)] text-[0.6rem] uppercase tracking-[0.42em] text-white/30"
          >
            Get Your Fit
          </motion.p>

          {/* Bottom expanding rule */}
          {!reduce && (
            <motion.div
              className="absolute bottom-[12%] h-[1px] bg-white/10"
              initial={{ width: 0 }}
              animate={{ width: "clamp(80px, 16vw, 220px)" }}
              transition={{ duration: 1.0, delay: 0.5, ease: lux }}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
