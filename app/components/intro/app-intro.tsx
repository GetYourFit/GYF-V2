"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { useEffect, useState } from "react";

const LUX = [0.16, 1, 0.3, 1] as const;

export function AppIntro() {
  const reduce = useReducedMotion();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), reduce ? 1200 : 2600);
    return () => clearTimeout(t);
  }, [reduce]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="intro"
          aria-hidden
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: LUX }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "#f4f3f0",
          }}
        >
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.82 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={
              reduce
                ? { duration: 0.4, ease: LUX }
                : { duration: 0.65, delay: 0.1, ease: LUX }
            }
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}
          >
            <Image
              src="/assets/logo.png"
              alt="GYF"
              width={96}
              height={96}
              priority
              style={{
                width: "clamp(64px, 14vw, 96px)",
                height: "auto",
                objectFit: "contain",
              }}
            />

            {!reduce && (
              <motion.p
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.5, ease: LUX }}
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "0.6875rem",
                  fontWeight: 600,
                  letterSpacing: "0.26em",
                  textTransform: "uppercase",
                  color: "#6a7282",
                }}
              >
                Get Your Fit
              </motion.p>
            )}
          </motion.div>

          {!reduce && (
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.6, delay: 0.7, ease: LUX }}
              style={{
                position: "absolute",
                bottom: 48,
                width: 40,
                height: 1,
                background: "#d4cfc6",
                transformOrigin: "center",
              }}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
