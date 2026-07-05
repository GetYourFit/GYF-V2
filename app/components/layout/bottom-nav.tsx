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

const ACCENT = "var(--secondary)";
const MUTED = "#5c5650";

// Anchor hues from the app's warm palette (rose → terracotta → olive →
// ochre) — interpolated below into a dense 64-step cycle so the logo
// button's color rotation reads as a continuous drift rather than jumps.
const PALETTE_ANCHORS = ["#b04760", "#b8571f", "#6b7d3d", "#a8791f"];

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  const c = (v: number) => Math.round(v).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Evenly samples `count` colors around a cyclic loop through `anchors`. */
function buildRotation(anchors: string[], count: number): string[] {
  const rgbs = anchors.map(hexToRgb);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const pos = (i / count) * rgbs.length;
    const idx = Math.floor(pos) % rgbs.length;
    const next = (idx + 1) % rgbs.length;
    const t = pos - Math.floor(pos);
    const a = rgbs[idx];
    const b = rgbs[next];
    out.push(rgbToHex([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]));
  }
  out.push(out[0]); // repeat the first stop so the animation loop wraps smoothly
  return out;
}

// Colors the centre logo button's ring + bloom cycle through.
const ROTATING_COLORS = buildRotation(PALETTE_ANCHORS, 64);
// Total seconds for one full lap of all 64 stops — independent of stop
// count so adding more colors only makes the drift finer, not slower.
const ROTATION_DURATION = 18;

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
        {/* Outer bloom — same color cycle as the ring, one shared transition
            so both stay perfectly in sync, plus a slow breathing pulse. */}
        <motion.div
          aria-hidden
          animate={
            reduce
              ? { backgroundColor: ROTATING_COLORS[0] }
              : { backgroundColor: ROTATING_COLORS, scale: [1, 1.12, 1], opacity: [0.35, 0.55, 0.35] }
          }
          transition={
            reduce
              ? undefined
              : {
                  backgroundColor: {
                    duration: ROTATION_DURATION,
                    repeat: Infinity,
                    ease: "easeInOut",
                  },
                  scale: { duration: 3, repeat: Infinity, ease: "easeInOut" },
                  opacity: { duration: 3, repeat: Infinity, ease: "easeInOut" },
                }
          }
          style={{
            position: "absolute",
            width: 60,
            height: 60,
            borderRadius: "50%",
            filter: "blur(10px)",
          }}
        />

        {/* Button itself carries the same rotating color — a white inner
            disc keeps the logo legible against every color in the cycle. */}
        <motion.div
          whileTap={reduce ? undefined : { scale: 0.88 }}
          animate={
            reduce
              ? { backgroundColor: ROTATING_COLORS[0] }
              : { backgroundColor: ROTATING_COLORS }
          }
          transition={{
            scale: { type: "spring", stiffness: 500, damping: 25 },
            backgroundColor: reduce
              ? undefined
              : { duration: ROTATION_DURATION, repeat: Infinity, ease: "easeInOut" },
          }}
          style={{
            position: "relative",
            width: 44,
            height: 44,
            borderRadius: "50%",
            border: "1.5px solid rgba(0,0,0,0.10)",
            boxShadow: "0 2px 12px rgba(0,0,0,0.14)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "#ffffff",
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
              style={{ width: 22, height: "auto" }}
            />
          </div>
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
