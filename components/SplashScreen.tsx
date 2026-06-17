"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence, useMotionValue, useSpring } from "framer-motion";

export default function SplashScreen() {
  const [visible, setVisible] = useState(true);
  const [phase, setPhase] = useState<"in" | "hold" | "out">("in");
  const containerRef = useRef<HTMLDivElement>(null);

  const rotateX = useSpring(useMotionValue(0), { stiffness: 60, damping: 18 });
  const rotateY = useSpring(useMotionValue(0), { stiffness: 60, damping: 18 });

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("hold"), 800);
    const t2 = setTimeout(() => setPhase("out"), 2400);
    const t3 = setTimeout(() => setVisible(false), 3200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    rotateX.set(((e.clientY - cy) / rect.height) * -20);
    rotateY.set(((e.clientX - cx) / rect.width) * 20);
  };

  if (!visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => { rotateX.set(0); rotateY.set(0); }}
        className="fixed inset-0 z-[10000] flex flex-col items-center justify-center"
        style={{ background: "#0a0a0a" }}
        animate={{ opacity: phase === "out" ? 0 : 1 }}
        transition={{ duration: 0.75, ease: "easeInOut" }}
      >
        {/* Ambient glow */}
        <motion.div
          className="absolute pointer-events-none rounded-full"
          style={{
            width: 480,
            height: 480,
            background: "radial-gradient(circle, rgba(191,191,191,0.06) 0%, transparent 70%)",
          }}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: phase === "out" ? 1.5 : 1, opacity: phase === "in" ? 0 : phase === "out" ? 0 : 1 }}
          transition={{ duration: 1, ease: "easeOut" }}
        />

        {/* Interactive logo */}
        <motion.div
          style={{ rotateX, rotateY, transformStyle: "preserve-3d", perspective: 800 }}
          initial={{ opacity: 0, scale: 0.78, y: 12 }}
          animate={{ opacity: phase === "out" ? 0 : 1, scale: phase === "out" ? 1.08 : 1, y: 0 }}
          transition={{ duration: 0.85, ease: "easeOut" }}
        >
          <Image
            src="/assets/logo.png"
            alt="GYF"
            width={110}
            height={110}
            className="logo-white select-none"
            priority
            draggable={false}
          />
        </motion.div>

        {/* Wordmark */}
        <motion.p
          className="mt-5 uppercase tracking-[0.32em] text-text-muted select-none"
          style={{ fontFamily: "var(--font-mono)", fontSize: "0.58rem" }}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: phase === "hold" ? 0.6 : 0, y: phase === "hold" ? 0 : 6 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
        >
          Get Your Fit
        </motion.p>

        {/* Progress line */}
        <motion.div
          className="absolute bottom-0 left-0 h-px"
          style={{ background: "rgba(191,191,191,0.18)" }}
          initial={{ width: "0%" }}
          animate={{ width: phase === "out" ? "100%" : "55%" }}
          transition={{ duration: phase === "out" ? 0.5 : 1.8, ease: "easeInOut" }}
        />
      </motion.div>
    </AnimatePresence>
  );
}
