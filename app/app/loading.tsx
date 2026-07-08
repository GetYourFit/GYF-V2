"use client";

import { motion } from "framer-motion";
import Image from "next/image";

export default function Loading() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9000,
        background: "var(--bg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
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
          background: "var(--secondary)",
          transformOrigin: "left",
        }}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.88 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0.75rem",
        }}
      >
        {/* Logo — raw Image, no extra component wrapping */}
        <Image
          src="/assets/logo.png"
          alt="GYF — Get Your Fit"
          width={139}
          height={125}
          priority
          style={{
                filter: "brightness(0) invert(1)",
            width: "160px",
            height: "auto",
          }}
        />

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          style={{
            fontFamily: "var(--font-body, 'Plus Jakarta Sans', sans-serif)",
            fontSize: "0.75rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            fontWeight: 600,
            color: "var(--text-faint)",
            margin: 0,
          }}
        >
          Get Your Fit
        </motion.p>
      </motion.div>
    </div>
  );
}
