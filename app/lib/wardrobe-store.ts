"use client";

const STORAGE_KEY = "gyf_wardrobe";

export type GarmentCategory =
  | "tops"
  | "bottoms"
  | "outerwear"
  | "footwear"
  | "accessories"
  | "dresses"
  | "other";

export interface WardrobeItem {
  id: string;
  name: string;
  category: GarmentCategory;
  color?: string;
  brand?: string;
  imageUrl?: string;
  addedAt: string;
}

function read(): WardrobeItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as WardrobeItem[]) : [];
  } catch {
    return [];
  }
}

// Cached snapshot for `useSyncExternalStore` (stable reference between renders;
// invalidated on write). Recomputed lazily on read.
let snapshot: WardrobeItem[] | null = null;
const EMPTY: WardrobeItem[] = [];
const listeners = new Set<() => void>();

function emit(): void {
  snapshot = null;
  for (const cb of listeners) cb();
}

function write(items: WardrobeItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // storage quota exceeded
  }
  emit();
}

export const wardrobeStore = {
  getAll(): WardrobeItem[] {
    return read();
  },

  /** Subscribe to store changes (for `useSyncExternalStore`). */
  subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },

  /** Stable client snapshot; `[]` on the server (localStorage is client-only). */
  getSnapshot(): WardrobeItem[] {
    if (typeof window === "undefined") return EMPTY;
    if (snapshot === null) snapshot = read();
    return snapshot;
  },

  /** Server snapshot for SSR/hydration — always empty. */
  getServerSnapshot(): WardrobeItem[] {
    return EMPTY;
  },

  getByCategory(category: GarmentCategory): WardrobeItem[] {
    return read().filter((i) => i.category === category);
  },

  add(item: Omit<WardrobeItem, "addedAt">): WardrobeItem {
    const next: WardrobeItem = { ...item, addedAt: new Date().toISOString() };
    write([next, ...read()]);
    return next;
  },

  remove(id: string): void {
    write(read().filter((i) => i.id !== id));
  },

  update(id: string, patch: Partial<Omit<WardrobeItem, "id" | "addedAt">>): void {
    write(read().map((i) => (i.id === id ? { ...i, ...patch } : i)));
  },
};

export const CATEGORY_LABELS: Record<GarmentCategory, string> = {
  tops: "Tops",
  bottoms: "Bottoms",
  outerwear: "Outerwear",
  footwear: "Footwear",
  accessories: "Accessories",
  dresses: "Dresses",
  other: "Other",
};
