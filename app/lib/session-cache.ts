// Session-scoped view cache: lets a feed/grid repaint instantly on back-nav
// instead of refetching and losing scroll position. sessionStorage only —
// dies with the tab, so staleness is bounded to one browsing session.
export function readCache<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeCache(key: string, value: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota/private-mode: cache is best-effort
  }
}

/** Drop every cached view. Called after profile mutations: a cached feed/grid
 *  was built for the OLD profile (gender, region, tastes) — repainting it on
 *  back-nav would keep showing stale recommendations. */
export function clearViewCaches() {
  try {
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith("gyf:")) sessionStorage.removeItem(key);
    }
  } catch {
    // best-effort
  }
}
