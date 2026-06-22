import Link from "next/link";
import type { ReactNode } from "react";

/** Shell for the authenticated product surface (everything under /app). */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <nav
          aria-label="Primary"
          className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3"
        >
          <Link href="/app" className="text-lg font-semibold tracking-tight text-neutral-900">
            GYF
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/app" className="text-neutral-700 hover:text-neutral-900">
              Stylist
            </Link>
            <Link href="/app/onboarding" className="text-neutral-700 hover:text-neutral-900">
              Profile
            </Link>
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
