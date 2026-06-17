"use client";

import { motion } from "framer-motion";
import { fadeUp, fadeIn, viewportOnce } from "@/lib/animations";

const values = [
  { label: "AI-First", body: "Intelligence is the foundation, not a feature added later. Every line of GYF is built around the model." },
  { label: "Trust-First", body: "Every recommendation is explainable. Sophistication and transparency advance together." },
  { label: "People-First", body: "Deeply personal, private, and designed to feel like it was built specifically for you." },
];

export default function About() {
  return (
    <section id="about" className="py-32 px-6 bg-surface border-t border-border">
      <div className="max-w-5xl mx-auto">
        <motion.p variants={fadeIn} initial="hidden" whileInView="visible" viewport={viewportOnce}
          className="uppercase tracking-[0.22em] text-text-muted mb-16"
          style={{ fontFamily: "var(--font-mono)", fontSize: "0.6rem" }}>
          About
        </motion.p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-28">
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={viewportOnce}>
            <h2 className="text-text-primary mb-8" style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.8rem,3.5vw,3rem)", fontWeight: 300, letterSpacing: "-0.02em", lineHeight: 1.15 }}>
              Why We Built This
            </h2>
            <div className="space-y-5">
              {["We built GYF because the daily friction of getting dressed shouldn't require expertise most people don't have time to develop.",
                "Style is learnable. Taste can be modeled. The intelligence to help someone look and feel their best should be available to everyone.",
                "We built the learner."
              ].map((p, i) => (
                <p key={i} className="text-text-muted" style={{ fontFamily: "var(--font-inter)", fontSize: "0.925rem", lineHeight: 1.85 }}>{p}</p>
              ))}
            </div>
          </motion.div>

          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={viewportOnce} className="flex flex-col gap-8">
            {values.map(({ label, body }) => (
              <div key={label} className="border-l-2 border-border pl-6 hover:border-accent-warm transition-colors duration-300 group">
                <p className="uppercase tracking-[0.18em] text-text-muted group-hover:text-accent-warm mb-2 transition-colors"
                  style={{ fontFamily: "var(--font-mono)", fontSize: "0.58rem" }}>{label}</p>
                <p className="text-text-muted" style={{ fontFamily: "var(--font-inter)", fontSize: "0.875rem", lineHeight: 1.8 }}>{body}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
