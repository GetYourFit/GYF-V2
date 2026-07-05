"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Trash2, Shirt, Scissors, Wind, Footprints, Watch, Layers } from "lucide-react";

import type { WardrobeItem } from "@gyf/types";
import { mediaSrcSet, mediaUrl } from "@/lib/media";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

interface GarmentCardProps {
  item: WardrobeItem;
  index?: number;
  onRemove: (id: string) => void;
}

const SLOT_ICONS: Record<string, React.ElementType> = {
  top: Shirt,
  bottom: Scissors,
  outerwear: Wind,
  footwear: Footprints,
  accessory: Watch,
  dress: Layers,
};

export function GarmentCard({ item, index = 0, onRemove }: GarmentCardProps) {
  const reduce = useReducedMotion();
  const src = mediaUrl(item.image_url, 400);
  const SlotIcon = SLOT_ICONS[item.slot] ?? Layers;

  return (
    <motion.article
      layout
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.32, delay: Math.min(index, 11) * 0.04, ease: EASE }}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        background: "#ffffff",
        border: "1px solid rgba(0,0,0,0.08)",
        borderRadius: "16px",
        overflow: "hidden",
        boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
      }}
    >
      {/* Image / placeholder */}
      <div
        style={{
          position: "relative",
          aspectRatio: "3/4",
          overflow: "hidden",
          background: "#faf8f5",
        }}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            srcSet={mediaSrcSet(item.image_url, 400)}
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
              color: "#444748",
            }}
          >
            <SlotIcon size={28} aria-hidden strokeWidth={1} />
          </div>
        )}

        {/* Remove button */}
        <button
          type="button"
          aria-label={`Remove ${item.title} from wardrobe`}
          onClick={() => onRemove(item.id)}
          style={{
            position: "absolute",
            right: "0.5rem",
            top: "0.5rem",
            width: "32px",
            height: "32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.7)",
            border: "1px solid rgba(0,0,0,0.10)",
            borderRadius: "16px",
            color: "var(--text-faint)",
            cursor: "pointer",
          }}
        >
          <Trash2 size={13} aria-hidden />
        </button>

        {/* Color swatch */}
        {item.color && (
          <div
            style={{
              position: "absolute",
              bottom: "0.5rem",
              left: "0.5rem",
              width: "14px",
              height: "14px",
              background: item.color,
              border: "1px solid rgba(0,0,0,0.2)",
            }}
            title={item.color}
            aria-hidden
          />
        )}
      </div>

      {/* Meta */}
      <div
        style={{
          padding: "0.625rem 0.75rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.25rem",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "0.8125rem",
            fontWeight: 500,
            color: "#1c1a17",
            margin: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {item.title}
        </p>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.5rem",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "0.75rem",
              color: "var(--text-faint)",
              textTransform: "capitalize",
            }}
          >
            {item.category}
          </span>
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "0.7rem",
              color: "var(--text-faint)",
              textTransform: "capitalize",
            }}
          >
            {item.slot}
          </span>
        </div>
      </div>
    </motion.article>
  );
}
