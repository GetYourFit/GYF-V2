"use client";

import { motion, useReducedMotion } from "framer-motion";
import { mediaUrl } from "@/lib/media";
import type { SavedItem, SavedOutfit } from "@gyf/types";

const MONO: React.CSSProperties = {
  fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
  fontSize: "0.55rem",
  fontWeight: 500,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
};

interface SavedItemCardProps {
  item: SavedItem;
}

export function SavedItemCard({ item }: SavedItemCardProps) {
  const reduce = useReducedMotion();
  const src = mediaUrl(item.image_url);

  return (
    <motion.div
      whileHover={reduce ? undefined : { scale: 1.02, y: -2 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      style={{
        display: "flex",
        flexDirection: "column",
        background: "rgba(0,0,0,0.03)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid rgba(0,0,0,0.08)",
        borderRadius: "16px",
        overflow: "hidden",
      }}
    >
      <div style={{ aspectRatio: "3/4", background: "#1a1a22", overflow: "hidden" }}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={item.title}
            loading="lazy"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              ...MONO,
              color: "#5a5a65",
            }}
          >
            No image
          </div>
        )}
      </div>
      <div style={{ padding: "0.625rem" }}>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "0.6875rem",
            color: "#1c1a17",
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            margin: 0,
          }}
        >
          {item.title}
        </p>
      </div>
    </motion.div>
  );
}

interface OutfitCardProps {
  outfit: SavedOutfit;
}

export function OutfitCard({ outfit }: OutfitCardProps) {
  const reduce = useReducedMotion();
  const previews = outfit.items?.slice(0, 2) ?? [];

  return (
    <motion.div
      whileHover={reduce ? undefined : { scale: 1.02, y: -2 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      style={{
        display: "flex",
        flexDirection: "column",
        background: "rgba(0,0,0,0.03)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid rgba(0,0,0,0.08)",
        borderRadius: "16px",
        overflow: "hidden",
      }}
    >
      {/* 2-up preview grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1px",
          background: "#1a1a22",
          aspectRatio: "4/3",
        }}
      >
        {previews.length > 0 ? (
          previews.map((p) => {
            const s = mediaUrl(p.image_url);
            return (
              <div key={p.item_id} style={{ overflow: "hidden", background: "#1a1a22" }}>
                {s ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s}
                    alt={p.title}
                    loading="lazy"
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                ) : null}
              </div>
            );
          })
        ) : (
          <div
            style={{
              gridColumn: "span 2",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              ...MONO,
              color: "#5a5a65",
            }}
          >
            No items
          </div>
        )}
        {previews.length === 1 && <div style={{ background: "rgba(0,0,0,0.02)" }} />}
      </div>
      <div style={{ padding: "0.625rem" }}>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "0.6875rem",
            color: "#1c1a17",
            margin: 0,
          }}
        >
          {outfit.occasion ?? "Outfit"}
        </p>
        <p
          style={{ ...MONO, color: "var(--text-faint)", marginTop: "0.25rem", fontSize: "0.5rem" }}
        >
          {outfit.items?.length ?? 0} pieces
        </p>
      </div>
    </motion.div>
  );
}
