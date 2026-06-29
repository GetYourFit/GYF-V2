"use client";

// Accessible modal primitive — one implementation of the focus trap, scroll-lock,
// Escape-to-close, focus-restore, and the mobile-bottom-sheet / desktop-centered-modal
// responsive switch, so feature sheets stop hand-rolling (and under-implementing) it.
//
// Usage:
//   <Dialog open={open} onClose={close} titleId="share-title" label="Share a look">
//     <h2 id="share-title" className="t-headline">Share a look</h2>
//     …content…
//   </Dialog>
//
// Provide EITHER `titleId` (points at a heading inside) for aria-labelledby, or `label`
// for aria-label. Honours prefers-reduced-motion via framer-motion.

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, type ReactNode } from "react";

import { cn } from "@/lib/cn";
import { useCallbackRef } from "@/lib/use-callback-ref";

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** id of a heading rendered inside `children` — wires aria-labelledby. */
  titleId?: string;
  /** Fallback accessible name when there is no visible heading to point at. */
  label?: string;
  className?: string;
}

export function Dialog({ open, onClose, children, titleId, label, className }: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const reduce = useReducedMotion();
  const onCloseRef = useCallbackRef(onClose);

  // Capture the trigger to restore focus to on close.
  useEffect(() => {
    if (open) restoreRef.current = document.activeElement as HTMLElement | null;
  }, [open]);

  // Scroll-lock the page behind the modal while it is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Move focus in on open; restore it to the trigger on close.
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();
    return () => {
      restoreRef.current?.focus?.();
    };
  }, [open]);

  // Escape to close + Tab focus trap.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (n) => n.offsetParent !== null,
      );
      if (nodes.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, onCloseRef]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={onClose}
            className="absolute inset-0 h-full w-full cursor-default bg-text/30 backdrop-blur-sm"
          />
          {/* Panel — bottom sheet on mobile, centered modal on desktop */}
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-label={titleId ? undefined : label}
            tabIndex={-1}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: "4%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: "4%" }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "relative z-10 flex max-h-[92dvh] w-full flex-col overflow-y-auto bg-surface",
              "border-t border-border-mid shadow-overlay outline-none",
              "sm:max-h-[88dvh] sm:max-w-lg sm:border",
              className,
            )}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
