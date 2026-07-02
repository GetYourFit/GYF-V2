"use client";

import { motion } from "framer-motion";
import { GYFLogo } from "@/components/brand/GYFLogo";

export default function Loading() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9000,
        background: "#faf8f5",
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
          background: "#b87a30",
          transformOrigin: "left",
        }}
      />

      {/* GYF logo mark — pulses while loading */}
      <motion.div
        animate={{ opacity: [0.4, 1, 0.4], scale: [0.97, 1, 0.97] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        <GYFLogo width={180} />
      </motion.div>

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
          color: "#1c1a17",
          margin: 0,
        }}
      >
        Get Your Fit
      </motion.p>
    </div>
  );
}
