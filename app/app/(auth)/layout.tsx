"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Suspense, type ReactNode } from "react";
import { GYFLogo } from "@/components/brand/GYFLogo";
import { CONTACT_EMAIL, CONTACT_MAILTO } from "@/lib/contact";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "#faf8f5",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "env(safe-area-inset-top) 1.5rem env(safe-area-inset-bottom)",
      }}
    >
      {/* Subtle grid overlay for industrial texture */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(0,0,0,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.015) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          maxWidth: "390px",
          display: "flex",
          flexDirection: "column",
          gap: "2.5rem",
        }}
      >
        {/* GYF Logo — min 160px on auth pages */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          style={{ display: "flex", justifyContent: "center" }}
        >
          <Link href="/" aria-label="GYF home">
            <GYFLogo width={150} />
          </Link>
        </motion.div>

        {/* Form content */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: EASE, delay: 0.1 }}
        >
          <Suspense fallback={null}>{children}</Suspense>
        </motion.div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          style={{
            fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
            fontSize: "0.6875rem",
            fontWeight: 500,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: "var(--text-faint)",
            textAlign: "center",
          }}
        >
          GYF &mdash; Get Your Fit &copy; {new Date().getFullYear()}
          <br />
          <span style={{ textTransform: "none", letterSpacing: "normal" }}>
            Contact us:{" "}
            <a href={CONTACT_MAILTO} style={{ color: "#5c5650", textDecoration: "underline" }}>
              {CONTACT_EMAIL}
            </a>
          </span>
        </motion.p>
      </div>
    </main>
  );
}
