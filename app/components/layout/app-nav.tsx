"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { cn } from "@/lib/cn";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const LINKS = [
  { href: "/app", label: "Stylist" },
  { href: "/app/saved", label: "Saved" },
  { href: "/app/onboarding", label: "Profile" },
];

/** The product surface's own chrome — editorial wordmark + tracked nav, distinct
 *  from the marketing site. Includes sign-out. */
export function AppNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await createSupabaseBrowserClient().auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--rule)] bg-[var(--bg)]/85 backdrop-blur-xl">
      <nav
        aria-label="Primary"
        className="mx-auto flex max-w-6xl items-center justify-between px-[clamp(1.25rem,5vw,3rem)] py-4"
      >
        <Link
          href="/app"
          className="font-[family-name:var(--font-display)] text-2xl tracking-tight text-[var(--text)]"
        >
          GYF
        </Link>

        <div className="flex items-center gap-7">
          <ul className="hidden items-center gap-7 sm:flex">
            {LINKS.map((l) => {
              const active = pathname === l.href;
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "font-[family-name:var(--font-body)] text-[10.5px] uppercase tracking-[0.3em] transition-colors",
                      active ? "text-[var(--gold)]" : "text-[var(--mid)] hover:text-[var(--text)]",
                    )}
                  >
                    {l.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={signOut}
            className="font-[family-name:var(--font-body)] text-[10.5px] uppercase tracking-[0.3em] text-[var(--faint)] transition-colors hover:text-[var(--text)]"
          >
            Sign out
          </button>
        </div>
      </nav>
    </header>
  );
}
