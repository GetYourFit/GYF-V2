"use client";

import { motion } from "framer-motion";
import { fadeUp, fadeIn, viewportOnce } from "@/lib/animations";

export default function Problem() {
  return (
    <section className="py-36 px-6 bg-surface border-t border-border">
      <div className="max-w-4xl mx-auto text-center">
        <motion.p variants={fadeIn} initial="hidden" whileInView="visible" viewport={viewportOnce}
          className="uppercase tracking-[0.22em] text-text-muted mb-10"
          style={{ fontFamily: "var(--font-mono)", fontSize: "0.6rem" }}>
          The Problem
        </motion.p>
        <motion.h2 variants={fadeUp} initial="hidden" whileInView="visible" viewport={viewportOnce}
          className="text-text-primary mb-8"
          style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2rem,5vw,4rem)", fontWeight: 300, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
          &ldquo;A full closet.<br />And nothing to wear.&rdquo;
        </motion.h2>
        <motion.p variants={fadeUp} initial="hidden" whileInView="visible" viewport={viewportOnce}
          className="text-text-muted max-w-lg mx-auto"
          style={{ fontFamily: "var(--font-inter)", fontSize: "0.925rem", lineHeight: 1.85 }}>
          Everyone knows this feeling. Shopping apps show items — never how to wear them together. Every morning brings the same quiet friction. GYF was built to end it.
        </motion.p>
      </div>
    </section>
  );
}
