"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Plus, Minus, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { browserApi } from "@/lib/api-client";
import { colorNameToCss } from "@/lib/color-name";
import { mediaSrcSet, mediaUrl } from "@/lib/media";
import { BottomNav } from "@/components/layout/bottom-nav";
import { ItemDetailSheet } from "@/components/explore/ItemDetailSheet";
import type { SearchResult } from "@gyf/types";

// Zoom bounds and step sizes (button click / wheel notch).
const MIN_SCALE = 0.5;
const MAX_SCALE = 2.5;
const WHEEL_ZOOM_SPEED = 0.0015;
const BUTTON_ZOOM_STEP = 0.2;
const PINCH_ZOOM_SPEED = 1; // multiplier on the raw distance ratio

// Infinite browse: fetch another page once the pan gets this close to the
// current cluster's edge, so new tiles arrive before the user hits a wall.
const LOAD_MORE_MARGIN = 1200;
const PAGE_SIZE = 48;

// How many skeleton tiles sit past the loaded edge while the next page
// streams in — a bigger buffer means panning has to go further before it can
// ever see a hard, unfilled boundary, which is what actually reads as
// "infinite" rather than "a grid that ends."
const EXTRA_SKELETON_COUNT = 24;

// A single click is deferred this long so a following second click can
// cancel it and fire the double-click action instead.
const CLICK_ARBITRATION_MS = 260;

// How long the canvas must sit still before the bottom nav floats back in.
const NAV_IDLE_MS = 350;

// The gendered-search personalization needs the profile fetch, but it's a
// full network round trip that shouldn't gate the first paint — cap the
// wait and fall back to an ungendered browse if it's slow. The result is
// memoized module-wide so returning to Canvas later in the same session
// (e.g. via the back button) never re-pays this round trip at all.
const PROFILE_WAIT_MS = 500;
let genderPromise: Promise<string | undefined> | null = null;
function getGender(api: ReturnType<typeof browserApi>): Promise<string | undefined> {
  if (!genderPromise) {
    genderPromise = api
      .getProfile()
      .then((p) => (p.gender && p.gender !== "unknown" ? p.gender : undefined))
      .catch(() => undefined);
  }
  return genderPromise;
}

/*
 * Canvas Explorer — Cosmos-style infinite cluster view (Ref2).
 *
 * The whole catalog slice is laid out as one tightly-packed masonry cluster
 * on a free 2D plane. The user pans (drag / swipe with momentum) and zooms
 * (wheel, pinch, or the +/- buttons). In the default browse (no item
 * selected) panning near the edge streams in another page — with skeleton
 * placeholders already occupying the space just beyond the loaded edge —
 * so the cluster reads as infinite rather than a fixed bounded grid.
 *
 * Click behavior:
 *  - Single click/tap a tile → reclusters the canvas around that item
 *    (loads visually similar pieces) and tints the background to its color.
 *  - Double click/tap the same tile → zooms it to the centerpiece position
 *    and drops down its info sheet (view / buy / save).
 *  - Drag → pans the canvas; never triggers either click action.
 */

const CELL = 44; // layout grid unit, px
const GAP = 3; // visual gap between tiles — tight, Ref2-style packing

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

/** A placeholder "item" purely for skeleton layout — never rendered as a
 *  real tile, never clickable, carries no catalog data. */
function skeletonItem(id: string): SearchResult {
  return { item_id: id, title: "", score: 0 } as SearchResult;
}

interface ClusterLayout {
  tiles: Tile[];
  occupied: Set<string>;
  minCx: number;
  maxCx: number;
  minCy: number;
  maxCy: number;
}

/**
 * Place tiles on an occupancy grid along an expanding spiral from the
 * center — the organic "cluster" arrangement of Ref2. Tile spans vary per
 * item (2–4 columns wide, portrait-leaning heights). Pure function of
 * array order: appending new items to the end never reshuffles tiles
 * already placed for earlier items, which is what lets loadMore() grow the
 * cluster outward without the existing layout jumping.
 *
 * Also returns the occupancy set and its cell bounds — the spiral-anchor
 * placement is greedy, not an exhaustive bin-pack, so it can leave small
 * holes between irregularly-sized tiles even inside a fully "loaded"
 * region. The caller (fillerRects) uses these to paper over exactly those
 * holes so the grid never shows raw background within its own bounds.
 */
