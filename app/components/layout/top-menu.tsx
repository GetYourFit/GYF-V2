"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";

const MENU_ITEMS = [
  {
    href: "/contact",
    label: "Contact Us",
    description: "Get in touch with our team",
    icon: (
      <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    href: "/grievance",
    label: "Grievance",
    description: "Report an issue or concern",
    icon: (
      <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <circle cx={12} cy={12} r={10} />
        <line x1={12} y1={8} x2={12} y2={12} />
        <line x1={12} y1={16} x2={12.01} y2={16} />
      </svg>
    ),
  },
] as const;

export function TopMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const reduce = useReducedMotion();

  // Close on route change
  useEffect(() => { setOpen(false); }, [pathname]);

  // Close on outside click
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

  return (
    <div ref={ref} style={{ position: "relative", width: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {/* Three-dot trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Open menu"
        aria-expanded={open}
        aria-haspopup="true"
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          border: open ? "1px solid rgba(0,0,0,0.12)" : "1px solid transparent",
          background: open ? "rgba(0,0,0,0.05)" : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: "#1c1a17",
          transition: "background 0.15s, border-color 0.15s",
          flexShrink: 0,
        }}
      >
        <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor">
          <circle cx={5} cy={12} r={2} />
          <circle cx={12} cy={12} r={2} />
          <circle cx={19} cy={12} r={2} />
        </svg>
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            role="menu"
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              right: 0,
              minWidth: 220,
              background: "rgba(250,248,245,0.96)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              border: "1px solid rgba(0,0,0,0.08)",
              borderRadius: 14,
              boxShadow: "0 8px 32px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.04)",
              overflow: "hidden",
              zIndex: 50,
              transformOrigin: "top right",
            }}
          >
            {MENU_ITEMS.map(({ href, label, description, icon }, i) => (
              <Link
                key={href}
                href={href}
                role="menuitem"
                onClick={() => setOpen(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.875rem 1rem",
                  textDecoration: "none",
                  color: "#1c1a17",
                  borderBottom: i < MENU_ITEMS.length - 1 ? "1px solid rgba(0,0,0,0.06)" : "none",
                  transition: "background 0.12s",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(0,0,0,0.04)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; }}
              >
                <span
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    background: "#f4f1ec",
                    border: "1px solid rgba(0,0,0,0.07)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    color: "#5c5650",
                  }}
                >
                  {icon}
                </span>
                <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: "0.875rem", fontWeight: 600, lineHeight: 1.2 }}>{label}</span>
                  <span style={{ fontSize: "0.7rem", color: "#9a9490", lineHeight: 1.3 }}>{description}</span>
                </span>
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
