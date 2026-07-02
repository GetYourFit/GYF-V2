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
          <Link href="/" aria-label="GYF home">
            <GYFLogo width={110} />
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
