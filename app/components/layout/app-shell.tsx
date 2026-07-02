import Link from "next/link";
import Image from "next/image";
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
          <Link href="/" aria-label="Get Your Fit home">
            {/* Cropped window: shows just the wordmark text from the square canvas */}
            <div
              style={{
                width: 160,
                height: 30,
                overflow: "hidden",
                position: "relative",
                flexShrink: 0,
              }}
            >
              <Image
                src="/assets/get-your-fit.jpg"
                alt="Get Your Fit"
                width={1060}
                height={1060}
                priority
                style={{
                  position: "absolute",
                  width: 450,
                  height: 450,
                  top: -184,
                  left: -145,
                }}
              />
            </div>
          </Link>
          <TopMenu />
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
