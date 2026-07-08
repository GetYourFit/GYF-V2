import Link from "next/link";
import type { ReactNode } from "react";
import { BottomNav } from "@/components/layout/bottom-nav";
import { TopMenu } from "@/components/layout/top-menu";
import { APP_SCROLL_ID } from "@/lib/scroll-container";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div
      style={{
        display: "flex",
        // Fixed height (not minHeight) so this container never grows past
        // the viewport — that's what makes <main>'s overflowY:auto the
        // actual scroll container instead of the page/body. Without it,
        // main just grows to fit content, body scrolls instead, and the
        // header + sticky filter bar end up fighting for the same top:0.
        height: "100dvh",
        flexDirection: "column",
        background: "var(--bg)",
        color: "var(--text)",
      }}
    >
      {/* Top brand header */}
      <div
        style={{
          paddingTop: "env(safe-area-inset-top)",
          position: "sticky",
          top: 0,
          zIndex: 30,
          background: "var(--chrome)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid var(--rule)",
          transform: "translateZ(0)",
          willChange: "transform",
        }}
      >
        <header
          style={{
            display: "grid",
            gridTemplateColumns: "44px 1fr 44px",
            height: "56px",
            alignItems: "center",
            padding: "0 1rem",
            maxWidth: "430px",
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
            <span
              style={{
                fontFamily: "var(--font-display-serif)",
                fontStyle: "normal",
                fontSize: "1.05rem",
                fontWeight: 600,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "var(--text)",
                whiteSpace: "nowrap",
              }}
            >
              Get Your Fit
            </span>
          </Link>

          {/* Right — menu button */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <TopMenu />
          </div>
        </header>
      </div>

      <main
        id={APP_SCROLL_ID}
        style={{
          flex: 1,
          overflowY: "auto",
          // iOS Safari needs this on the scroll container itself (not just
          // body) to get momentum scrolling — without it, position:sticky
          // children that also use backdrop-filter (the filter bar, the top
          // header) can visually freeze mid-gesture until the scroll ends,
          // reading as the search bar "getting stuck".
          WebkitOverflowScrolling: "touch",
          overscrollBehavior: "contain",
          paddingBottom: "calc(104px + env(safe-area-inset-bottom))",
          maxWidth: "430px",
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
