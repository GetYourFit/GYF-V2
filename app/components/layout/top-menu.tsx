"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";

const MENU_ITEMS = [
  {
    href: "/contact",
    label: "Contact Us",
    description: "Get in touch with our team",
    icon: (
      <svg
        width={20}
        height={20}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    href: "/grievance",
    label: "Grievance",
    description: "Report an issue or concern",
    icon: (
      <svg
        width={20}
        height={20}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx={12} cy={12} r={10} />
        <line x1={12} y1={8} x2={12} y2={12} />
        <line x1={12} y1={16} x2={12.01} y2={16} />
      </svg>
    ),
  },
  {
    href: "/status",
    label: "System Status",
    description: "What's live, experimental, or degraded",
    icon: (
      <svg
        width={20}
        height={20}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
] as const;

function DotsIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="currentColor">
      <circle cx={5} cy={12} r={2.2} />
      <circle cx={12} cy={12} r={2.2} />
      <circle cx={19} cy={12} r={2.2} />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
    >
      <line x1={18} y1={6} x2={6} y2={18} />
      <line x1={6} y1={6} x2={18} y2={18} />
    </svg>
  );
}

export function TopMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const reduce = useReducedMotion();

  // Hydration-safe "am I on the client" — the portal target (document.body)
  // only exists after hydration. useSyncExternalStore avoids a setState-in-
  // effect cascade: false on the server snapshot, true on the client.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  // Close the sheet on navigation via render-time state adjustment (the React
  // docs pattern) instead of an effect, so there is no post-commit re-render.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div
      ref={ref}
      style={{
        position: "relative",
        width: 44,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* ── Trigger button ── */}
      <motion.button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-haspopup="dialog"
        whileTap={reduce ? undefined : { scale: 0.78 }}
        transition={{ type: "spring", stiffness: 500, damping: 25 }}
        style={{
          width: 38,
          height: 38,
          borderRadius: "50%",
          border: "1px solid",
          borderColor: open ? "rgba(0,0,0,0.14)" : "transparent",
          background: open ? "rgba(0,0,0,0.06)" : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: "#1c1a17",
          WebkitTapHighlightColor: "transparent",
          flexShrink: 0,
          outline: "none",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Icon swap — mode="wait" ensures exit finishes before enter starts */}
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.span
              key="close"
              initial={reduce ? { opacity: 0 } : { opacity: 0, rotate: -60, scale: 0.5 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, rotate: 60, scale: 0.5 }}
              transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
              style={{ display: "flex", position: "absolute" }}
            >
              <CloseIcon />
            </motion.span>
          ) : (
            <motion.span
              key="dots"
              initial={reduce ? { opacity: 0 } : { opacity: 0, rotate: 60, scale: 0.5 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, rotate: -60, scale: 0.5 }}
              transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
              style={{ display: "flex", position: "absolute" }}
            >
              <DotsIcon />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {/* ── Backdrop + sheet rendered into document.body via portal ──
           backdrop-filter on the header creates a new CSS containing block,
           which makes position:fixed children anchor to the header instead of
           the viewport. Portal escapes that entirely. ── */}
      {mounted &&
        createPortal(
          <>
            <AnimatePresence>
              {open && (
                <motion.div
                  key="backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  onClick={() => setOpen(false)}
                  style={{
                    position: "fixed",
                    inset: 0,
                    zIndex: 40,
                    background: "rgba(28,26,23,0.4)",
                    backdropFilter: "blur(3px)",
                    WebkitBackdropFilter: "blur(3px)",
                    touchAction: "none",
                  }}
                />
              )}
            </AnimatePresence>

            {/* ── Bottom sheet — separate AnimatePresence, no CSS transform conflict ── */}
            <AnimatePresence>
              {open && (
                <motion.div
                  key="sheet"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Menu"
                  /*
                   * FIX: use margin:auto centering instead of transform:translateX(-50%).
                   * Framer Motion's y animation writes its own transform, overwriting any
                   * CSS transform set via style — the sheet would drift left during slide.
                   */
                  initial={reduce ? { opacity: 0 } : { y: "100%" }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={
                    reduce
                      ? { opacity: 0 }
                      : { y: "100%", transition: { type: "spring", stiffness: 400, damping: 40 } }
                  }
                  transition={{ type: "spring", stiffness: 350, damping: 36, mass: 0.9 }}
                  style={{
                    position: "fixed",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    margin: "0 auto",
                    width: "100%",
                    maxWidth: 390,
                    zIndex: 50,
                    background: "rgba(250,248,245,0.98)",
                    backdropFilter: "blur(28px)",
                    WebkitBackdropFilter: "blur(28px)",
                    borderRadius: "20px 20px 0 0",
                    boxShadow: "0 -4px 40px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.05)",
                    paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))",
                    overflow: "hidden",
                  }}
                >
                  {/* Drag handle */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      padding: "0.875rem 0 0.25rem",
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 4,
                        borderRadius: 99,
                        background: "rgba(0,0,0,0.14)",
                      }}
                    />
                  </div>

                  {/* Label */}
                  <p
                    style={{
                      fontSize: "0.65rem",
                      fontWeight: 700,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: "var(--text-faint)",
                      padding: "0.5rem 1.25rem 0.5rem",
                      margin: 0,
                    }}
                  >
                    Menu
                  </p>

                  {/* Items — stagger via delay, NOT nested AnimatePresence */}
                  {MENU_ITEMS.map(({ href, label, description, icon }, i) => (
                    <motion.div
                      key={href}
                      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        delay: 0.08 + i * 0.06,
                        duration: 0.25,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                    >
                      <Link
                        href={href}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "1rem",
                          padding: "0.875rem 1.25rem",
                          textDecoration: "none",
                          color: "#1c1a17",
                          borderBottom:
                            i < MENU_ITEMS.length - 1 ? "1px solid rgba(0,0,0,0.06)" : "none",
                          WebkitTapHighlightColor: "transparent",
                          transition: "background 0.1s",
                          minHeight: 64,
                        }}
                        onTouchStart={(e) => {
                          (e.currentTarget as HTMLAnchorElement).style.background =
                            "rgba(0,0,0,0.05)";
                        }}
                        onTouchEnd={(e) => {
                          setTimeout(() => {
                            (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                          }, 150);
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLAnchorElement).style.background =
                            "rgba(0,0,0,0.04)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                        }}
                      >
                        <span
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 13,
                            background: "#f4f1ec",
                            border: "1px solid rgba(0,0,0,0.08)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            color: "#5c5650",
                          }}
                        >
                          {icon}
                        </span>
                        <span style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          <span style={{ fontSize: "1rem", fontWeight: 600, lineHeight: 1.2 }}>
                            {label}
                          </span>
                          <span
                            style={{
                              fontSize: "0.78rem",
                              color: "var(--text-faint)",
                              lineHeight: 1.4,
                            }}
                          >
                            {description}
                          </span>
                        </span>
                        <span style={{ marginLeft: "auto", color: "#c5c0b8", flexShrink: 0 }}>
                          <svg
                            width={16}
                            height={16}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </span>
                      </Link>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </>,
          document.body,
        )}
    </div>
  );
}
