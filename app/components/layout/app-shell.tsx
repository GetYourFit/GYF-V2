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
      {/* No top brand header/bar — just the menu button, floating over the
          content like the canvas back/zoom controls, so it survives without
          claiming a dedicated header strip. */}
      <div
        style={{
          position: "fixed",
          top: "calc(0.75rem + env(safe-area-inset-top))",
          right: "1rem",
          zIndex: 30,
        }}
      >
        <TopMenu />
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
