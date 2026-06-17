"use client";

import { motion } from "framer-motion";
import { slideLeft, fadeIn, staggerContainer, viewportOnce } from "@/lib/animations";

const steps = [
  { number: "01", title: "Tell GYF about yourself", body: "Upload a photo or describe your body type, skin tone, budget, and occasions. Nothing is locked in — update anytime." },
  { number: "02", title: "GYF builds your first outfit", body: "A complete look — top, bottom, footwear — chosen for your specific body and taste. Every choice comes with a reason." },
  { number: "03", title: "It gets smarter with you", body: "Every save, skip, and reaction trains your personal taste model. GYF matures the longer you use it." },
];

export default function HowItWorks() {
  return (
    <section className="py-32 px-6 bg-surface border-t border-border">
      <div className="max-w-5xl mx-auto">
        <motion.div variants={fadeIn} initial="hidden" whileInView="visible" viewport={viewportOnce} className="mb-16">
          <p className="uppercase tracking-[0.22em] text-text-muted mb-4" style={{ fontFamily: "var(--font-mono)", fontSize: "0.6rem" }}>How It Works</p>
          <h2 className="text-text-primary font-light" style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.8rem,3.5vw,3rem)", fontWeight: 300, letterSpacing: "-0.02em", lineHeight: 1.15 }}>
            From first look to lasting style.
          </h2>
        </motion.div>

        <motion.div variants={staggerContainer(0.18)} initial="hidden" whileInView="visible" viewport={viewportOnce} className="flex flex-col divide-y divide-border">
          {steps.map(({ number, title, body }) => (
            <motion.div key={number} variants={slideLeft}
              className="py-10 flex flex-col sm:flex-row sm:items-start gap-6 sm:gap-14 group">
              <span className="shrink-0 text-text-muted select-none transition-colors group-hover:text-accent-warm"
                style={{ fontFamily: "var(--font-mono)", fontSize: "clamp(2rem,4vw,3.5rem)", lineHeight: 1, opacity: 0.25, fontWeight: 300 }}>
                {number}
              </span>
              <div className="flex flex-col gap-2">
                <h3 className="text-text-primary transition-colors group-hover:text-accent"
                  style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.1rem,2vw,1.5rem)", fontWeight: 400, letterSpacing: "-0.01em", lineHeight: 1.25 }}>
                  {title}
                </h3>
                <p className="text-text-muted max-w-lg" style={{ fontFamily: "var(--font-inter)", fontSize: "0.9rem", lineHeight: 1.8 }}>{body}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
