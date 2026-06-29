"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

type Width = "default" | "narrow" | "wide";

const WIDTH: Record<Width, string> = {
  narrow: "max-w-xl",
  default: "max-w-screen-lg",
  wide: "max-w-screen-xl",
};

interface PageContainerProps {
  children: ReactNode;
  /** Content max-width. `narrow` for forms, `wide` for dense grids. */
  width?: Width;
  className?: string;
}

/**
 * The canonical page wrapper: one max-width, one responsive padding scale, and a
 * single quiet entrance motion shared by every feature page — so the app reads as
 * one art-directed surface instead of a set of independently-spaced screens.
 *
 * Horizontal padding steps up with the viewport (`px-5 → sm:px-6 → lg:px-8`); the
 * entrance fade/rise honours `prefers-reduced-motion`. Pages render their content
 * inside it and never re-declare width or page padding.
 */
export function PageContainer({ children, width = "default", className }: PageContainerProps) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={cn("mx-auto w-full px-5 py-7 sm:px-6 sm:py-9 lg:px-8", WIDTH[width], className)}
    >
      {children}
    </motion.div>
  );
}
