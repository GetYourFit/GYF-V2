"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { browserApi } from "@/lib/api-client";
import { formatPrice } from "@/lib/format";
import { mediaUrl } from "@/lib/media";
import { safeExternalShopUrl, SHOP_AFFILIATE_DISCLOSURE } from "@/lib/shop-links";
import type { Outfit, OutfitItem } from "@gyf/types";

interface Props {
  itemId: string;
}

const MONO: React.CSSProperties = {
  fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
  fontSize: "0.6rem",
  fontWeight: 500,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
};

function Skeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", flex: 1 }}>
      <div style={{ aspectRatio: "3/4", background: "var(--rule)", borderRadius: "12px" }} />
      <div
        style={{
          height: "8px",
          width: "70%",
          background: "var(--rule)",
          borderRadius: "999px",
        }}
      />
    </div>
  );
}

function Tile({ item }: { item: OutfitItem }) {
  const src = mediaUrl(item.image_url, 400);
  const price = formatPrice(item.price, item.currency);
  const shopUrl = safeExternalShopUrl(item.affiliate_url);
  const open = () => {
    if (shopUrl) window.open(shopUrl, "_blank", "noopener,noreferrer");
  };
  return (
    <button
      type="button"
      onClick={open}
      aria-label={shopUrl ? `Shop ${item.title}` : item.title}
      disabled={!shopUrl}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.375rem",
        flex: 1,
        minWidth: 0,
        background: "none",
        border: "none",
        padding: 0,
        textAlign: "left",
        cursor: shopUrl ? "pointer" : "default",
      }}
    >
      <div
        style={{
          position: "relative",
          aspectRatio: "3/4",
          width: "100%",
          background: "var(--surface-2)",
          borderRadius: "12px",
          overflow: "hidden",
          border: "1px solid var(--rule)",
        }}
      >
        {src ? (
          <Image
            src={src}
            alt={item.title}
            fill
            sizes="(max-width: 640px) 40vw, 180px"
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
              fontSize: "0.5rem",
              color: "var(--text-mid)",
            }}
          >
            No image
          </div>
        )}
      </div>
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "0.6875rem",
          color: "var(--text-faint)",
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          margin: 0,
        }}
      >
        {item.slot.replace("_", " ")}
        {price ? ` · ${price}` : ""} — {item.title}
      </p>
    </button>
  );
}

/** "Complete the look": the stylist engine composes full outfits (top + bottom +
 *  footwear) pinned to this item — the same personalization, explanation, and
 *  confidence as the feed, not a similar-items lookup. */
export function WearItWithRow({ itemId }: Props) {
  const [look, setLook] = useState<Outfit | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    browserApi()
      .completeLook(itemId, { k: 1 })
      .then((r) => {
        if (active) setLook(r.outfits[0] ?? null);
      })
      .catch(() => {
        if (active) setLook(null);
      });
    return () => {
      active = false;
    };
  }, [itemId]);

  const pairings = look?.items.filter((it) => it.item_id !== itemId) ?? [];
  const hasShopUrl = pairings.some((item) => safeExternalShopUrl(item.affiliate_url));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span
          style={{ display: "block", width: "16px", height: "1px", background: "var(--secondary)" }}
        />
        <span style={{ ...MONO, color: "var(--secondary)" }}>Complete the look</span>
        {look && (
          <span style={{ ...MONO, color: "var(--text-faint)", marginLeft: "auto" }}>
            {Math.round(look.confidence * 100)}% match
          </span>
        )}
      </div>
      {look === undefined ? (
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <Skeleton />
          <Skeleton />
        </div>
      ) : look === null || pairings.length === 0 ? (
        <p style={{ ...MONO, color: "var(--text-mid)", fontSize: "0.55rem" }}>
          No complete look available for this piece yet
        </p>
      ) : (
        <>
          {hasShopUrl ? (
            <p style={{ ...MONO, color: "var(--text-faint)", fontSize: "0.55rem" }}>
              {SHOP_AFFILIATE_DISCLOSURE}
            </p>
          ) : null}
          <div style={{ display: "flex", gap: "0.75rem" }}>
            {pairings.map((item) => (
              <Tile key={item.item_id} item={item} />
            ))}
          </div>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "0.75rem",
              lineHeight: 1.5,
              color: "var(--text-faint)",
              margin: 0,
            }}
          >
            {look.explanation}
          </p>
        </>
      )}
    </div>
  );
}
