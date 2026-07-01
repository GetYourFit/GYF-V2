import Link from "next/link";
import type { ReactNode } from "react";
import { GYFLogo } from "@/components/brand/GYFLogo";
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
        background: "#000000",
        color: "#e2e2e9",
      }}
    >
      {/* Top brand header */}
      <div
        style={{
          paddingTop: "env(safe-area-inset-top)",
          position: "sticky",
          top: 0,
          zIndex: 30,
          background: "rgba(0,0,0,0.85)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
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
          <Link href="/" aria-label="GYF home">
            <GYFLogo
              width={80}
              style={{ filter: "brightness(0) invert(1)" }}
            />
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
