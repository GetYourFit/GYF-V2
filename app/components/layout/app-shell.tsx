"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { BottomNav } from "@/components/layout/bottom-nav";
import { TopMenu } from "@/components/layout/top-menu";
import { APP_SCROLL_ID } from "@/lib/scroll-container";

// How long the scroll container must sit still before the nav pill eases
// from Liquid Glass back to its resting solid material.
const SCROLL_IDLE_MS = 300;

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  // Explore renders its own TopMenu inline in the search bar (in place of
  // the canvas-open button, which moved inside the search pill) — the
  // floating copy here would just duplicate it on that one page.
  const pathname = usePathname();
  const hideFloatingMenu = pathname === "/explore";

  // Bottom nav material: Liquid Glass while the page is actively scrolling,
  // solid chrome once it settles (resting state reads as calmer/more legible
  // than glass over static content; glass reserved for the moment of motion).
  const mainRef = useRef<HTMLElement>(null);
  const [scrolling, setScrolling] = useState(false);
  const scrollIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const onScroll = () => {
      setScrolling(true);
      if (scrollIdleTimerRef.current) clearTimeout(scrollIdleTimerRef.current);
      scrollIdleTimerRef.current = setTimeout(() => setScrolling(false), SCROLL_IDLE_MS);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (scrollIdleTimerRef.current) clearTimeout(scrollIdleTimerRef.current);
    };
  }, []);

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
      {!hideFloatingMenu && (
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
      )}

      <main
        ref={mainRef}
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

      <BottomNav solid={!scrolling} />
    </div>
  );
}
