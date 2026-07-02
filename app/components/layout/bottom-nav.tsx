"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavFeed } from "@/components/icons/NavFeed";
import { NavExplore } from "@/components/icons/NavExplore";
import { NavWardrobe } from "@/components/icons/NavWardrobe";
import { NavSocial } from "@/components/icons/NavSocial";
import { NavProfile } from "@/components/icons/NavProfile";

const TABS = [
  { href: "/",         Icon: NavFeed,     label: "Stylist",  exact: true  },
  { href: "/explore",  Icon: NavExplore,  label: "Explore",  exact: false },
  { href: "/wardrobe", Icon: NavWardrobe, label: "Wardrobe", exact: false },
  { href: "/social",   Icon: NavSocial,   label: "Social",   exact: false },
  { href: "/profile",  Icon: NavProfile,  label: "Profile",  exact: false },
] as const;

const ACCENT = "#d4a96a";
const MUTED  = "#5a5a65";

export function BottomNav() {
  const pathname = usePathname();
  const reduce = useReducedMotion();

  return (
    <nav
      aria-label="Primary navigation"
      style={{
        position: "fixed",
        bottom: 0,
        zIndex: 40,
        left: "50%",
        transform: "translateX(-50%)",
        paddingBottom: "env(safe-area-inset-bottom)",
        background: "rgba(15,15,18,0.94)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderTop: "1px solid rgba(255,255,255,0.08)",
        display: "flex",
        maxWidth: "390px",
        width: "100%",
        borderRadius: "16px 16px 0 0",
      }}
    >
      {TABS.map(({ href, Icon, label, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);

        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            aria-label={label}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.25rem",
              height: "64px",
              position: "relative",
              color: active ? ACCENT : MUTED,
              textDecoration: "none",
              minWidth: "44px",
              transition: "color 0.2s",
            }}
          >
            {/* Active indicator — gold top bar */}
            {active && (
              <motion.span
                layoutId={reduce ? undefined : "nav-indicator"}
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
                aria-hidden
                style={{
                  position: "absolute",
                  top: 0,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 20,
                  height: 2,
                  background: ACCENT,
                  borderRadius: "0 0 2px 2px",
                }}
              />
            )}

            <motion.div
              whileTap={reduce ? undefined : { scale: 0.82 }}
              transition={{ type: "spring", stiffness: 600, damping: 30 }}
            >
              <Icon
                size={22}
                strokeWidth={active ? 2 : 1.5}
              />
            </motion.div>

            <span
              style={{
                fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                fontSize: "0.5rem",
                fontWeight: 500,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: active ? ACCENT : MUTED,
                lineHeight: 1,
              }}
            >
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
