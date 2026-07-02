import Link from "next/link";
import type { ReactNode } from "react";
import { BottomNav } from "@/components/layout/bottom-nav";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div
      style={{
        display: "flex",
        minHeight: "100dvh",
        flexDirection: "column",
        background: "#faf8f5",
        color: "#1c1a17",
      }}
    >
      {/* Top brand header */}
      <div
        style={{
          paddingTop: "env(safe-area-inset-top)",
          position: "sticky",
          top: 0,
          zIndex: 30,
          background: "rgba(250,248,245,0.92)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(0,0,0,0.06)",
        }}
      >
        <header
          style={{
            display: "flex",
            height: "56px",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 1rem",
            maxWidth: "390px",
            margin: "0 auto",
            width: "100%",
          }}
        >
          <Link href="/" aria-label="GYF home" style={{ display: "flex", alignItems: "center" }}>
            {/* Inline SVG wordmark — always white, never depends on PNG loading */}
            <svg width="64" height="24" viewBox="0 0 200 76" fill="none" aria-hidden>
              <path d="M34 10 A24 24 0 1 0 58 50 L58 36 L42 36" stroke="#1c1a17" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M76 10 L90 34 L104 10 M90 34 L90 62" stroke="#1c1a17" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M120 10 L120 62 M120 10 L156 10 M120 36 L150 36" stroke="#1c1a17" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
          {/* Right slot — reserved for future notifications icon */}
          <div style={{ width: 44 }} aria-hidden />
        </header>
      </div>

      <main
        style={{
          flex: 1,
          overflowY: "auto",
          paddingBottom: "calc(64px + env(safe-area-inset-bottom))",
          maxWidth: "390px",
          margin: "0 auto",
          width: "100%",
        }}
      >
        {children}
      </main>

      <BottomNav />
    </div>
  );
}
