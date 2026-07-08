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
        background: "var(--bg)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "env(safe-area-inset-top) 1.5rem env(safe-area-inset-bottom)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Soft ambient color blobs — soothing, slow drift */}
      <motion.div
        aria-hidden
        animate={{ x: [0, 24, 0], y: [0, 18, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: "absolute",
          top: "-12%",
          left: "-18%",
          width: "60vw",
          height: "60vw",
          maxWidth: 420,
          maxHeight: 420,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 70%)",
          filter: "blur(2px)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      <motion.div
        aria-hidden
        animate={{ x: [0, -20, 0], y: [0, -14, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        style={{
          position: "absolute",
          bottom: "-14%",
          right: "-16%",
          width: "55vw",
          height: "55vw",
          maxWidth: 380,
          maxHeight: 380,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 70%)",
          filter: "blur(2px)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

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
          <Link
            href="/"
            aria-label="GYF home"
            style={{ display: "inline-block", transition: "transform 0.25s ease" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.transform = "scale(1.04)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.transform = "scale(1)";
            }}
          >
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
            <a
              href={CONTACT_MAILTO}
              style={{ color: "var(--text-mid)", textDecoration: "underline" }}
            >
              {CONTACT_EMAIL}
            </a>
          </span>
        </motion.p>
      </div>
    </main>
  );
}
