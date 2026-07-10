"use client";

import { memo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Bookmark, BookmarkCheck } from "lucide-react";

import type { SearchResult } from "@gyf/types";
import { formatPrice } from "@/lib/format";
import { mediaSrcSet, mediaUrl } from "@/lib/media";

interface ExploreCardProps {
  item: SearchResult;
  index: number;
  saved: boolean;
  /** First screenful: load eagerly at high priority for a fast LCP; later cards stay lazy. */
  priority?: boolean;
  onSave: (item: SearchResult) => void;
  onSelect?: (item: SearchResult) => void;
}

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/** Deterministic per-item pseudo-random aspect ratio for the placeholder box
 *  (before the real image reports its intrinsic size) — same idea as the
 *  Canvas cluster's hash01, kept local since the two grids don't share a
 *  layout engine. Portrait-leaning, matching the catalog's garment photos. */
function placeholderRatio(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return 0.68 + ((h >>> 0) % 1000) / 1000 / 1.6; // ~0.68–1.3
}

// Long-press-then-drag-to-save: press and hold a card, a "Save" pill pops up
// near the touch point, drag onto it and release to save — the existing
// bookmark button already covers the single-tap case, this is the faster
// gesture for browsing one-handed.
const LONG_PRESS_MS = 450;
const MOVE_CANCEL_PX = 10; // a real long-press holds still; more than this before the timer fires reads as a scroll/swipe, not a hold
const PILL_OFFSET_Y = 64; // px above the touch point

