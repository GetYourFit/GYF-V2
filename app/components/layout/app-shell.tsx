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
        <header className="flex h-14 items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label="GYF home" className="group">
            <Image
              src="/assets/logo.png"
              alt="GYF"
              width={160}
              height={160}
              priority
              style={{ width: 56, height: "auto", mixBlendMode: "multiply" }}
              className="transition-opacity duration-150 group-hover:opacity-70"
            />
          </Link>
          <div className="w-14" aria-hidden />
        </header>
      </div>

      <main className="flex-1 overflow-y-auto pb-[calc(64px+env(safe-area-inset-bottom))]">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
