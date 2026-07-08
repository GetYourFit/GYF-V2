"use client";

import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
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
  const src = mediaUrl(item.image_url, 400);

  return (
    <motion.div
      whileHover={reduce ? undefined : { scale: 1.02, y: -2 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      style={{
        display: "flex",
        flexDirection: "column",
        background: "rgba(255,255,255,0.03)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "16px",
        overflow: "hidden",
      }}
    >
      <div
        style={{ position: "relative", aspectRatio: "3/4", background: "#1a1a22", overflow: "hidden" }}
      >
        {src ? (
          <Image
            src={src}
            alt={item.title}
            fill
            sizes="(max-width: 640px) 45vw, 220px"
            style={{ objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              ...MONO,
              color: "var(--text-mid)",
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
            color: "var(--text)",
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
        background: "rgba(255,255,255,0.03)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.08)",
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
            const s = mediaUrl(p.image_url, 400);
            return (
              <div
                key={p.item_id}
                style={{ position: "relative", overflow: "hidden", background: "#1a1a22" }}
              >
                {s ? (
                  <Image src={s} alt={p.title} fill sizes="50vw" style={{ objectFit: "cover" }} />
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
              color: "var(--text-mid)",
            }}
          >
            No items
          </div>
        )}
        {previews.length === 1 && <div style={{ background: "rgba(255,255,255,0.02)" }} />}
      </div>
      <div style={{ padding: "0.625rem" }}>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "0.6875rem",
            color: "var(--text)",
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
