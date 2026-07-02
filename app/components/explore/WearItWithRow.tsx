"use client";

import { useEffect, useState } from "react";
import { browserApi } from "@/lib/api-client";
import { mediaUrl } from "@/lib/media";
import type { SearchResult } from "@gyf/types";

interface Props { itemId: string; }

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
      <div style={{ aspectRatio: "3/4", background: "rgba(0,0,0,0.04)", borderRadius: "12px" }} />
      <div style={{ height: "8px", width: "70%", background: "rgba(0,0,0,0.04)", borderRadius: "999px" }} />
    </div>
  );
}

function Tile({ item }: { item: SearchResult }) {
  const src = mediaUrl(item.image_url);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", flex: 1 }}>
      <div style={{
        aspectRatio: "3/4",
        background: "#1a1a22",
        borderRadius: "12px",
        overflow: "hidden",
        border: "1px solid rgba(0,0,0,0.08)",
      }}>
        {src
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={src} alt={item.title} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", ...MONO, fontSize: "0.5rem", color: "#5a5a65" }}>No image</div>
        }
      </div>
      <p style={{ fontFamily: "var(--font-body)", fontSize: "0.6875rem", color: "#9a9490", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", margin: 0 }}>
        {item.title}
      </p>
    </div>
  );
}

export function WearItWithRow({ itemId }: Props) {
  const [pairings, setPairings] = useState<SearchResult[] | null>(null);

  useEffect(() => {
    let active = true;
    browserApi().similar(itemId, { k: 2 })
      .then((r) => { if (active) setPairings(r.slice(0, 2)); })
      .catch(() => { if (active) setPairings([]); });
    return () => { active = false; };
  }, [itemId]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span style={{ display: "block", width: "16px", height: "1px", background: "#b87a30" }} />
        <span style={{ ...MONO, color: "#b87a30" }}>Wear it with</span>
      </div>
      <div style={{ display: "flex", gap: "0.75rem" }}>
        {pairings === null ? (<><Skeleton /><Skeleton /></>) :
         pairings.length === 0 ? <p style={{ ...MONO, color: "#5a5a65", fontSize: "0.55rem" }}>No pairings available</p> :
         pairings.map((item) => <Tile key={item.item_id} item={item} />)}
      </div>
    </div>
  );
}
