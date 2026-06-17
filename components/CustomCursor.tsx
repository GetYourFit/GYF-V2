"use client";

import { useEffect, useRef } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

export default function CustomCursor() {
  const cursorX = useMotionValue(-100);
  const cursorY = useMotionValue(-100);
  const scale = useMotionValue(1);

  const springX = useSpring(cursorX, { stiffness: 280, damping: 28 });
  const springY = useSpring(cursorY, { stiffness: 280, damping: 28 });
  const springScale = useSpring(scale, { stiffness: 300, damping: 22 });
  const dotX = useSpring(cursorX, { stiffness: 600, damping: 35 });
  const dotY = useSpring(cursorY, { stiffness: 600, damping: 35 });

  const rafRef = useRef<number>(0);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        cursorX.set(e.clientX);
        cursorY.set(e.clientY);
      });
    };
    const enter = () => scale.set(2.4);
    const leave = () => scale.set(1);

    window.addEventListener("mousemove", move);

    const attach = () => {
      document.querySelectorAll("a, button, [data-hover]").forEach((el) => {
        el.addEventListener("mouseenter", enter);
        el.addEventListener("mouseleave", leave);
      });
    };
    attach();

    const obs = new MutationObserver(attach);
    obs.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.removeEventListener("mousemove", move);
      cancelAnimationFrame(rafRef.current);
      obs.disconnect();
    };
  }, [cursorX, cursorY, scale]);

  return (
    <>
      <motion.div
        className="fixed top-0 left-0 pointer-events-none z-[9999] rounded-full"
        style={{
          x: springX, y: springY, scale: springScale,
          translateX: "-50%", translateY: "-50%",
          width: 30, height: 30,
          border: "1px solid rgba(191,191,191,0.4)",
          mixBlendMode: "difference",
        }}
      />
      <motion.div
        className="fixed top-0 left-0 pointer-events-none z-[9999] rounded-full"
        style={{
          x: dotX, y: dotY,
          translateX: "-50%", translateY: "-50%",
          width: 4, height: 4,
          background: "rgba(239,239,239,0.95)",
          mixBlendMode: "difference",
        }}
      />
    </>
  );
}
