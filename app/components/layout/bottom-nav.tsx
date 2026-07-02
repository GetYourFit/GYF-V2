"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { NavExplore } from "@/components/icons/NavExplore";
import { NavWardrobe } from "@/components/icons/NavWardrobe";
import { NavSocial } from "@/components/icons/NavSocial";
import { NavProfile } from "@/components/icons/NavProfile";

const LEFT_TABS = [
  { href: "/explore", Icon: NavExplore, label: "Explore", exact: false },
  { href: "/wardrobe", Icon: NavWardrobe, label: "Wardrobe", exact: false },
] as const;

const RIGHT_TABS = [
  { href: "/social", Icon: NavSocial, label: "Social", exact: false },
  { href: "/profile", Icon: NavProfile, label: "Profile", exact: false },
] as const;

const ACCENT = "#d4607a";
const MUTED = "#5a5a65";

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
        background: "rgba(250,248,245,0.94)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderTop: "1px solid rgba(0,0,0,0.08)",
        display: "flex",
        maxWidth: "390px",
        width: "100%",
        borderRadius: "16px 16px 0 0",
      }}
    >
      {/* Left tabs */}
      {LEFT_TABS.map(({ href, Icon, label, exact }) => {
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
              <Icon size={22} strokeWidth={active ? 2 : 1.5} />
            </motion.div>
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "0.55rem",
                fontWeight: 600,
                letterSpacing: "0.06em",
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

      {/* Centre logo — redirects to Stylist */}
      <Link
        href="/"
        aria-label="GYF — Go to Stylist"
        style={{
          flex: "0 0 64px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "64px",
          position: "relative",
        }}
      >
        <motion.div
          whileTap={reduce ? undefined : { scale: 0.88 }}
          transition={{ type: "spring", stiffness: 500, damping: 25 }}
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: "#ffffff",
            border: "1.5px solid rgba(0,0,0,0.10)",
            boxShadow: "0 2px 12px rgba(0,0,0,0.10)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Image
            src="/assets/logo.png"
            alt="GYF"
            width={139}
            height={125}
            style={{ width: 28, height: "auto" }}
          />
        </motion.div>
      </Link>

      {/* Right tabs */}
      {RIGHT_TABS.map(({ href, Icon, label }) => {
        const active = pathname.startsWith(href);
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
              <Icon size={22} strokeWidth={active ? 2 : 1.5} />
            </motion.div>
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "0.55rem",
                fontWeight: 600,
                letterSpacing: "0.06em",
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
