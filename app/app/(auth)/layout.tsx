import Link from "next/link";
import { Suspense, type ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4 py-12">
      {/* Left brand panel — hidden on small screens */}
      <div className="fixed inset-y-0 left-0 hidden w-[46%] flex-col justify-between border-r border-[var(--rule)] px-14 py-14 lg:flex">
        <Link
          href="/"
          className="font-[family-name:var(--font-display)] text-[2.2rem] font-400 tracking-[-0.04em] text-[var(--text)] transition-opacity hover:opacity-60"
        >
          GYF
        </Link>
        <div>
          <p className="t-display text-[clamp(2rem,4vw,3.5rem)] text-[var(--text)] leading-[1.05]">
            Your style,<br />
            <em>finally</em><br />
            intelligent.
          </p>
          <p className="mt-6 t-caption max-w-[340px]">
            An AI personal stylist that learns what looks good on you and builds complete,
            coordinated outfits you can trust.
          </p>
        </div>
        <p className="t-mono text-[var(--text-faint)]">© GYF {new Date().getFullYear()}</p>
      </div>

      {/* Right form panel */}
      <div className="w-full max-w-[420px] lg:ml-[46%]">
        {/* Mobile wordmark */}
        <Link
          href="/"
          className="mb-10 block text-center font-[family-name:var(--font-display)] text-3xl tracking-[-0.04em] text-[var(--text)] lg:hidden"
        >
          GYF
        </Link>
        <Suspense fallback={null}>{children}</Suspense>
      </div>
    </main>
  );
}
