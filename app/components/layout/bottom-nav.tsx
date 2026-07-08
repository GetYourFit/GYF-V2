"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { NavExplore } from "@/components/icons/NavExplore";
import { NavWardrobe } from "@/components/icons/NavWardrobe";
import { NavSocial } from "@/components/icons/NavSocial";
import { NavProfile } from "@/components/icons/NavProfile";

// Cosmos-style floating pill nav (Ref3): icon-only, fully rounded, hovering
// over the content instead of docking to the screen edge. Monochrome —
// the active tab is white, everything else recedes.
const LEFT_TABS = [
  { href: "/explore", Icon: NavExplore, label: "Explore" },
  { href: "/wardrobe", Icon: NavWardrobe, label: "Wardrobe" },
] as const;

const RIGHT_TABS = [
  { href: "/social", Icon: NavSocial, label: "Social" },
  { href: "/profile", Icon: NavProfile, label: "Profile" },
] as const;

const ACTIVE = "var(--text)";
const MUTED = "var(--text-faint)";

function Tab({
  href,
  Icon,
  label,
  active,
  reduce,
}: {
  href: string;
  Icon: (props: { size?: number; strokeWidth?: number }) => React.ReactNode;
  label: string;
  active: boolean;
  reduce: boolean | null;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      aria-label={label}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 48,
        height: 48,
        borderRadius: "50%",
        color: active ? ACTIVE : MUTED,
        textDecoration: "none",
        transition: "color 0.2s",
        position: "relative",
      }}
    >
      <motion.div
        whileTap={reduce ? undefined : { scale: 0.82 }}
        transition={{ type: "spring", stiffness: 600, damping: 30 }}
        style={{ display: "flex" }}
      >
        <Icon size={22} strokeWidth={active ? 2 : 1.6} />
      </motion.div>
    </Link>
  );
}

interface BottomNavProps {
  /** Collapses the pill out of view (e.g. while the host page is actively
   *  scrolling/panning) — it reappears once this flips back to false. Every
   *  other page renders the nav plain (defaults to always-visible). */
  collapsed?: boolean;
}

export function BottomNav({ collapsed = false }: BottomNavProps) {
  const pathname = usePathname();
  const reduce = useReducedMotion();

  return (
    <motion.nav
      aria-label="Primary navigation"
      animate={
        reduce
          ? { opacity: collapsed ? 0 : 1 }
          : { y: collapsed ? 96 : 0, opacity: collapsed ? 0 : 1, scale: collapsed ? 0.92 : 1 }
      }
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      style={{
        position: "fixed",
        bottom: "calc(1.125rem + env(safe-area-inset-bottom))",
        zIndex: 40,
        left: "50%",
        x: "-50%",
        display: "flex",
        alignItems: "center",
        gap: "0.25rem",
        padding: "0.375rem 0.625rem",
        background: "var(--chrome-strong)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border: "1px solid var(--rule)",
        borderRadius: 999,
        boxShadow: "var(--shadow-float)",
        pointerEvents: collapsed ? "none" : "auto",
      }}
    >
      {LEFT_TABS.map(({ href, Icon, label }) => (
        <Tab
          key={href}
          href={href}
          Icon={Icon}
          label={label}
          active={pathname.startsWith(href)}
          reduce={reduce}
        />
      ))}

      {/* Centre logo — Stylist home */}
      <Link
        href="/"
        aria-label="GYF — Go to Stylist"
        aria-current={pathname === "/" ? "page" : undefined}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 48,
          height: 48,
        }}
      >
        <motion.div
          whileTap={reduce ? undefined : { scale: 0.88 }}
          transition={{ type: "spring", stiffness: 500, damping: 25 }}
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: pathname === "/" ? "var(--text)" : "var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background 0.2s",
          }}
        >
          <Image
            src="/assets/logo.png"
            alt="GYF"
            width={139}
            height={125}
            style={{
              width: 22,
              height: "auto",
              // Black mark on the active white disc, white mark otherwise.
              filter: pathname === "/" ? "var(--logo-filter-inverse)" : "var(--logo-filter)",
            }}
          />
        </motion.div>
      </Link>

      {RIGHT_TABS.map(({ href, Icon, label }) => (
        <Tab
          key={href}
          href={href}
          Icon={Icon}
          label={label}
          active={pathname.startsWith(href)}
          reduce={reduce}
        />
      ))}
    </motion.nav>
  );
}
