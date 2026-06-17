"use client";

import { motion } from "framer-motion";
import { fadeUp, fadeIn, staggerContainer, viewportOnce } from "@/lib/animations";

const phases = [
  { number: "01", title: "The Intelligent Stylist", body: "Personalized, explained outfits from day one. Learns from real user behavior immediately.", active: true },
  { number: "02", title: "The Personal Taste Engine", body: "GYF knows your style deeply. It styles around your real wardrobe and adapts continuously.", active: false },
  { number: "03", title: "The Shopping Companion", body: "Shops with you across brands and retailers — recommending the smartest additions to your wardrobe.", active: false },
  { number: "04", title: "The Visualization Layer", body: "See any look realistically on yourself before committing. Inspiration becomes confidence.", active: false },
  { number: "05", title: "The Ambient Stylist", body: "The default way people decide what to wear. A compounding intelligence present wherever fashion decisions happen.", active: false },
];

export default function TheArc() {
  return (
    <section id="the-arc" className="py-32 px-6 bg-bg border-t border-border">
      <div className="max-w-5xl mx-auto">
        <motion.div variants={fadeIn} initial="hidden" whileInView="visible" viewport={viewportOnce} className="mb-16">
          <p className="uppercase tracking-[0.22em] text-text-muted mb-4" style={{ fontFamily: "var(--font-mono)", fontSize: "0.6rem" }}>The Arc</p>
          <h2 className="text-text-primary font-light" style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.8rem,3.5vw,3rem)", fontWeight: 300, letterSpacing: "-0.02em", lineHeight: 1.15 }}>
            Where GYF is going.
          </h2>
        </motion.div>

        <motion.div variants={staggerContainer(0.1)} initial="hidden" whileInView="visible" viewport={viewportOnce} className="flex flex-col">
          {phases.map(({ number, title, body, active }) => (
            <motion.div key={number} variants={fadeUp}
              className="flex flex-col sm:flex-row gap-6 sm:gap-12 py-8 border-b border-border last:border-b-0 group">
              <div className="flex items-center gap-4 sm:flex-col sm:items-start shrink-0 w-28">
                <span className="transition-colors" style={{
                  fontFamily: "var(--font-mono)", fontSize: "0.6rem", letterSpacing: "0.18em",
                  textTransform: "uppercase", color: active ? "var(--color-accent-warm)" : "var(--color-text-muted)"
                }}>{number}</span>
                {active && (
                  <span className="px-2 py-0.5 border text-[9px] uppercase tracking-widest shrink-0"
                    style={{ fontFamily: "var(--font-mono)", color: "var(--color-accent-warm)", borderColor: "rgba(200,169,110,0.35)" }}>
                    Now
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <h3 className="transition-colors" style={{
                  fontFamily: "var(--font-display)", fontSize: "clamp(1rem,2vw,1.35rem)",
                  fontWeight: active ? 500 : 400, letterSpacing: "-0.01em", lineHeight: 1.25,
                  color: active ? "var(--color-text-primary)" : "var(--color-text-muted)"
                }}>{title}</h3>
                <p style={{ fontFamily: "var(--font-inter)", fontSize: "0.875rem", lineHeight: 1.8, color: "var(--color-text-muted)" }}>{body}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
