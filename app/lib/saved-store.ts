/**
 * Client-side persistence for saved outfits.
 *
 * The API's /feedback endpoint is write-only (no GET /saved exists yet).
 * This module keeps a localStorage mirror so the Saved page can display looks
 * the user has bookmarked. The API save event is still fired by the caller —
 * this module only handles the display layer.
 */
import type { Outfit } from "@gyf/types";

const STORAGE_KEY = "gyf_saved_looks";

export interface SavedLook {
  /** Stable id: `${recommendation_id}:${outfit_index}` */
  id: string;
  outfit: Outfit;
  recommendation_id: string;
  /** ISO 8601 */
  savedAt: string;
  occasion?: string;
}

function read(): SavedLook[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedLook[]) : [];
  } catch {
    return [];
  }
}

// A cached snapshot so `useSyncExternalStore` gets a referentially-stable value
// between renders (returning a fresh array each call would loop). Invalidated on
// every write; recomputed lazily on read.
let snapshot: SavedLook[] | null = null;
const EMPTY: SavedLook[] = [];
const listeners = new Set<() => void>();

function emit(): void {
  snapshot = null;
  for (const cb of listeners) cb();
}

function write(looks: SavedLook[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(looks));
  } catch {
    // storage quota exceeded — silently no-op
  }
  emit();
}

export const savedStore = {
  getAll(): SavedLook[] {
    return read();
  },

  /** Subscribe to store changes (for `useSyncExternalStore`). */
  subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },

  /** Stable client snapshot; `[]` on the server (localStorage is client-only). */
  getSnapshot(): SavedLook[] {
    if (typeof window === "undefined") return EMPTY;
    if (snapshot === null) snapshot = read();
    return snapshot;
  },

  /** Server snapshot for SSR/hydration — always empty (no localStorage). */
  getServerSnapshot(): SavedLook[] {
    return EMPTY;
  },

  has(id: string): boolean {
    return read().some((l) => l.id === id);
  },

  save(look: Omit<SavedLook, "savedAt">): void {
    const current = read();
    if (current.some((l) => l.id === look.id)) return; // idempotent
    write([{ ...look, savedAt: new Date().toISOString() }, ...current]);
  },

  remove(id: string): void {
    write(read().filter((l) => l.id !== id));
  },

  clear(): void {
    write([]);
  },
};
