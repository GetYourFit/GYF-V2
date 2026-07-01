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
      className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-screen-md items-stretch border-t border-border bg-surface/95 backdrop-blur-xl"
    >
      {TAB_ITEMS.map(({ href, icon: Icon, label }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex h-[3.75rem] flex-1 flex-col items-center justify-center gap-1",
              "transition-colors duration-150",
              "active:opacity-60 motion-reduce:active:opacity-100",
              active ? "text-accent" : "text-text-faint hover:text-text-mid",
            )}
          >
            {active && (
              <motion.span
                layoutId={reduce ? undefined : "bottom-nav-indicator"}
                className="absolute top-0 left-1/2 h-[2px] w-7 -translate-x-1/2 bg-accent"
                transition={{ type: "spring", stiffness: 480, damping: 38 }}
                aria-hidden
              />
            )}
            <motion.div
              whileTap={reduce ? undefined : { scale: 0.82 }}
              transition={{ type: "spring", stiffness: 600, damping: 30 }}
            >
              <Icon
                size={21}
                className="shrink-0"
                aria-hidden
              />
            </motion.div>
            <span
              className={cn(
                "font-[family-name:var(--font-body)] text-[0.5rem] font-semibold tracking-[0.15em] uppercase",
                active ? "text-accent" : "",
              )}
            >
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
