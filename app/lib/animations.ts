"use client";

import type { Variants } from "framer-motion";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const fadeUp: Variants = {
  initial:  { opacity: 0, y: 20 },
  animate:  { opacity: 1, y: 0,   transition: { duration: 0.35, ease: EASE } },
  exit:     { opacity: 0, y: -10, transition: { duration: 0.2,  ease: EASE } },
};

export const fadeIn: Variants = {
  initial:  { opacity: 0 },
  animate:  { opacity: 1, transition: { duration: 0.25 } },
  exit:     { opacity: 0, transition: { duration: 0.2  } },
};

export const scaleIn: Variants = {
  initial:  { opacity: 0, scale: 0.95 },
  animate:  { opacity: 1, scale: 1,    transition: { duration: 0.2,  ease: EASE } },
  exit:     { opacity: 0, scale: 0.95, transition: { duration: 0.15, ease: EASE } },
};

export const slideInRight: Variants = {
  initial:  { opacity: 0, x: 40  },
  animate:  { opacity: 1, x: 0,   transition: { duration: 0.32, ease: EASE } },
  exit:     { opacity: 0, x: -40, transition: { duration: 0.22, ease: EASE } },
};

export const slideUp: Variants = {
  initial:  { opacity: 0, y: "100%" },
  animate:  { opacity: 1, y: 0,      transition: { duration: 0.35, ease: EASE } },
  exit:     { opacity: 0, y: "100%", transition: { duration: 0.25, ease: EASE } },
};

export const staggerChildren: Variants = {
  animate: {
    transition: { staggerChildren: 0.07 },
  },
};

export const staggerFast: Variants = {
  animate: {
    transition: { staggerChildren: 0.05 },
  },
};

/** Card item in a staggered list */
export const cardItem: Variants = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0,  transition: { duration: 0.38, ease: EASE } },
  exit:    { opacity: 0, y: 8,  transition: { duration: 0.2,  ease: EASE } },
};

/** Spring config for tap / press interactions */
export const tapSpring = {
  type: "spring" as const,
  stiffness: 500,
  damping: 28,
};

/** Confidence bar — width animates from 0 to value */
export const confidenceBar = (pct: number) => ({
  initial:  { width: "0%" },
  animate:  { width: `${pct}%`, transition: { duration: 0.8, ease: EASE, delay: 0.2 } },
});
