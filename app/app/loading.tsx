"use client";

import { motion } from "framer-motion";
import { GYFMark } from "@/components/brand/GYFMark";

export default function Loading() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9000,
        background: "#000000",
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
          background: "#f0bd8f",
          transformOrigin: "left",
        }}
      />

      {/* Pulsing logomark */}
      <motion.div
        animate={{ opacity: [0.35, 1, 0.35] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        style={{ filter: "brightness(0) invert(1)" }}
      >
        <GYFMark size={48} />
      </motion.div>
    </div>
  );
}
