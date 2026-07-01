"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Bookmark, BookmarkCheck } from "lucide-react";

import type { SearchResult } from "@gyf/types";

interface ExploreCardProps {
  item: SearchResult;
  index: number;
  saved: boolean;
  onSave: (item: SearchResult) => void;
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

export function ExploreCard({ item, index, saved, onSave }: ExploreCardProps) {
  const reduce = useReducedMotion();
  const price = formatPrice(item.price, item.currency);
  const external = Boolean(item.buy_url);
  const href = item.buy_url ?? `/items/${item.item_id}`;

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
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: "4px",
        overflow: "hidden",
        transition: "border-color 0.2s",
      }}
      whileHover={reduce ? undefined : { borderColor: "rgba(255,255,255,0.18)" }}
    >
      {/* Image */}
      <div
        style={{
          position: "relative",
          aspectRatio: "3/4",
          overflow: "hidden",
          background: "#111318",
        }}
      >
        {item.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <motion.img
            src={item.image_url}
            alt={item.title}
            loading="lazy"
            whileHover={reduce ? undefined : { scale: 1.03 }}
            transition={{ duration: 0.5, ease: EASE }}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              fontFamily: "var(--font-mono)",
              fontSize: "0.55rem",
              color: "#5a5a65",
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
          onClick={() => onSave(item)}
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
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            border: `1px solid ${saved ? "#f0bd8f" : "rgba(255,255,255,0.15)"}`,
            color: saved ? "#f0bd8f" : "#8e9192",
            cursor: "pointer",
            borderRadius: "2px",
            transition: "all 0.2s",
          }}
        >
          {saved
            ? <BookmarkCheck size={14} aria-hidden />
            : <Bookmark size={14} aria-hidden />
          }
        </button>
      </div>

      {/* Meta */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "0.5rem",
          padding: "0.75rem",
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          {/* Stretched link covers full card, save button (z-10) stays independently clickable */}
          <a
            href={href}
            target={external ? "_blank" : undefined}
            rel={external ? "noopener noreferrer" : undefined}
            aria-label={external ? `Shop ${item.title}` : `View ${item.title}`}
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "0.75rem",
              color: "#c4c7c8",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              textDecoration: "none",
            }}
          >
            <span
              style={{
                position: "absolute",
                inset: 0,
                zIndex: 1,
              }}
              aria-hidden
            />
            {item.title}
          </a>
          {price && (
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "0.65rem",
                color: "#f0bd8f",
                letterSpacing: "0.04em",
                marginTop: "0.375rem",
              }}
            >
              {price}
            </p>
          )}
        </div>
        <ArrowUpRight
          size={14}
          aria-hidden
          style={{ color: "#5a5a65", flexShrink: 0, marginTop: "2px" }}
        />
      </div>
    </motion.article>
  );
}
