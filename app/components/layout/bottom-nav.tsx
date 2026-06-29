"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, Compass, Bookmark, Users, User } from "lucide-react";

import { cn } from "@/lib/cn";

const TAB_ITEMS = [
  { href: "/", icon: Sparkles, label: "Stylist" },
  { href: "/explore", icon: Compass, label: "Explore" },
  { href: "/saved", icon: Bookmark, label: "Saved" },
  { href: "/social", icon: Users, label: "Social" },
  { href: "/profile", icon: User, label: "Profile" },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const reduce = useReducedMotion();

  return (
    <nav
      aria-label="Primary"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-screen-md items-stretch border-t border-rule bg-bg/90 backdrop-blur-xl"
    >
      {TAB_ITEMS.map(({ href, icon: Icon, label }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex h-14 flex-1 flex-col items-center justify-center gap-1",
              "transition-colors duration-150 active:opacity-70",
              active ? "text-text" : "text-text-faint hover:text-text-mid",
            )}
          >
            {active && (
              <motion.span
                layoutId={reduce ? undefined : "bottom-nav-indicator"}
                className="absolute top-0 left-1/2 h-px w-8 -translate-x-1/2 bg-text"
                transition={{ type: "spring", stiffness: 520, damping: 40 }}
                aria-hidden
              />
            )}
            <Icon
              size={22}
              className="shrink-0 transition-transform duration-200 group-active:scale-90"
              aria-hidden
            />
            <span className="t-mono text-[0.5625rem] tracking-[0.12em]">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
