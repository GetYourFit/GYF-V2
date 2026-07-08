"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { browserApi } from "@/lib/api-client";
import { mediaUrl } from "@/lib/media";
import type { SearchResult } from "@gyf/types";

/*
 * Canvas Explorer — Cosmos-style infinite cluster view (Ref1/Ref2).
 *
 * The whole catalog slice is laid out as one irregular masonry cluster on a
 * free 2D plane. The user pans in every direction (drag / swipe with
 * momentum). Tapping a tile re-clusters the canvas around that item: similar
 * items are fetched and arranged around the selected tile, which sits
 * enlarged at the center.
 */

const CELL = 44; // layout grid unit, px
const GAP = 10; // visual gap between tiles, px

interface Tile {
  item: SearchResult;
  x: number; // px, relative to cluster origin (center)
  y: number;
  w: number;
  h: number;
  selected: boolean;
}

/** Deterministic per-item pseudo-random in [0,1) from its id. */
function hash01(id: string, salt = 0): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

/**
 * Place tiles on an occupancy grid along an expanding spiral from the
 * center — the organic "cluster" arrangement of Ref1/Ref2. Tile spans vary
 * per item (2–4 columns wide, portrait-leaning heights).
 */
function layoutCluster(items: SearchResult[], selectedId: string | null): Tile[] {
  const occupied = new Set<string>();
  const tiles: Tile[] = [];

  const fits = (cx: number, cy: number, cw: number, ch: number) => {
    for (let ix = 0; ix < cw; ix++)
      for (let iy = 0; iy < ch; iy++) if (occupied.has(`${cx + ix},${cy + iy}`)) return false;
    return true;
  };
  const claim = (cx: number, cy: number, cw: number, ch: number) => {
    for (let ix = 0; ix < cw; ix++)
      for (let iy = 0; iy < ch; iy++) occupied.add(`${cx + ix},${cy + iy}`);
  };

  // Spiral of candidate anchor cells around the origin.
  const spiral: Array<[number, number]> = [[0, 0]];
  for (let r = 1; r < 46; r++) {
    for (let ix = -r; ix <= r; ix++) spiral.push([ix, -r], [ix, r]);
    for (let iy = -r + 1; iy <= r - 1; iy++) spiral.push([-r, iy], [r, iy]);
  }

  for (const item of items) {
    const selected = item.item_id === selectedId;
    // Spans in grid cells: selected tile is the big centerpiece.
    const cw = selected ? 6 : 3 + Math.floor(hash01(item.item_id) * 3); // 3–5
    const ch = selected
      ? 8
      : Math.round(cw * (1.15 + hash01(item.item_id, 7) * 0.35)); // portrait-ish
    let placed = false;
    for (const [sx, sy] of spiral) {
      // Center the span on the candidate cell.
      const cx = sx - Math.floor(cw / 2);
      const cy = sy - Math.floor(ch / 2);
      if (fits(cx, cy, cw, ch)) {
        claim(cx, cy, cw, ch);
        tiles.push({
          item,
          selected,
          x: cx * CELL,
          y: cy * CELL,
          w: cw * CELL - GAP,
          h: ch * CELL - GAP,
        });
        placed = true;
        break;
      }
    }
    if (!placed) break; // spiral exhausted — enough tiles on screen anyway
  }
  return tiles;
}

const BROWSE_SLOTS = ["top", "bottom", "full_body", "footwear"] as const;

function interleave<T>(lists: T[][]): T[] {
  const out: T[] = [];
  const longest = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < longest; i++)
    for (const list of lists) if (i < list.length) out.push(list[i]);
  return out;
}

