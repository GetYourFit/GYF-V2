"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { GYFLogo } from "@/components/brand/gyf-logo";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/* Ref7 — full-bleed black welcome: a scattered collage of tiles floating
 * around a centred wordmark, headline on top, a single white Start pill and
 * page dots at the bottom. Slides advance via CSS scroll-snap; the dots
 * mirror scroll position.
 *
 * ponytail: collage tiles are brand imagery + tonal gradients until real
 * editorial shots land — drop files into /public/assets/welcome/ and list
 * them in TILE_IMAGES to upgrade.
 */
const TILE_IMAGES = ["/assets/get-your-fit.jpg", "/assets/logo-bg.jpeg"];

interface Tile {
  top: string;
  left: string;
  w: number;
  h: number;
  img?: string;
  drift: number; // px of slow vertical drift
}

// Scattered like Ref7: asymmetric, none touching, big empty centre band
// for the wordmark.
const TILES: Tile[] = [
  { top: "12%", left: "8%", w: 96, h: 96, img: TILE_IMAGES[0], drift: 8 },
  { top: "17%", left: "38%", w: 120, h: 130, drift: -10 },
  { top: "20%", left: "70%", w: 104, h: 118, img: TILE_IMAGES[1], drift: 7 },
  { top: "33%", left: "84%", w: 64, h: 72, drift: -6 },
  { top: "56%", left: "6%", w: 88, h: 104, drift: -8 },
  { top: "62%", left: "30%", w: 68, h: 68, img: TILE_IMAGES[1], drift: 9 },
  { top: "57%", left: "48%", w: 150, h: 160, img: TILE_IMAGES[0], drift: -7 },
  { top: "60%", left: "80%", w: 78, h: 74, drift: 6 },
];

// Tonal fills for tiles without imagery — quiet, warm-to-cool greys so the
// collage reads editorial rather than empty.
const TILE_FILLS = [
  "linear-gradient(160deg, #2c2a26 0%, #17161a 100%)",
  "linear-gradient(200deg, #23262b 0%, #121317 100%)",
  "linear-gradient(150deg, #2a2320 0%, #191512 100%)",
  "linear-gradient(190deg, #26282a 0%, #101214 100%)",
];

const SLIDES = [
  {
    headline: "Discover, save,\nand get dressed",
    sub: "Your AI stylist learns what looks good on you",
  },
  {
    headline: "Outfits built\naround your wardrobe",
    sub: "Coordinated looks from clothes you already own",
  },
  {
    headline: "Smarter with\nevery person it dresses",
    sub: "Style that adapts to your body, tone, and taste",
  },
] as const;

function Collage({ reduce, offset }: { reduce: boolean | null; offset: number }) {
  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {TILES.map((t, i) => (
        <motion.div
          key={i}
          animate={reduce ? undefined : { y: [0, t.drift, 0] }}
          transition={{ duration: 9 + i, repeat: Infinity, ease: "easeInOut" }}
          style={{
            position: "absolute",
            top: t.top,
            left: t.left,
            width: t.w,
            height: t.h,
            borderRadius: 4,
            overflow: "hidden",
            // Each slide nudges the collage sideways so paging feels alive.
            transform: `translateX(${offset * -14}px)`,
            transition: "transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)",
            background: t.img ? undefined : TILE_FILLS[i % TILE_FILLS.length],
            boxShadow: "0 0 0 1px rgba(255,255,255,0.05)",
          }}
        >
          {t.img && (
            // eslint-disable-next-line @next/next/no-img-element -- decorative
            // collage tile; sizes vary per-tile, plain img keeps it simple
            <img
              src={t.img}
              alt=""
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
                filter: "grayscale(35%) brightness(0.85)",
              }}
            />
          )}
        </motion.div>
      ))}
    </div>
  );
}

export function WelcomeScreen() {
  const reduce = useReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const onScroll = () => setActive(Math.round(el.scrollLeft / el.clientWidth));
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <main
      style={{
        position: "relative",
        minHeight: "100dvh",
        background: "var(--bg)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Collage reduce={reduce} offset={active} />

      {/* Snap track — one viewport-wide slide per headline */}
      <div
        ref={trackRef}
        className="no-scrollbar"
        style={{
          flex: 1,
          display: "flex",
          overflowX: "auto",
          scrollSnapType: "x mandatory",
          position: "relative",
          zIndex: 1,
        }}
      >
        {SLIDES.map((s, i) => (
          <section
            key={i}
            aria-label={`Slide ${i + 1} of ${SLIDES.length}`}
            style={{
              minWidth: "100%",
              scrollSnapAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "calc(3rem + env(safe-area-inset-top)) 2rem 0",
              textAlign: "center",
            }}
          >
            <motion.h1
              initial={reduce ? { opacity: 1 } : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE }}
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "clamp(1.625rem, 7vw, 2.125rem)",
                fontWeight: 700,
                lineHeight: 1.25,
                letterSpacing: "-0.02em",
                color: "var(--text)",
                whiteSpace: "pre-line",
                margin: 0,
              }}
            >
              {s.headline}
            </motion.h1>

            {/* Centre band — wordmark, Ref7's COSMOS moment */}
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "1rem",
              }}
            >
              <GYFLogo width={72} />
              <span
                className="t-wordmark"
                style={{ fontSize: "clamp(2.25rem, 11vw, 3.25rem)", color: "var(--text)" }}
              >
                GYF
              </span>
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "0.9375rem",
                  color: "var(--text-mid)",
                  margin: 0,
                }}
              >
                {s.sub}
              </p>
            </div>
          </section>
        ))}
      </div>

      {/* Fixed footer — terms, Start pill, dots (Ref7) */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1.25rem",
          padding: "0 2rem calc(1.5rem + env(safe-area-inset-bottom))",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "0.8125rem",
            lineHeight: 1.5,
            color: "var(--text-faint)",
            textAlign: "center",
            margin: 0,
          }}
        >
          By creating an account, you agree to our{" "}
          <Link href="/design" style={{ color: "var(--text-mid)", textDecoration: "underline" }}>
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/design" style={{ color: "var(--text-mid)", textDecoration: "underline" }}>
            Privacy Policy
          </Link>
        </p>

        <motion.div
          whileTap={reduce ? undefined : { scale: 0.97 }}
          transition={{ type: "spring", stiffness: 500, damping: 28 }}
          style={{ width: "100%", maxWidth: 360 }}
        >
          <Link
            href="/signup"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              minHeight: 56,
              background: "var(--accent)",
              color: "var(--on-accent)",
              borderRadius: 999,
              fontFamily: "var(--font-body)",
              fontSize: "1.0625rem",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Start
          </Link>
        </motion.div>

        <Link
          href="/login"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "0.9375rem",
            color: "var(--text-mid)",
            textDecoration: "none",
          }}
        >
          Already have an account? Log In
        </Link>

        <div role="tablist" aria-label="Welcome slides" style={{ display: "flex", gap: 6 }}>
          {SLIDES.map((_, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={active === i}
              aria-label={`Go to slide ${i + 1}`}
              onClick={() =>
                trackRef.current?.scrollTo({
                  left: i * trackRef.current.clientWidth,
                  behavior: reduce ? "auto" : "smooth",
                })
              }
              style={{
                width: active === i ? 22 : 6,
                height: 3,
                borderRadius: 999,
                border: "none",
                padding: 0,
                cursor: "pointer",
                background: active === i ? "var(--text)" : "var(--surface-highest)",
                transition: "width 0.3s cubic-bezier(0.22, 1, 0.36, 1), background 0.3s",
              }}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
