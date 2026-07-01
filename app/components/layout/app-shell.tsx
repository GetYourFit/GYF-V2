import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { BottomNav } from "@/components/layout/bottom-nav";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-bg text-text">
      {/* Top brand header */}
      <div style={{ paddingTop: "env(safe-area-inset-top)" }} className="sticky top-0 z-30 bg-surface/95 backdrop-blur-xl border-b border-border">
        <header className="flex h-14 items-center px-4 sm:px-6">
          <Link href="/" aria-label="GYF home" className="flex items-center gap-2 group">
            <Image
              src="/assets/logo.png"
              alt="GYF"
              width={160}
              height={160}
              priority
              style={{ width: 42, height: "auto" }}
              className="transition-opacity duration-150 group-hover:opacity-70"
            />
            <span
              className="t-wordmark text-[1.1rem] text-text transition-opacity duration-150 group-hover:opacity-70"
            >
              GYF
            </span>
          </Link>
        </header>
      </div>

      <main className="flex-1 overflow-y-auto pb-[calc(64px+env(safe-area-inset-bottom))]">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
