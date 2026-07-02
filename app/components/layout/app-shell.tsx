import Link from "next/link";
import type { ReactNode } from "react";
import { BottomNav } from "@/components/layout/bottom-nav";
import { TopMenu } from "@/components/layout/top-menu";

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
            display: "grid",
            gridTemplateColumns: "44px 1fr 44px",
            height: "56px",
            alignItems: "center",
            padding: "0 1rem",
            maxWidth: "390px",
            margin: "0 auto",
            width: "100%",
          }}
        >
          {/* Left — empty spacer balancing the right menu button */}
          <div />

          {/* Centre — wordmark, perfectly centred */}
          <Link
            href="/"
            aria-label="Get Your Fit home"
            style={{ display: "flex", justifyContent: "center", alignItems: "center" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/get-your-fit.png"
              alt="Get Your Fit"
              style={{
                display: "block",
                width: 180,
                height: 32,
                objectFit: "none",
                objectPosition: "49% 42%",
              }}
            />
          </Link>

          {/* Right — menu button */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <TopMenu />
          </div>
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
