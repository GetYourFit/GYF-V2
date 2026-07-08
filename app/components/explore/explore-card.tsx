"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Bookmark, BookmarkCheck } from "lucide-react";

import type { SearchResult } from "@gyf/types";
import { mediaSrcSet, mediaUrl } from "@/lib/media";

interface ExploreCardProps {
  item: SearchResult;
  index: number;
  saved: boolean;
  onSave: (item: SearchResult) => void;
  onSelect?: (item: SearchResult) => void;
}

function formatPrice(price?: number | null, currency?: string | null): string | null {
  if (price == null) return null;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency ?? "USD",
      maximumFractionDigits: 0,
    }).format(price);
  } catch {
    return `${currency ?? "$"}${Math.round(price)}`;
  }
}

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export function ExploreCard({ item, index, saved, onSave, onSelect }: ExploreCardProps) {
  const reduce = useReducedMotion();
  const price = formatPrice(item.price, item.currency);

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
        borderRadius: "16px",
        overflow: "hidden",
        cursor: onSelect ? "pointer" : "default",
        boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
      }}
      onClick={onSelect ? () => onSelect(item) : undefined}
    >
      {/* Image */}
      <div
        style={{
          position: "relative",
          aspectRatio: "3/4",
          overflow: "hidden",
          background: "var(--bg)",
        }}
      >
        {item.image_url ? (
          <>
            <div className="skeleton" style={{ position: "absolute", inset: 0 }} aria-hidden />
            <motion.img
              src={mediaUrl(item.image_url, 400) ?? undefined}
              srcSet={mediaSrcSet(item.image_url, 400)}
              alt={item.title}
              loading="lazy"
              whileHover={reduce ? undefined : { scale: 1.03 }}
              transition={{ duration: 0.5, ease: EASE }}
              style={{
                position: "relative",
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
                opacity: 0,
                transition: "opacity 0.35s ease",
              }}
              onLoad={(e) => {
                e.currentTarget.style.opacity = "1";
              }}
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