function ExploreCardImpl({ item, index, saved, priority, onSave, onSelect }: ExploreCardProps) {
  const reduce = useReducedMotion();
  const [loaded, setLoaded] = useState(false);
  const price = formatPrice(item.price, item.currency);
  const openDetail = onSelect ? () => onSelect(item) : undefined;

  const [pill, setPill] = useState<{ x: number; y: number; over: boolean } | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerId = useRef<number | null>(null);
  const startPos = useRef({ x: 0, y: 0 });
  const pillRect = useRef<DOMRect | null>(null);

  function clearPress() {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    pointerId.current = null;
    setPill(null);
  }

  function onCardPointerDown(e: React.PointerEvent) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // The pill sits above the card, outside its bounds — once the finger
    // drags up toward it, the browser would otherwise start routing move/up
    // events to whatever's now under the finger instead of this card.
    e.currentTarget.setPointerCapture(e.pointerId);
    const { clientX, clientY } = e; // snapshot — the timeout fires long after this handler returns
    startPos.current = { x: clientX, y: clientY };
    pointerId.current = e.pointerId;
    pressTimer.current = setTimeout(() => {
      pressTimer.current = null;
      navigator.vibrate?.(10);
      setPill({ x: clientX, y: clientY - PILL_OFFSET_Y, over: false });
    }, LONG_PRESS_MS);
  }

  function onCardPointerMove(e: React.PointerEvent) {
    if (pointerId.current !== e.pointerId) return;
    if (pressTimer.current) {
      // Still waiting for the hold to register — real presses don't wander.
      const dx = e.clientX - startPos.current.x;
      const dy = e.clientY - startPos.current.y;
      if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) clearPress();
      return;
    }
    if (!pill) return;
    if (!pillRect.current) return;
    const r = pillRect.current;
    const over =
      e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (over !== pill.over) setPill({ ...pill, over });
  }

  // A completed long-press (pill shown, regardless of whether the drag ended
  // on it) is a drag gesture, not a tap — the click event that follows
  // pointerup must not also open the detail sheet.
  const longPressed = useRef(false);

  function onCardPointerUp(e: React.PointerEvent) {
    if (pointerId.current !== e.pointerId) return;
    if (pill) {
      longPressed.current = true;
      if (pill.over) {
        navigator.vibrate?.([8, 20, 8]);
        onSave(item);
      }
    }
    clearPress();
  }

  return (
    <>
      <motion.article
        onPointerDown={onCardPointerDown}
        onPointerMove={onCardPointerMove}
        onPointerUp={onCardPointerUp}
        onPointerCancel={clearPress}
        // No `layout` prop: Framer Motion's FLIP position-tracking assumes
        // normal flex/grid reflow to diff before/after rects. This grid is
        // CSS multi-column (masonry sized to each image's own resolution —
        // see explore-grid.tsx), where column-fill reflow doesn't match that
        // model at all; `layout` here was measuring against the wrong box and
        // producing overlapping/misplaced tiles instead of a clean masonry.
        initial={reduce ? false : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.45,
          delay: reduce ? 0 : Math.min(index * 0.03, 0.4),
          ease: EASE,
        }}
        whileHover={reduce ? undefined : { scale: 1.02, y: -2 }}
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          background: "var(--surface-2)",
          border: "1px solid var(--rule)",
          // Sharp corners (Ref1–4 masonry language) — images are the whole
          // tile here, so the card itself stays unrounded.
          borderRadius: 0,
          overflow: "hidden",
          cursor: onSelect ? "pointer" : "default",
          boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
          // Masonry (CSS multi-column parent): each card must stay in one
          // column instead of splitting across the column break, with its own
          // bottom gap since column-gap only spaces sideways.
          breakInside: "avoid",
          marginBottom: "0.75rem",
          // Once the save-pill is up, the drag onto it must not also scroll
          // the page out from under the finger.
          touchAction: pill ? "none" : undefined,
        }}
        onClick={
          openDetail
            ? () => {
                // A completed long-press (pill shown) is a drag gesture, not
                // a tap — the click event right after pointerup must not
                // also open the detail sheet.
                if (longPressed.current) {
                  longPressed.current = false;
                  return;
                }
                openDetail();
              }
            : undefined
        }
        // Keyboard access: the whole card opens detail on click, so it must also
        // open on Enter/Space and be focusable (the bookmark button was the only
        // reachable control before).
        role={openDetail ? "button" : undefined}
        tabIndex={openDetail ? 0 : undefined}
        onKeyDown={
          openDetail
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openDetail();
                }
              }
            : undefined
        }
      >
        {/* Image — sized to its own resolution (Ref4 masonry), not forced into
          a uniform crop: the wrapper only holds a placeholder aspect ratio
          until the real image has loaded and reports its intrinsic size. */}
        <div
          style={{
            position: "relative",
            aspectRatio: loaded ? undefined : `${placeholderRatio(item.item_id)}`,
            overflow: "hidden",
            background: "var(--bg)",
          }}
        >
          {item.image_url ? (
            <>
              {!loaded && (
                <div className="skeleton" style={{ position: "absolute", inset: 0 }} aria-hidden />
              )}
              <motion.img
                src={mediaUrl(item.image_url, 400) ?? undefined}
                srcSet={mediaSrcSet(item.image_url, 400)}
                // 2-col grid ≈ half the viewport per tile; without this the browser
                // assumes 100vw and picks the 2x (800px) variant even on standard DPR.
                sizes="50vw"
                alt={item.title}
                loading={priority ? "eager" : "lazy"}
                fetchPriority={priority ? "high" : "auto"}
                decoding="async"
                whileHover={reduce ? undefined : { scale: 1.03 }}
                transition={{ duration: 0.5, ease: EASE }}
                style={{
                  display: "block",
                  width: "100%",
                  height: loaded ? "auto" : "100%",
                  objectFit: loaded ? undefined : "cover",
                  opacity: loaded ? 1 : 0,
                  transition: "opacity 0.35s ease",
                }}
                onLoad={() => setLoaded(true)}
              />
            </>
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                fontFamily: "var(--font-mono)",
                fontSize: "0.55rem",
                color: "var(--text-faint)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              No image
            </div>
          )}

          {/* Save button */}
          <button
            type="button"
            aria-label={saved ? "Remove from saved" : "Save item"}
            aria-pressed={saved}
            onClick={(e) => {
              e.stopPropagation();
              onSave(item);
            }}
            style={{
              position: "absolute",
              right: "0.5rem",
              top: "0.5rem",
              zIndex: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "36px",
              height: "36px",
              background: "rgba(255,255,255,0.92)",
              border: `1px solid ${saved ? "var(--secondary)" : "var(--border)"}`,
              color: saved ? "var(--secondary)" : "var(--text-faint)",
              cursor: "pointer",
              borderRadius: "999px",
              transition: "all 0.2s",
            }}
          >
            {saved ? <BookmarkCheck size={14} aria-hidden /> : <Bookmark size={14} aria-hidden />}
          </button>
        </div>

        {/* Meta */}
        <div style={{ padding: "0.75rem" }}>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "var(--text)",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              margin: 0,
            }}
          >
            {item.title}
          </p>
          {price && (
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "0.875rem",
                fontWeight: 700,
                color: "var(--secondary)",
                marginTop: "0.25rem",
              }}
            >
              {price}
            </p>
          )}
        </div>
      </motion.article>

      {/* Portal to <body>: motion.article sets an inline `transform` for its
          own animations, which makes it a CSS containing block — a
          position:fixed pill nested inside would anchor to the card instead
          of the viewport (same issue top-menu.tsx's sheet portal works
          around). Position is captured once at long-press time, not
          re-measured on every pointermove — the pill doesn't move once it's
          up, only `over` (hover state) does. */}
      {pill &&
        createPortal(
          <motion.div
            ref={(el) => {
              pillRect.current = el?.getBoundingClientRect() ?? null;
            }}
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: pill.over ? 1.15 : 1 }}
            transition={{ duration: 0.15, ease: EASE }}
            style={{
              position: "fixed",
              left: pill.x,
              top: pill.y,
              transform: "translate(-50%, -50%)",
              zIndex: 100,
              display: "flex",
              alignItems: "center",
              gap: "0.375rem",
              padding: "0.5rem 0.875rem",
              borderRadius: "999px",
              background: pill.over ? "var(--secondary)" : "var(--surface-high)",
              border: `1px solid ${pill.over ? "var(--secondary)" : "var(--border)"}`,
              color: pill.over ? "var(--surface)" : "var(--text)",
              fontFamily: "var(--font-body)",
              fontSize: "0.8125rem",
              fontWeight: 600,
              pointerEvents: "none",
              boxShadow: "0 4px 16px rgba(0,0,0,0.24)",
              whiteSpace: "nowrap",
            }}
          >
            {pill.over ? (
              <BookmarkCheck size={15} aria-hidden />
            ) : (
              <Bookmark size={15} aria-hidden />
            )}
            Save
          </motion.div>,
          document.body,
        )}
    </>
  );
}

// Memoized: one bookmark toggle re-renders only the toggled card, not the whole
// visible grid (requires a stable `onSave`/`onSelect` from the parent).
export const ExploreCard = memo(ExploreCardImpl);
