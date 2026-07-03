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