export function CanvasExplorer() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [items, setItems] = useState<SearchResult[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generation, setGeneration] = useState(0); // keys re-cluster animations

  // Pan state lives in refs; the transform is written imperatively so panning
  // never re-renders React (60fps requirement).
  const planeRef = useRef<HTMLDivElement>(null);
  const pan = useRef({ x: 0, y: 0 });
  const pointer = useRef<{
    id: number;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    lastT: number;
    vx: number;
    vy: number;
    moved: boolean;
  } | null>(null);
  const momentum = useRef(0);

  const applyPan = useCallback(() => {
    const el = planeRef.current;
    if (el)
      el.style.transform = `translate3d(calc(50vw + ${pan.current.x}px), calc(50dvh + ${pan.current.y}px), 0)`;
  }, []);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const api = browserApi();
      let gender: string | undefined;
      try {
        const p = await api.getProfile();
        gender = p.gender && p.gender !== "unknown" ? p.gender : undefined;
      } catch {
        /* anonymous browse is fine */
      }
      const pages = await Promise.all(
        BROWSE_SLOTS.map((slot) =>
          api.search("fashion", { k: 16, slot, ...(gender ? { gender } : {}) }),
        ),
      );
      setItems(interleave(pages));
      setSelectedId(null);
      setGeneration((g) => g + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the canvas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  // Tap a tile → cluster similar items around it.
  const selectItem = useCallback(async (item: SearchResult) => {
    setSelectedId(item.item_id);
    setLoading(true);
    setError(null);
    pan.current = { x: 0, y: 0 }; // recenter on the selection
    try {
      const similar = await browserApi().search(item.title, { k: 48 });
      setItems([item, ...similar.filter((s) => s.item_id !== item.item_id)]);
      setGeneration((g) => g + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load similar items.");
    } finally {
      setLoading(false);
    }
  }, []);

  const tiles = useMemo(() => layoutCluster(items, selectedId), [items, selectedId]);

  // Content bounds clamp the pan so the cluster can never be lost off-screen.
  const bounds = useMemo(() => {
    if (tiles.length === 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    const pad = 120;
    return {
      minX: Math.min(...tiles.map((t) => t.x)) - pad,
      maxX: Math.max(...tiles.map((t) => t.x + t.w)) + pad,
      minY: Math.min(...tiles.map((t) => t.y)) - pad,
      maxY: Math.max(...tiles.map((t) => t.y + t.h)) + pad,
    };
  }, [tiles]);

  const clampPan = useCallback(() => {
    // Keep the viewport center inside the cluster bounding box.
    pan.current.x = Math.min(-bounds.minX, Math.max(-bounds.maxX, pan.current.x));
    pan.current.y = Math.min(-bounds.minY, Math.max(-bounds.maxY, pan.current.y));
  }, [bounds]);

  useEffect(() => {
    applyPan(); // recenter after re-cluster
  });

  const stopMomentum = useCallback(() => cancelAnimationFrame(momentum.current), []);

  const startMomentum = useCallback(
    (vx: number, vy: number) => {
      if (reduce) return;
      let cvx = vx;
      let cvy = vy;
      const step = () => {
        cvx *= 0.94;
        cvy *= 0.94;
        if (Math.abs(cvx) < 0.02 && Math.abs(cvy) < 0.02) return;
        pan.current.x += cvx * 16;
        pan.current.y += cvy * 16;
        clampPan();
        applyPan();
        momentum.current = requestAnimationFrame(step);
      };
      momentum.current = requestAnimationFrame(step);
    },
    [applyPan, clampPan, reduce],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      stopMomentum();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      pointer.current = {
        id: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
        lastT: performance.now(),
        vx: 0,
        vy: 0,
        moved: false,
      };
    },
    [stopMomentum],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const p = pointer.current;
      if (!p || p.id !== e.pointerId) return;
      const dx = e.clientX - p.lastX;
      const dy = e.clientY - p.lastY;
      const now = performance.now();
      const dt = Math.max(1, now - p.lastT);
      p.vx = dx / dt;
      p.vy = dy / dt;
      p.lastX = e.clientX;
      p.lastY = e.clientY;
      p.lastT = now;
      if (Math.abs(e.clientX - p.startX) + Math.abs(e.clientY - p.startY) > 8) p.moved = true;
      pan.current.x += dx;
      pan.current.y += dy;
      clampPan();
      applyPan();
    },
    [applyPan, clampPan],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const p = pointer.current;
      if (!p || p.id !== e.pointerId) return;
      pointer.current = null;
      if (p.moved) startMomentum(p.vx, p.vy);
    },
    [startMomentum],
  );

  const wasDrag = () => pointer.current?.moved ?? false;

  return (
    <div
      role="region"
      aria-label="Canvas explorer — drag to pan, tap an item to see similar pieces"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 45,
        background: "var(--bg)",
        overflow: "hidden",
        touchAction: "none",
        cursor: "grab",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* The plane — everything on it pans together */}
      <div
        ref={planeRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 0,
          height: 0,
          transform: "translate3d(50vw, 50dvh, 0)",
          willChange: "transform",
        }}
      >
        {tiles.map((t, i) => (
          <motion.button
            key={`${generation}:${t.item.item_id}`}
            type="button"
            aria-label={t.item.title}
            initial={
              reduce ? { opacity: 0 } : { opacity: 0, scale: 0.92 }
            }
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              duration: 0.35,
              delay: Math.min(i * 0.018, 0.5),
              ease: [0.22, 1, 0.36, 1],
            }}
            onClick={() => {
              if (!wasDrag() && !t.selected) void selectItem(t.item);
            }}
            style={{
              position: "absolute",
              left: t.x,
              top: t.y,
              width: t.w,
              height: t.h,
              padding: 0,
              border: t.selected ? "1.5px solid var(--border-hi)" : "none",
              borderRadius: 10,
              overflow: "hidden",
              background: "var(--surface)",
              cursor: "pointer",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {t.item.image_url && (
              <img
                src={mediaUrl(t.item.image_url, t.selected ? 800 : 400) ?? undefined}
                alt=""
                loading="lazy"
                draggable={false}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                  pointerEvents: "none",
                }}
              />
            )}
          </motion.button>
        ))}
      </div>

      {/* Back — floating circle, Ref1/Ref2 top-left */}
      <button
        type="button"
        aria-label="Back"
        onClick={() => (selectedId ? void loadInitial() : router.back())}
        style={{
          position: "fixed",
          top: "calc(1rem + env(safe-area-inset-top))",
          left: "1rem",
          width: 48,
          height: 48,
          borderRadius: "50%",
          border: "none",
          background: "var(--surface-high)",
          color: "var(--text)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          zIndex: 46,
        }}
      >
        <ArrowLeft size={20} aria-hidden />
      </button>

      {/* Loading pulse */}
      {loading && (
        <div
          aria-busy
          style={{
            position: "fixed",
            bottom: "calc(2rem + env(safe-area-inset-bottom))",
            left: "50%",
            transform: "translateX(-50%)",
            padding: "0.5rem 1.25rem",
            borderRadius: 999,
            background: "var(--surface-2)",
            color: "var(--text-mid)",
            fontFamily: "var(--font-mono)",
            fontSize: "0.6rem",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            zIndex: 46,
          }}
        >
          Loading
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div
          role="alert"
          style={{
            position: "fixed",
            bottom: "calc(2rem + env(safe-area-inset-bottom))",
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            padding: "0.625rem 1rem",
            borderRadius: 999,
            background: "var(--surface-2)",
            color: "var(--text)",
            fontSize: "0.8125rem",
            zIndex: 46,
            whiteSpace: "nowrap",
          }}
        >
          {error}
          <button
            type="button"
            onClick={() => (selectedId ? setError(null) : void loadInitial())}
            aria-label="Retry"
            style={{
              display: "flex",
              background: "none",
              border: "none",
              color: "var(--text)",
              cursor: "pointer",
              padding: 4,
            }}
          >
            <RefreshCw size={14} aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
