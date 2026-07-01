"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, Compass, Bookmark, Users, User } from "lucide-react";

import { cn } from "@/lib/cn";

const SECONDARY_TABS = [
  { href: "/explore", icon: Compass, label: "Explore" },
  { href: "/saved", icon: Bookmark, label: "Saved" },
  // Stylist (centrepiece) slot goes here in the DOM
  { href: "/social", icon: Users, label: "Social" },
  { href: "/profile", icon: User, label: "Profile" },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const stylistActive = pathname === "/";

  return (
    <nav
      aria-label="Primary"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-screen-md items-stretch overflow-visible border-t border-border bg-surface/95 backdrop-blur-xl"
    >
      {/* Left two tabs */}
      {SECONDARY_TABS.slice(0, 2).map(({ href, icon: Icon, label }) => {
        const active = pathname.startsWith(href);
        return (
          <SecondaryTab key={href} href={href} icon={Icon} label={label} active={active} reduce={reduce} />
        );
      })}

      {/* Stylist — raised centrepiece */}
      <Link
        href="/"
        aria-current={stylistActive ? "page" : undefined}
        aria-label="Stylist"
        className="group relative flex h-[3.75rem] flex-1 flex-col items-center justify-center gap-1 overflow-visible"
      >
        <motion.div
          whileTap={reduce ? undefined : { scale: 0.88 }}
          transition={{ type: "spring", stiffness: 500, damping: 28 }}
          className={cn(
            "flex h-12 w-12 -mt-5 items-center justify-center rounded-full transition-all duration-300 motion-reduce:transition-none",
            stylistActive
              ? "bg-accent shadow-[0_4px_20px_rgba(194,24,91,0.35)]"
              : "bg-surface-3 group-hover:bg-surface-2 border border-border",
          )}
        >
          <Sparkles
            size={20}
            className={cn(
              "transition-colors duration-200",
              stylistActive ? "text-white" : "text-text-faint group-hover:text-text-mid",
            )}
            aria-hidden
          />
        </motion.div>
        <span
          className={cn(
            "font-[family-name:var(--font-body)] text-[0.5rem] font-semibold tracking-[0.15em] uppercase transition-colors duration-200",
            stylistActive ? "text-accent" : "text-text-faint",
          )}
        >
          Stylist
        </span>
      </Link>

      {/* Right two tabs */}
      {SECONDARY_TABS.slice(2).map(({ href, icon: Icon, label }) => {
        const active = pathname.startsWith(href);
        return (
          <SecondaryTab key={href} href={href} icon={Icon} label={label} active={active} reduce={reduce} />
        );
      })}
    </nav>
  );
}

function SecondaryTab({
  href,
  icon: Icon,
  label,
  active,
  reduce,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  active: boolean;
  reduce: boolean | null;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-[3.75rem] flex-1 flex-col items-center justify-center gap-1",
        "transition-colors duration-150 active:opacity-60 motion-reduce:active:opacity-100",
        active ? "text-accent" : "text-text-faint hover:text-text-mid",
      )}
    >
      {active && (
        <motion.span
          layoutId={reduce ? undefined : "bottom-nav-indicator"}
          className="absolute top-0 left-1/2 h-[2px] w-6 -translate-x-1/2 bg-accent"
          transition={{ type: "spring", stiffness: 480, damping: 38 }}
          aria-hidden
        />
      )}
      <motion.div
        whileTap={reduce ? undefined : { scale: 0.82 }}
        transition={{ type: "spring", stiffness: 600, damping: 30 }}
      >
        <Icon size={20} className="shrink-0" aria-hidden />
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
}
