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

/** Per-session shuffle seed for the browse feed: a fresh catalogue order every
 *  visit, stable within the visit so OFFSET pages never overlap. */
export function sessionSeed(): string {
  try {
    let s = sessionStorage.getItem("gyf:seed");
    if (!s) {
      s = Math.random().toString(36).slice(2, 10);
      sessionStorage.setItem("gyf:seed", s);
    }
    return s;
  } catch {
    return ""; // no sessionStorage: server falls back to daily rotation
  }
}

// Cross-surface seen-set: Explore/Canvas record what they showed so the Stylist
// feed stops echoing the same products back ("repeating output"). Session-scoped
// and capped — a de-dupe hint, not a permanent impression log.
// ponytail: client-side only; a server impression log is the upgrade if this
// must hold across devices or feed the taste model.
const SEEN_KEY = "gyf:seen";
const SEEN_CAP = 600;

export function recordSeen(ids: string[]) {
  try {
    const seen: string[] = JSON.parse(sessionStorage.getItem(SEEN_KEY) ?? "[]");
    const merged = [...new Set([...seen, ...ids])].slice(-SEEN_CAP);
    sessionStorage.setItem(SEEN_KEY, JSON.stringify(merged));
  } catch {
    // best-effort
  }
}

export function seenSet(): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(SEEN_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}
