"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { useEffect, useState } from "react";

const LUX = [0.16, 1, 0.3, 1] as const;

export function AppIntro() {
  const reduce = useReducedMotion();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), reduce ? 1000 : 2200);
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
          transition={{ duration: 0.45, ease: LUX }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--surface-2)",
          }}
        >
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={
              reduce ? { duration: 0.35, ease: LUX } : { duration: 0.6, delay: 0.08, ease: LUX }
            }
          >
            <Image
              src="/assets/logo.png"
              alt="GYF"
              width={600}
              height={600}
              priority
              style={{
                width: "clamp(180px, 40vw, 240px)",
                height: "auto",
                objectFit: "contain",
                display: "block",
                /* multiply blend removes the white canvas of the PNG on a white bg */
                mixBlendMode: "multiply",
              }}
            />
          </motion.div>

          {!reduce && (
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.5, delay: 0.55, ease: LUX }}
              style={{
                position: "absolute",
                bottom: 48,
                width: 32,
                height: 1,
                background: "#e8e8e8",
                transformOrigin: "center",
              }}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
