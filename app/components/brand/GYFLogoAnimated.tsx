"use client";

import { motion, useReducedMotion, type Transition } from "framer-motion";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

interface Props {
  width?: number;
}

/**
 * GYF wordmark rendered as an SVG with a stroke draw-on animation.
 * Each letter path animates from dashoffset=length→0 (left-to-right draw),
 * then the fill fades in over 0.4s. Respects prefers-reduced-motion.
 */
export function GYFLogoAnimated({ width = 200 }: Props) {
  const reduce = useReducedMotion();
  const height = Math.round(width * 0.38); // maintain ~2.6:1 ratio

  // Stroke length — enough to cover any path in the wordmark
  const DASH = 300;

  const drawTransition = (delay: number): Transition =>
    reduce
      ? { duration: 0 }
      : { duration: 1.2, ease: EASE, delay };

  const fillTransition = (delay: number): Transition =>
    reduce
      ? { duration: 0 }
      : { duration: 0.4, ease: [0.0, 0.0, 0.58, 1.0], delay };

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 200 76"
      fill="none"
      aria-label="GYF"
      role="img"
    >
      {/*
        Geometric letterform paths for "GYF".
        G — circle with gap + inner horizontal bar
        Y — two diagonal strokes meeting a vertical
        F — vertical + two horizontal bars
      */}

      {/* ── G ── */}
      <motion.path
        d="M34 10 A24 24 0 1 0 58 50 L58 36 L42 36"
        stroke="#1c1a17"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={DASH}
        initial={{ strokeDashoffset: DASH, opacity: 1 }}
        animate={{ strokeDashoffset: 0, opacity: 1 }}
        transition={drawTransition(0)}
      />
      <motion.path
        d="M34 10 A24 24 0 1 0 58 50 L58 36 L42 36"
        fill="#1c1a17"
        stroke="none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={fillTransition(1.0)}
      />

      {/* ── Y ── */}
      <motion.path
        d="M76 10 L90 34 L104 10 M90 34 L90 62"
        stroke="#1c1a17"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={DASH}
        initial={{ strokeDashoffset: DASH, opacity: 1 }}
        animate={{ strokeDashoffset: 0, opacity: 1 }}
        transition={drawTransition(0.1)}
      />
      <motion.path
        d="M76 10 L90 34 L104 10 M90 34 L90 62"
        stroke="#1c1a17"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={fillTransition(1.1)}
      />

      {/* ── F ── */}
      <motion.path
        d="M120 10 L120 62 M120 10 L156 10 M120 36 L150 36"
        stroke="#1c1a17"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={DASH}
        initial={{ strokeDashoffset: DASH, opacity: 1 }}
        animate={{ strokeDashoffset: 0, opacity: 1 }}
        transition={drawTransition(0.2)}
      />
      <motion.path
        d="M120 10 L120 62 M120 10 L156 10 M120 36 L150 36"
        stroke="#1c1a17"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={fillTransition(1.2)}
      />
    </svg>
  );
}
