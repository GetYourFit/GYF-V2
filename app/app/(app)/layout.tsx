import type { ReactNode } from "react";

import { AppNav } from "@/components/layout/app-nav";

/** Shell for the authenticated product surface (everything under /app). */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <AppNav />
      <main className="mx-auto max-w-6xl px-[clamp(1.25rem,5vw,3rem)] py-[clamp(2rem,5vw,4rem)]">
        {children}
      </main>
    </div>
  );
}