function layoutCluster(items: SearchResult[], selectedId: string | null): ClusterLayout {
  const occupied = new Set<string>();
  const tiles: Tile[] = [];
  let minCx = 0;
  let maxCx = 0;
  let minCy = 0;
  let maxCy = 0;

  const fits = (cx: number, cy: number, cw: number, ch: number) => {
    for (let ix = 0; ix < cw; ix++)
      for (let iy = 0; iy < ch; iy++) if (occupied.has(`${cx + ix},${cy + iy}`)) return false;
    return true;
  };
  const claim = (cx: number, cy: number, cw: number, ch: number) => {
    for (let ix = 0; ix < cw; ix++)
      for (let iy = 0; iy < ch; iy++) occupied.add(`${cx + ix},${cy + iy}`);
    minCx = Math.min(minCx, cx);
    maxCx = Math.max(maxCx, cx + cw - 1);
    minCy = Math.min(minCy, cy);
    maxCy = Math.max(maxCy, cy + ch - 1);
  };

  // Spiral of candidate anchor cells around the origin. Radius scales with
  // item count so a growing (infinite-load) cluster always has room.
  const maxRadius = Math.max(46, Math.ceil(Math.sqrt(items.length) * 6));
  const spiral: Array<[number, number]> = [[0, 0]];
  for (let r = 1; r < maxRadius; r++) {
    for (let ix = -r; ix <= r; ix++) spiral.push([ix, -r], [ix, r]);
    for (let iy = -r + 1; iy <= r - 1; iy++) spiral.push([-r, iy], [r, iy]);
  }

  for (const item of items) {
    const selected = item.item_id === selectedId;
    // Spans in grid cells: selected tile is the big centerpiece.
    const cw = selected ? 6 : 3 + Math.floor(hash01(item.item_id) * 3); // 3–5
    const ch = selected ? 8 : Math.round(cw * (1.15 + hash01(item.item_id, 7) * 0.35)); // portrait-ish
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
  return { tiles, occupied, minCx, maxCx, minCy, maxCy };
}

/** A filler block: same box shape as a Tile, no item behind it. */
interface FillerRect {
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Every occupancy-grid cell inside the cluster's own bounds that no tile
 * claimed — the packer's leftover holes — merged into per-row runs (one
 * filler box per contiguous empty stretch) so a sparse cluster doesn't cost
 * one DOM node per empty cell. Rendered as inert textured blocks so the grid
 * reads as fully tiled (Ref2) instead of showing the raw canvas background
 * through the gaps.
 */
function fillerRects(layout: ClusterLayout): FillerRect[] {
  const { occupied, minCx, maxCx, minCy, maxCy } = layout;
  if (minCx > maxCx || minCy > maxCy) return [];
  const rects: FillerRect[] = [];
  for (let cy = minCy; cy <= maxCy; cy++) {
    let runStart: number | null = null;
    for (let cx = minCx; cx <= maxCx + 1; cx++) {
      const empty = cx <= maxCx && !occupied.has(`${cx},${cy}`);
      if (empty && runStart === null) runStart = cx;
      if (!empty && runStart !== null) {
        rects.push({
          key: `${runStart},${cy}`,
          x: runStart * CELL,
          y: cy * CELL,
          w: (cx - runStart) * CELL - GAP,
          h: CELL - GAP,
        });
        runStart = null;
      }
    }
  }
  return rects;
}

/** A tile's image, faded in on load rather than popping in the instant the
 *  browser decodes it — reads as smoother even though load time is the same.
 *  `eager` (first screenful) skips lazy-loading and gets loading priority so
 *  the initial grid paints tiles instead of sitting on placeholders. */
function TileImage({ src, srcSet, eager }: { src: string; srcSet?: string; eager: boolean }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <img
      src={src}
      srcSet={srcSet}
      sizes={srcSet ? "(min-width: 0px) 50vw" : undefined}
      alt=""
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : "auto"}
      decoding="async"
      draggable={false}
      onLoad={() => setLoaded(true)}
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
        display: "block",
        pointerEvents: "none",
        opacity: loaded ? 1 : 0,
        transition: "opacity 0.25s ease",
      }}
    />
  );
}

/** Pulsing placeholder tile — same shape/positioning as a real tile, no
 *  image, no click handlers. Blurred rather than a flat block so the loaded
 *  edge of the cluster reads as an out-of-focus continuation of more content
 *  (the "infinite grid" feel) instead of a visible boundary. */
