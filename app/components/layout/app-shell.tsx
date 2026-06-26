import type { ReactNode } from "react";

import { SidebarNav } from "@/components/layout/sidebar-nav";
import { BottomNav } from "@/components/layout/bottom-nav";

interface AppShellProps {
  children: ReactNode;
}

/** The authenticated product surface shell: sidebar on desktop, bottom nav on
 *  mobile. Content area is offset accordingly. */
export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <SidebarNav />
      <BottomNav />
      <main
        className="lg:ml-[220px] pb-[80px] lg:pb-0"
      >
        <div className="mx-auto max-w-[1100px] px-[clamp(1.25rem,5vw,3rem)] py-[clamp(2rem,5vw,4rem)]">
          {children}
        </div>
      </main>
    </div>
  );
}
