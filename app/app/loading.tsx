"use client";

import { motion } from "framer-motion";
import { GYFLogoAnimated } from "@/components/brand/GYFLogoAnimated";

export default function Loading() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9000,
        background: "#0f0f12",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: "2rem",
      }}
    >
      {/* Top progress bar */}
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 0.85 }}
        transition={{ duration: 1.5, ease: "easeOut" }}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "2px",
          background: "#d4a96a",
          transformOrigin: "left",
        }}
      />

      {/* Animated GYF wordmark */}
      <GYFLogoAnimated width={160} />

      {/* Subtle tagline */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.45 }}
        transition={{ duration: 0.6, delay: 0.8 }}
        style={{
          fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
          fontSize: "0.6rem",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "#e8e4dc",
          margin: 0,
        }}
      >
        Get Your Fit
      </motion.p>
    </div>
  );
}
