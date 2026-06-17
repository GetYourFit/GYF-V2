"use client";

import { useRef } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { Eye, Brain, Layers } from "lucide-react";
import { fadeUp, fadeIn, staggerContainer, viewportOnce } from "@/lib/animations";

const features = [
  { icon: Eye, num: "01", title: "Sees", body: "Understands clothing visually — vibe, color harmony, silhouette, texture. Not just tags and labels." },
  { icon: Brain, num: "02", title: "Learns", body: "Builds a living model of your taste from every interaction. Gets more accurate the longer you use it." },
  { icon: Layers, num: "03", title: "Builds", body: "Delivers complete outfits — top, bottom, footwear — coordinated as one look with a clear reason for every choice." },
];

function TiltCard({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const rotX = useSpring(useMotionValue(0), { stiffness: 120, damping: 20 });
  const rotY = useSpring(useMotionValue(0), { stiffness: 120, damping: 20 });

  const onMove = (e: React.MouseEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    rotX.set(((e.clientY - r.top - r.height / 2) / r.height) * -8);
    rotY.set(((e.clientX - r.left - r.width / 2) / r.width) * 8);
  };

  return (
    <motion.div ref={ref} onMouseMove={onMove} onMouseLeave={() => { rotX.set(0); rotY.set(0); }}
      style={{ rotateX: rotX, rotateY: rotY, transformStyle: "preserve-3d", perspective: 800 }}
      className="card p-10 flex flex-col gap-5">
      {children}
    </motion.div>
  );
}

export default function WhatWeDo() {
  return (
    <section id="what-we-do" className="py-32 px-6 bg-bg border-t border-border">
      <div className="max-w-7xl mx-auto">
        <motion.div variants={fadeIn} initial="hidden" whileInView="visible" viewport={viewportOnce} className="mb-16">
          <p className="uppercase tracking-[0.22em] text-text-muted mb-4" style={{ fontFamily: "var(--font-mono)", fontSize: "0.6rem" }}>What GYF Does</p>
          <h2 className="text-text-primary font-light max-w-sm" style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.8rem,3.5vw,3rem)", fontWeight: 300, letterSpacing: "-0.02em", lineHeight: 1.15 }}>
            Three pillars of intelligent styling.
          </h2>
        </motion.div>

        <motion.div variants={staggerContainer(0.12)} initial="hidden" whileInView="visible" viewport={viewportOnce}
          className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border">
          {features.map(({ icon: Icon, num, title, body }) => (
            <motion.div key={num} variants={fadeUp}>
              <TiltCard>
                <div className="flex items-start justify-between">
                  <Icon size={17} className="text-accent" strokeWidth={1.4} />
                  <span className="text-text-muted" style={{ fontFamily: "var(--font-mono)", fontSize: "0.58rem" }}>{num}</span>
                </div>
                <h3 className="text-text-primary" style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2rem,3.5vw,3rem)", fontWeight: 300, letterSpacing: "-0.02em", lineHeight: 1 }}>
                  {title}
                </h3>
                <p className="text-text-muted" style={{ fontFamily: "var(--font-inter)", fontSize: "0.875rem", lineHeight: 1.8 }}>{body}</p>
              </TiltCard>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
