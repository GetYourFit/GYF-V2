"use client";

import { memo, useState } from "react";
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

function ExploreCardImpl({ item, index, saved, priority, onSave, onSelect }: ExploreCardProps) {
  const reduce = useReducedMotion();
  const [loaded, setLoaded] = useState(false);
  const price = formatPrice(item.price, item.currency);
  const openDetail = onSelect ? () => onSelect(item) : undefined;

  return (
    <motion.article
      layout
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
      }}
      onClick={openDetail}
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
  );
}

// Memoized: one bookmark toggle re-renders only the toggled card, not the whole
// visible grid (requires a stable `onSave`/`onSelect` from the parent).
export const ExploreCard = memo(ExploreCardImpl);
