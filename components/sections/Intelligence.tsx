"use client";

import { motion } from "framer-motion";
import { Scan, Fingerprint, Users, Shield } from "lucide-react";
import { fadeUp, fadeIn, staggerContainer, viewportOnce } from "@/lib/animations";

const pillars = [
  { icon: Scan, title: "Visual Intelligence", body: "Sees clothing like a stylist — reading vibe, color harmony, silhouette, and texture directly from images." },
  { icon: Fingerprint, title: "Personal Taste Modeling", body: "Builds a living model of your preferences. Anticipates what you'll love before you see it." },
  { icon: Users, title: "Collective Learning", body: "Patterns discovered across thousands of users, distilled into recommendations personal to you." },
  { icon: Shield, title: "Honest Confidence", body: "Every outfit comes with a reason. Transparent about what it knows and what it's still learning." },
];

export default function Intelligence() {
  return (
    <section className="py-32 px-6 bg-surface border-t border-border">
      <div className="max-w-7xl mx-auto">
        <motion.div variants={fadeIn} initial="hidden" whileInView="visible" viewport={viewportOnce} className="mb-16">
          <p className="uppercase tracking-[0.22em] text-text-muted mb-4" style={{ fontFamily: "var(--font-mono)", fontSize: "0.6rem" }}>The Intelligence</p>
          <h2 className="text-text-primary font-light max-w-sm" style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.8rem,3.5vw,3rem)", fontWeight: 300, letterSpacing: "-0.02em", lineHeight: 1.15 }}>
            Four pillars of AI that earns trust.
          </h2>
        </motion.div>

        <motion.div variants={staggerContainer(0.12)} initial="hidden" whileInView="visible" viewport={viewportOnce}
          className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-border">
          {pillars.map(({ icon: Icon, title, body }) => (
            <motion.div key={title} variants={fadeUp} className="card p-10 flex flex-col gap-5 group">
              <Icon size={18} className="text-text-muted group-hover:text-accent transition-colors duration-300" strokeWidth={1.4} />
              <h3 className="text-text-primary" style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.1rem,1.8vw,1.4rem)", fontWeight: 500, letterSpacing: "-0.01em", lineHeight: 1.2 }}>
                {title}
              </h3>
              <p className="text-text-muted" style={{ fontFamily: "var(--font-inter)", fontSize: "0.875rem", lineHeight: 1.8 }}>{body}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
