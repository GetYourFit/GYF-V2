"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { fadeUp, viewportOnce } from "@/lib/animations";

export default function CTABanner() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  return (
    <section id="early-access" className="py-40 px-6 bg-bg border-t border-border relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 70% 55% at 50% 50%, rgba(200,169,110,0.05) 0%, transparent 68%)" }} />
      <div className="relative z-10 max-w-3xl mx-auto text-center">
        <motion.p variants={fadeUp} initial="hidden" whileInView="visible" viewport={viewportOnce}
          className="uppercase tracking-[0.22em] text-text-muted mb-8"
          style={{ fontFamily: "var(--font-mono)", fontSize: "0.6rem" }}>
          Early Access
        </motion.p>
        <motion.h2 variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-40px" }}
          className="text-text-primary mb-6"
          style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2.2rem,5.5vw,5rem)", fontWeight: 300, letterSpacing: "-0.03em", lineHeight: 1 }}>
          Be dressed by intelligence.
        </motion.h2>
        <motion.p variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-20px" }}
          className="text-text-muted mb-12 max-w-md mx-auto"
          style={{ fontFamily: "var(--font-inter)", fontSize: "0.9rem", lineHeight: 1.8 }}>
          Join the waitlist. Be among the first to experience an AI stylist that truly knows you.
        </motion.p>
        <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
          {submitted ? (
            <div className="flex flex-col items-center gap-3">
              <p className="text-text-primary" style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 300 }}>You&apos;re on the list.</p>
              <p className="text-text-muted" style={{ fontFamily: "var(--font-mono)", fontSize: "0.6rem", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                We&apos;ll be in touch when your spot is ready.
              </p>
            </div>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); if (email.trim()) setSubmitted(true); }}
              className="flex flex-col sm:flex-row items-center gap-3 justify-center">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com" required
                className="w-full sm:w-72 px-5 py-3 bg-surface border border-border text-text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-colors"
                style={{ fontFamily: "var(--font-inter)", fontSize: "0.875rem" }} />
              <button type="submit" className="btn-solid flex items-center gap-2 w-full sm:w-auto justify-center">
                Join Waitlist <ArrowRight size={13} />
              </button>
            </form>
          )}
        </motion.div>
      </div>
    </section>
  );
}