function SkeletonTile({ tile, index }: { tile: Tile; index: number }) {
  return (
    <motion.div
      aria-hidden
      animate={{ opacity: [0.25, 0.5, 0.25] }}
      transition={{ duration: 1.3, delay: index * 0.03, repeat: Infinity, repeatType: "reverse" }}
      style={{
        position: "absolute",
        left: tile.x,
        top: tile.y,
        width: tile.w,
        height: tile.h,
        background:
          "linear-gradient(135deg, var(--surface-2) 0%, var(--rule) 50%, var(--surface-2) 100%)",
        filter: "blur(10px)",
      }}
    />
  );
}

/** Static (non-pulsing) textured block filling a packing hole inside the
 *  cluster's own bounds — distinct from SkeletonTile (which signals "more is
 *  loading") since a filler is permanent, not a loading state. */
function FillerBlock({ rect }: { rect: FillerRect }) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        background: "var(--surface-2)",
        opacity: 0.5,
      }}
    />
  );
}

const BROWSE_SLOTS = ["top", "bottom", "full_body", "footwear"] as const;

export function CanvasExplorer() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [items, setItems] = useState<SearchResult[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generation, setGeneration] = useState(0); // keys re-cluster animations
  const [bgColor, setBgColor] = useState<string | null>(null);
  const [detailItem, setDetailItem] = useState<SearchResult | null>(null);
  const [navCollapsed, setNavCollapsed] = useState(false);

  // Infinite browse (default view only — a recluster around a selection is
  // a fixed similar-items set, not paginated).
  const genderRef = useRef<string | undefined>(undefined);
  const offsetRef = useRef(0);
  const hasMoreRef = useRef(true);
  const loadingMoreRef = useRef(false);

  // Single vs. double click arbitration, per the current pointer sequence.
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Bottom nav auto-hide: collapse the instant panning starts, bring it
  // back once the canvas has been still for NAV_IDLE_MS.
  const navIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notifyActivity = useCallback(() => {
    setNavCollapsed(true);
    if (navIdleTimerRef.current) clearTimeout(navIdleTimerRef.current);
    navIdleTimerRef.current = setTimeout(() => setNavCollapsed(false), NAV_IDLE_MS);
  }, []);

  // Pan + zoom state live in refs; the transform is written imperatively so
  // panning/zooming never re-renders React (60fps requirement).
  const planeRef = useRef<HTMLDivElement>(null);
  const pan = useRef({ x: 0, y: 0 });
  const scaleRef = useRef(1);
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

  // Active pointers (for pinch-to-zoom), keyed by pointerId.
  const activePointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ startDist: number; startScale: number } | null>(null);

  const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

  const applyPan = useCallback(() => {
    const el = planeRef.current;
    if (el)
      el.style.transform =
        `translate3d(calc(50vw + ${pan.current.x}px), calc(50dvh + ${pan.current.y}px), 0) ` +
        `scale(${scaleRef.current})`;
  }, []);

  // Rescale while keeping the plane point under `anchor` (a screen-space
  // point, e.g. the pinch midpoint or cursor) visually fixed — otherwise
  // zooming yanks the content away from wherever the user's fingers/cursor
  // actually are, which is what reads as "jerky" pinch-zoom.
  const zoomAt = useCallback((anchorX: number, anchorY: number, nextScale: number) => {
    const clamped = clampScale(nextScale);
    const prevScale = scaleRef.current;
    if (clamped === prevScale) return;
    const dx = anchorX - window.innerWidth / 2;
    const dy = anchorY - window.innerHeight / 2;
    const ratio = clamped / prevScale;
    pan.current.x = dx * (1 - ratio) + pan.current.x * ratio;
    pan.current.y = dy * (1 - ratio) + pan.current.y * ratio;
    scaleRef.current = clamped;
  }, []);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError(null);
    setBgColor(null);
    setDetailItem(null);
    try {
      const api = browserApi();
      // Race the (possibly cached) profile lookup against a short timeout so
      // a slow /profile call never delays the first tiles painting.
      const gender = await Promise.race([
        getGender(api),
        new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), PROFILE_WAIT_MS)),
      ]);
      genderRef.current = gender;
      // One embed, one round trip: the server interleaves all slots itself
      // (was N separate searches, each re-embedding the same query text).
      const results = await api.search("fashion", {
        k: 96,
        slots: BROWSE_SLOTS.join(","),
        ...(gender ? { gender } : {}),
      });
      setItems(results);
      setSelectedId(null);
      setGeneration((g) => g + 1);
      offsetRef.current = results.length;
      hasMoreRef.current = results.length === 96;
      pan.current = { x: 0, y: 0 };
      scaleRef.current = 1;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the canvas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Fetch-on-mount: loadInitial's setLoading(true) runs synchronously before
    // its first await, which the lint rule sees as a direct effect setState.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadInitial();
  }, [loadInitial]);

  // Stream in another page as the user pans toward the edge of the loaded
  // cluster — only in the default browse, never mid-recluster. Skeleton
  // tiles already occupy the space just beyond the edge (see
  // skeletonExtraTiles below), so this never reads as a hard wall.
  const loadMore = useCallback(async () => {
    if (selectedId !== null) return;
    if (loadingMoreRef.current || !hasMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const api = browserApi();
      const results = await api.search("fashion", {
        k: PAGE_SIZE,
        offset: offsetRef.current,
        slots: BROWSE_SLOTS.join(","),
        ...(genderRef.current ? { gender: genderRef.current } : {}),
      });
      offsetRef.current += PAGE_SIZE;
      hasMoreRef.current = results.length === PAGE_SIZE;
      if (results.length > 0) {
        setItems((prev) => {
          const known = new Set(prev.map((it) => it.item_id));
          const fresh = results.filter((it) => !known.has(it.item_id));
          return fresh.length ? [...prev, ...fresh] : prev;
        });
      }
    } catch {
      // Silent: infinite-scroll fetches are best-effort, not a user action.
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [selectedId]);

  // Single click → cluster similar items around it, tint the background.
  const selectItem = useCallback(async (item: SearchResult) => {
    setSelectedId(item.item_id);
    setBgColor(colorNameToCss(item.color));
    setLoading(true);
    setError(null);
    pan.current = { x: 0, y: 0 }; // recenter on the selection
    try {
      // 24, not 48: half the payload and half the tiles to lay out/paint —
      // a recluster should feel instant, and 24 similar pieces is already
      // plenty to fill the screen.
      const similar = await browserApi().search(item.title, { k: 24 });
      setItems([item, ...similar.filter((s) => s.item_id !== item.item_id)]);
      setGeneration((g) => g + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load similar items.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Double click → zoom the tile to centerpiece size in place (no
  // network — it's already in `items`) and drop down its info sheet.
  const openDetail = useCallback((item: SearchResult) => {
    setSelectedId(item.item_id);
    setBgColor(colorNameToCss(item.color));
    setDetailItem(item);
  }, []);

  const closeDetail = useCallback(() => {
    setDetailItem(null);
    setSelectedId(null);
    setBgColor(null);
  }, []);

  const cluster = useMemo(() => layoutCluster(items, selectedId), [items, selectedId]);
  const tiles = cluster.tiles;
  // Packing holes inside the cluster's own bounds — rendered as inert
  // textured blocks so the grid reads as fully tiled (Ref2), never showing
  // raw canvas background between irregularly-sized tiles.
  const fillerTiles = useMemo(() => fillerRects(cluster), [cluster]);

  // Skeleton continuation for the initial load (blank canvas otherwise) and
  // for infinite-scroll fetches (placeholders already sit past the loaded
  // edge, so panning never hits a visible wall while the next page loads).
  const initialSkeletonTiles = useMemo(
    () =>
      layoutCluster(Array.from({ length: 24 }, (_, i) => skeletonItem(`skeleton-init-${i}`)), null)
        .tiles,
    [],
  );
  const extraSkeletonTiles = useMemo(() => {
    if (!loadingMore) return [];
    const withPlaceholders = layoutCluster(
      [
        ...items,
        ...Array.from({ length: EXTRA_SKELETON_COUNT }, (_, i) => skeletonItem(`skeleton-more-${i}`)),
      ],
      selectedId,
    );
    return withPlaceholders.tiles.slice(items.length);
  }, [loadingMore, items, selectedId]);

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
    // Keep the viewport center inside the cluster bounding box — except
    // while there's more to stream in, where a hard wall would break the
    // "infinite" feel; loadMore() below fires well before the true edge.
    if (hasMoreRef.current && selectedId === null) return;
    pan.current.x = Math.min(-bounds.minX, Math.max(-bounds.maxX, pan.current.x));
    pan.current.y = Math.min(-bounds.minY, Math.max(-bounds.maxY, pan.current.y));
  }, [bounds, selectedId]);

  const zoomBy = useCallback(
    (delta: number) => {
      zoomAt(window.innerWidth / 2, window.innerHeight / 2, scaleRef.current + delta);
      clampPan();
      applyPan();
    },
    [applyPan, zoomAt, clampPan],
  );

  // Distance from the current pan position to the nearest loaded edge, in
  // screen px (accounting for zoom) — triggers loadMore() within margin.
  const maybeLoadMore = useCallback(() => {
    if (selectedId !== null || !hasMoreRef.current || loadingMoreRef.current) return;
    const scale = scaleRef.current;
    const distLeft = (-pan.current.x - bounds.minX) * scale;
    const distRight = (bounds.maxX - -pan.current.x) * scale;
    const distTop = (-pan.current.y - bounds.minY) * scale;
    const distBottom = (bounds.maxY - -pan.current.y) * scale;
    if (Math.min(distLeft, distRight, distTop, distBottom) < LOAD_MORE_MARGIN) {
      void loadMore();
    }
  }, [bounds, loadMore, selectedId]);

  useEffect(() => {
    applyPan(); // recenter after re-cluster
    maybeLoadMore(); // a fresh/grown cluster may already be near its own edge
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
        maybeLoadMore();
        momentum.current = requestAnimationFrame(step);
      };
      momentum.current = requestAnimationFrame(step);
    },
    [applyPan, clampPan, maybeLoadMore, reduce],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (activePointers.current.size === 2) {
        // Second finger down → switch to pinch-zoom, pause single-pointer pan.
        stopMomentum();
        pointer.current = null;
        const pts = [...activePointers.current.values()];
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        // Floor the reference distance so two fingers landing close together
        // (common on a quick pinch start) doesn't make the zoom ratio
        // hyper-sensitive to the first few pixels of movement.
        pinch.current = { startDist: Math.max(dist, 40), startScale: scaleRef.current };
        return;
      }
      if (activePointers.current.size > 2) return;
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
      if (activePointers.current.has(e.pointerId)) {
        activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }
      if (pinch.current && activePointers.current.size === 2) {
        const pts = [...activePointers.current.values()];
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const ratio = (dist / pinch.current.startDist) * PINCH_ZOOM_SPEED;
        const midX = (pts[0].x + pts[1].x) / 2;
        const midY = (pts[0].y + pts[1].y) / 2;
        zoomAt(midX, midY, pinch.current.startScale * ratio);
        clampPan();
        applyPan();
        notifyActivity();
        return;
      }
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
      if (Math.abs(e.clientX - p.startX) + Math.abs(e.clientY - p.startY) > 8) {
        p.moved = true;
        notifyActivity();
      }
      pan.current.x += dx;
      pan.current.y += dy;
      clampPan();
      applyPan();
      maybeLoadMore();
    },
    [applyPan, clampPan, maybeLoadMore, notifyActivity, zoomAt],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      activePointers.current.delete(e.pointerId);
      if (activePointers.current.size < 2) pinch.current = null;
      // Down to exactly one finger after a pinch — resume single-pointer pan
      // from wherever that finger currently is, instead of requiring a
      // fresh press.
      if (activePointers.current.size === 1 && !pointer.current) {
        const [[id, pt]] = [...activePointers.current.entries()];
        pointer.current = {
          id,
          startX: pt.x,
          startY: pt.y,
          lastX: pt.x,
          lastY: pt.y,
          lastT: performance.now(),
          vx: 0,
          vy: 0,
          moved: false,
        };
        return;
      }
      const p = pointer.current;
      if (!p || p.id !== e.pointerId) return;
      pointer.current = null;
      if (p.moved) startMomentum(p.vx, p.vy);
    },
    [startMomentum],
  );

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      zoomAt(e.clientX, e.clientY, scaleRef.current - e.deltaY * WHEEL_ZOOM_SPEED);
      clampPan();
      applyPan();
      notifyActivity();
    },
    [applyPan, clampPan, notifyActivity, zoomAt],
  );

  const wasDrag = () => pointer.current?.moved ?? false;

  const onTileClick = useCallback(
    (item: SearchResult) => {
      if (wasDrag()) return;
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
      clickTimerRef.current = setTimeout(() => {
        clickTimerRef.current = null;
        navigator.vibrate?.(8); // light tick — single action confirmed
        void selectItem(item);
      }, CLICK_ARBITRATION_MS);
    },
    [selectItem],
  );

  const onTileDoubleClick = useCallback(
    (item: SearchResult) => {
      if (wasDrag()) return;
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
      }
      navigator.vibrate?.([10, 30, 10]); // double pulse — zoom + info
      openDetail(item);
    },
    [openDetail],
  );

  return (
    <div
      role="region"
      aria-label="Canvas explorer — drag to pan, pinch or scroll to zoom, click an item to see similar pieces, double-click for details"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: bgColor ?? "var(--bg)",
        transition: "background-color 0.45s ease",
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
      onWheel={onWheel}
    >
      {/* The plane — everything on it pans + zooms together */}
      <div
        ref={planeRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 0,
          height: 0,
          transform: "translate3d(50vw, 50dvh, 0) scale(1)",
          willChange: "transform",
        }}
      >
        {loading &&
          items.length === 0 &&
          initialSkeletonTiles.map((t, i) => <SkeletonTile key={t.item.item_id} tile={t} index={i} />)}

        {fillerTiles.map((rect) => (
          <FillerBlock key={rect.key} rect={rect} />
        ))}

        {tiles.map((t, i) => (
          <motion.button
            key={`${generation}:${t.item.item_id}`}
            type="button"
            aria-label={t.item.title}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            whileTap={reduce ? undefined : { scale: 0.96 }}
            transition={{
              duration: 0.15,
              delay: Math.min(i * 0.006, 0.12),
              ease: [0.22, 1, 0.36, 1],
            }}
            onClick={() => onTileClick(t.item)}
            onDoubleClick={() => onTileDoubleClick(t.item)}
            style={{
              position: "absolute",
              left: t.x,
              top: t.y,
              width: t.w,
              height: t.h,
              padding: 0,
              border: t.selected ? "1.5px solid var(--border-hi)" : "none",
              borderRadius: 0,
              overflow: "hidden",
              background: "var(--surface)",
              cursor: "pointer",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {t.item.image_url &&
              (() => {
                const width = t.selected ? 800 : 400;
                const src = mediaUrl(t.item.image_url, width);
                if (!src) return null;
                return (
                  <TileImage
                    src={src}
                    srcSet={mediaSrcSet(t.item.image_url, width)}
                    eager={i < 12}
                  />
                );
              })()}
          </motion.button>
        ))}

        {extraSkeletonTiles.map((t, i) => (
          <SkeletonTile key={t.item.item_id} tile={t} index={i} />
        ))}
      </div>

      {/* Back — floating circle, Ref1/Ref2 top-left */}
      <button
        type="button"
        aria-label="Back"
        onClick={() => {
          navigator.vibrate?.(8);
          if (selectedId) void loadInitial();
          else router.back();
        }}
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

      {/* Zoom controls — floating stack, bottom-right */}
      <div
        style={{
          position: "fixed",
          bottom: "calc(1rem + env(safe-area-inset-bottom))",
          right: "1rem",
          display: "flex",
          flexDirection: "column",
          zIndex: 46,
          borderRadius: 999,
          overflow: "hidden",
          border: "1px solid var(--border)",
          background: "var(--surface-high)",
        }}
      >
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => {
            navigator.vibrate?.(6);
            zoomBy(BUTTON_ZOOM_STEP);
          }}
          style={{
            width: 44,
            height: 44,
            border: "none",
            borderBottom: "1px solid var(--border)",
            background: "transparent",
            color: "var(--text)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <Plus size={18} aria-hidden />
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => {
            navigator.vibrate?.(6);
            zoomBy(-BUTTON_ZOOM_STEP);
          }}
          style={{
            width: 44,
            height: 44,
            border: "none",
            background: "transparent",
            color: "var(--text)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <Minus size={18} aria-hidden />
        </button>
      </div>

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

      <ItemDetailSheet item={detailItem} onClose={closeDetail} />

      <BottomNav collapsed={navCollapsed} />
    </div>
  );
}
