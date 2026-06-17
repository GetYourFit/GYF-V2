"use client";

import { motion } from "framer-motion";
import { fadeUp, fadeIn, viewportOnce } from "@/lib/animations";

export default function Vision() {
  return (
    <section id="vision" className="py-40 px-6 bg-bg border-t border-border relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(200,169,110,0.04) 0%, transparent 70%)" }} />
      <div className="max-w-4xl mx-auto text-center relative z-10">
        <motion.p variants={fadeIn} initial="hidden" whileInView="visible" viewport={viewportOnce}
          className="uppercase tracking-[0.22em] text-text-muted mb-10"
          style={{ fontFamily: "var(--font-mono)", fontSize: "0.6rem" }}>
          Our Mission
        </motion.p>
        <motion.blockquote variants={fadeUp} initial="hidden" whileInView="visible" viewport={viewportOnce}
          className="text-text-primary mb-8"
          style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.75rem,4vw,3.25rem)", fontWeight: 300, letterSpacing: "-0.02em", lineHeight: 1.15 }}>
          &ldquo;A personal stylist for everyone.<br />Free. Instant. Genuinely yours.&rdquo;
        </motion.blockquote>
        <motion.p variants={fadeUp} initial="hidden" whileInView="visible" viewport={viewportOnce}
          className="text-text-muted max-w-lg mx-auto"
          style={{ fontFamily: "var(--font-inter)", fontSize: "0.925rem", lineHeight: 1.85 }}>
          The expertise of a professional stylist has always been a luxury for the few. GYF makes that intelligence universal — not by simplifying style, but by learning it.
        </motion.p>
      </div>
    </section>
  );
}
