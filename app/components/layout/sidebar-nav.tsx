"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Sparkles,
  Compass,
  Bookmark,
  Shirt,
  Users,
  User,
  LogOut,
} from "lucide-react";

import { cn } from "@/lib/cn";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const NAV_ITEMS = [
  { href: "/",          icon: Sparkles, label: "Stylist"  },
  { href: "/explore",   icon: Compass,  label: "Explore"  },
  { href: "/saved",     icon: Bookmark, label: "Saved"    },
  { href: "/wardrobe",  icon: Shirt,    label: "Wardrobe" },
  { href: "/social",    icon: Users,    label: "Social"   },
  { href: "/profile",   icon: User,     label: "Profile"  },
] as const;

export function SidebarNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await createSupabaseBrowserClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[220px] flex-col border-r border-[var(--rule)] bg-[var(--bg)] lg:flex">
      {/* Wordmark */}
      <Link
        href="/"
        className="flex h-[64px] items-center px-7 font-[family-name:var(--font-display)] text-[1.6rem] font-400 tracking-[-0.04em] text-[var(--text)] transition-opacity hover:opacity-70"
      >
        GYF
      </Link>

      <div className="h-[1px] bg-[var(--rule)]" />

      {/* Nav links */}
      <nav aria-label="Primary" className="flex flex-1 flex-col gap-0.5 px-3 py-6">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex items-center gap-3 px-4 py-2.5 transition-all duration-[180ms]",
                active
                  ? "bg-[var(--surface-2)] text-[var(--text)]"
                  : "text-[var(--text-faint)] hover:bg-[var(--surface)] hover:text-[var(--text)]",
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors duration-[180ms]",
                  active ? "text-[var(--text)]" : "text-[var(--text-faint)] group-hover:text-[var(--text)]",
                )}
                aria-hidden
              />
              <span className="t-label text-[10px] tracking-[0.18em]">{label}</span>
              {active && (
                <span className="ml-auto h-1 w-1 rounded-full bg-[var(--accent)]" aria-hidden />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="h-[1px] bg-[var(--rule)]" />

      {/* Sign out */}
      <div className="px-3 py-4">
        <button
          type="button"
          onClick={signOut}
          className="group flex w-full items-center gap-3 px-4 py-2.5 text-[var(--text-faint)] transition-all duration-[180ms] hover:bg-[var(--surface)] hover:text-[var(--error)]"
        >
          <LogOut className="h-4 w-4 shrink-0" aria-hidden />
          <span className="t-label text-[10px] tracking-[0.18em]">Sign out</span>
        </button>
      </div>
    </aside>
  );
}
