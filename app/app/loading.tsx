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

      {/* GYF logo — centred, pulses while loading */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: [0, 1, 0.6, 1], scale: [0.92, 1, 0.98, 1] }}
        transition={{ duration: 1.6, ease: "easeOut" }}
        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1.5rem" }}
      >
        <GYFLogo width={260} />

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          transition={{ duration: 0.6, delay: 1 }}
          style={{
            fontFamily: "var(--font-body, 'Plus Jakarta Sans', sans-serif)",
            fontSize: "0.75rem",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            fontWeight: 500,
            color: "#5c5650",
            margin: 0,
          }}
        >
          Get Your Fit
        </motion.p>
      </motion.div>
    </div>
  );
}
