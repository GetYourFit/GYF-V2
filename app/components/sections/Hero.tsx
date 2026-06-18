"use client";

import { useRef } from "react";
import Image from "next/image";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowDown } from "lucide-react";

export default function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const logoY = useTransform(scrollYProgress, [0, 1], [0, -60]);
  const headlineY = useTransform(scrollYProgress, [0, 1], [0, -40]);
  const opacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  return (
    <section
      ref={ref}
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden"
    >
      {/* Subtle bg glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% 30%, rgba(191,191,191,0.04) 0%, transparent 65%)",
        }}
      />

      <motion.div
        style={{ opacity }}
        className="relative z-10 flex flex-col items-center text-center px-6 max-w-4xl mx-auto w-full"
      >
        {/* Logo — transparent PNG, no background */}
        <motion.div
          style={{ y: logoY }}
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
          className="mb-12"
        >
          <Image
            src="/assets/logo.png"
            alt="GYF"
            width={72}
            height={72}
            className="logo-white"
            priority
          />
        </motion.div>

        {/* Headline */}
        <motion.div style={{ y: headlineY }}>
          <div className="reveal-clip mb-2">
            <motion.h1
              className="font-display font-300 text-text-primary leading-none"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(3rem,8vw,7.5rem)",
                fontWeight: 300,
                letterSpacing: "-0.03em",
                lineHeight: 0.95,
              }}
              initial={{ y: "100%" }}
              animate={{ y: "0%" }}
              transition={{ duration: 0.9, delay: 0.4, ease: "easeOut" }}
            >
              Your Style.
            </motion.h1>
          </div>
          <div className="reveal-clip">
            <motion.h1
              className="text-text-muted leading-none"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(3rem,8vw,7.5rem)",
                fontWeight: 300,
                letterSpacing: "-0.03em",
                lineHeight: 0.95,
              }}
              initial={{ y: "100%" }}
              animate={{ y: "0%" }}
              transition={{ duration: 0.9, delay: 0.55, ease: "easeOut" }}
            >
              Finally Intelligent.
            </motion.h1>
          </div>
        </motion.div>

        {/* Sub */}
        <motion.p
          className="text-text-muted mt-8 max-w-md"
          style={{
            fontFamily: "var(--font-inter)",
            fontSize: "clamp(0.85rem,1.4vw,0.975rem)",
            lineHeight: 1.8,
            fontWeight: 400,
          }}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.7, ease: "easeOut" }}
        >
          An AI stylist that learns what looks good on you — and builds complete, coordinated
          outfits you can trust.
        </motion.p>

        {/* CTAs */}
        <motion.div
          className="flex flex-col sm:flex-row items-center gap-4 mt-10"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.9, ease: "easeOut" }}
        >
          <a href="#early-access" className="btn-outline">
            Get Early Access
          </a>
          <a
            href="#what-we-do"
            className="flex items-center gap-2 text-text-muted hover:text-text-primary transition-colors uppercase tracking-widest"
            style={{ fontFamily: "var(--font-mono)", fontSize: "0.62rem" }}
          >
            Explore <ArrowDown size={11} />
          </a>
        </motion.div>
      </motion.div>

      {/* Scroll line */}
      <motion.div
        className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.8 }}
      >
        <motion.div
          className="w-px bg-accent-warm"
          style={{ height: 48, originY: 0 }}
          animate={{ scaleY: [0, 1, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
      </motion.div>
    </section>
  );
}
