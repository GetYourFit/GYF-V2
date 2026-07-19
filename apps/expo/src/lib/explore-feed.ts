import type { CatalogFacets, SearchParams, SearchResult } from "./api";

export const EXPLORE_PAGE_SIZE = 24;

/**
 * The default multi-slot browse mix. Deliberately NOT every slot in
 * `SLOT_FILTERS`: the unqueried feed interleaves the four slots a complete
 * look is built from, so outerwear and accessories never crowd out the
 * garments. They stay reachable as an explicit slot chip.
 */
export const EXPLORE_SLOTS = ["top", "bottom", "full_body", "footwear"] as const;

export type ExploreSort = "relevance" | "price_asc" | "price_desc";

export type ExploreFilters = {
  q: string;
  slot: string | null;
  occasion: string | null;
  style: string | null;
  sort: ExploreSort;
  maxPrice: number | null;
};

export const EMPTY_EXPLORE_FILTERS: ExploreFilters = {
  q: "",
  slot: null,
  occasion: null,
  style: null,
  sort: "relevance",
  maxPrice: null,
};

export type ExploreRequest =
  | {
      mode: "browse";
      params: Omit<SearchParams, "sort" | "max_price">;
    }
  | {
      mode: "similar";
      itemId: string;
      params: SearchParams;
    }
  | {
      mode: "search";
      query: string;
      params: SearchParams;
    };

/**
 * Browse honours neither text, price, sort nor style — only slot interleave and
 * gender. Any other active filter must route to search or it is silently lost,
 * which would show the user a grid that contradicts their own chips.
 */
export function isPlainBrowse(filters: ExploreFilters): boolean {
  return (
    !filters.q.trim() &&
    !filters.slot &&
    !filters.occasion &&
    !filters.style &&
    filters.sort === "relevance" &&
    filters.maxPrice == null
  );
}

/** How many filters the user has actually set — drives the clear affordance. */
export function activeFilterCount(filters: ExploreFilters): number {
  return (
    (filters.q.trim() ? 1 : 0) +
    (filters.slot ? 1 : 0) +
    (filters.occasion ? 1 : 0) +
    (filters.style ? 1 : 0) +
    (filters.maxPrice != null ? 1 : 0) +
    (filters.sort !== "relevance" ? 1 : 0)
  );
}

/**
 * The catalogue has no price sort or budget filter to offer when nothing in it
 * is priced. Showing the controls anyway would return an empty grid and read as
 * a bug rather than as missing data.
 */
export function priceFiltersUsable(facets: CatalogFacets | null): boolean {
  return (facets?.priced ?? 0) > 0;
}

/**
 * Drop price filters the catalogue cannot honour. Called when facets land, so a
 * filter set before the answer arrived cannot strand the user on an empty grid.
 */
export function withUsablePriceFilters(
  filters: ExploreFilters,
  facets: CatalogFacets | null,
): ExploreFilters {
  if (priceFiltersUsable(facets)) return filters;
  if (filters.maxPrice == null && filters.sort === "relevance") return filters;
  return { ...filters, maxPrice: null, sort: "relevance" };
}

/**
 * The catalogue slice to browse, from the user's stated styling gender.
 * `unknown` is the contract's sentinel for "not stated" (`usermodel.py`), not a
 * value to filter on — scoping the catalogue to it would return nothing. An
 * unstated gender must widen the grid, never narrow it to a guess.
 */
export function scopeGender(gender: string | null | undefined): string | null {
  return gender && gender !== "unknown" ? gender : null;
}

/**
 * Occasion and style are vocabulary the catalogue carries in its text, not
 * server-side filter params — so they join the query the embedding scores
 * against. `"fashion"` is the neutral stand-in when a filter is set without a
 * typed query, matching the web oracle.
 */
export function exploreQuery(filters: ExploreFilters): string {
  return [filters.q.trim() || "fashion", filters.occasion, filters.style].filter(Boolean).join(" ");
}

export function buildExploreRequest(
  filters: ExploreFilters,
  page: number,
  seed: string,
  gender?: string | null,
  similarItemId?: string | null,
): ExploreRequest {
  const offset = page * EXPLORE_PAGE_SIZE;
  const scope = gender ? { gender } : {};

  if (similarItemId) {
    return {
      mode: "similar",
      itemId: similarItemId,
      params: { k: EXPLORE_PAGE_SIZE, offset, ...scope },
    };
  }

  if (isPlainBrowse(filters)) {
    return {
      mode: "browse",
      params: {
        k: EXPLORE_PAGE_SIZE,
        offset,
        seed,
        slots: EXPLORE_SLOTS.join(","),
        ...scope,
      },
    };
  }

  return {
    mode: "search",
    query: exploreQuery(filters),
    params: {
      k: EXPLORE_PAGE_SIZE,
      offset,
      sort: filters.sort,
      ...(filters.slot ? { slot: filters.slot } : { slots: EXPLORE_SLOTS.join(",") }),
      ...(filters.maxPrice != null ? { max_price: filters.maxPrice } : {}),
      ...scope,
    },
  };
}

const SORT_LABELS: Record<ExploreSort, string> = {
  relevance: "Relevance",
  price_asc: "Price low",
  price_desc: "Price high",
};

export type FilterPill = { key: keyof ExploreFilters; label: string };

/** Active filters as removable pills, in the order the controls present them. */
export function removableFilterPills(filters: ExploreFilters): FilterPill[] {
  const pills: FilterPill[] = [];
  if (filters.q.trim()) pills.push({ key: "q", label: `“${filters.q.trim()}”` });
  if (filters.slot) pills.push({ key: "slot", label: filters.slot });
  if (filters.occasion) pills.push({ key: "occasion", label: filters.occasion });
  if (filters.style) pills.push({ key: "style", label: filters.style });
  if (filters.maxPrice != null)
    pills.push({ key: "maxPrice", label: `Max ${filters.maxPrice.toLocaleString("en-US")}` });
  if (filters.sort !== "relevance") pills.push({ key: "sort", label: SORT_LABELS[filters.sort] });
  return pills;
}

/** A new filter set with exactly one filter returned to its empty value. */
export function withoutFilter(filters: ExploreFilters, key: keyof ExploreFilters): ExploreFilters {
  return { ...filters, [key]: EMPTY_EXPLORE_FILTERS[key] };
}

/** Keep pagination stable if the API repeats an item at a page boundary. */
export function appendUniqueItems(current: SearchResult[], next: SearchResult[]): SearchResult[] {
  const seen = new Set(current.map((item) => item.item_id));
  const unique = next.filter((item) => {
    if (seen.has(item.item_id)) return false;
    seen.add(item.item_id);
    return true;
  });
  return [...current, ...unique];
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
};

// Indian grouping: last 3 digits, then groups of 2 (1,99,999 — not 199,999).
function groupIndian(n: number): string {
  const s = String(n);
  if (s.length <= 3) return s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${rest},${last3}`;
}

export function formatCatalogPrice(
  value: number | null | undefined,
  currency?: string | null,
): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Price unavailable";
  const rounded = Math.round(value);
  const code = currency?.trim().toUpperCase();
  // Render each item's TRUE currency — no relabel, no FX. INR gets the native
  // ₹ + Indian digit grouping so the India-first catalogue reads locally; a
  // genuinely USD-sourced item honestly stays "$…". User-selected conversion is
  // the F4-02/P5.4 FX slice (needs a dated rate + original-price disclosure).
  // ponytail: explicit symbol map + manual grouping — Hermes Intl.NumberFormat
  // currency support is not guaranteed on Android; this is engine-independent.
  const grouped = code === "INR" ? groupIndian(rounded) : rounded.toLocaleString("en-US");
  const symbol = code ? CURRENCY_SYMBOLS[code] : undefined;
  if (symbol) return `${symbol}${grouped}`;
  return code ? `${code} ${grouped}` : grouped;
}

/**
 * What the retrieval score means, in words — never a bespoke per-item analysis
 * GYF does not have on this surface (doctrine D6). The real per-item reasoning
 * lives in the complete-look pairing and the stylist's explanations.
 *
 * A browse row carries the retrieval placeholder score 0.0 (real cosine
 * similarity is always > 0). That means "not scored", never a judgment, and it
 * must not render as a confident 0% match.
 */
export function compatibilityReason(score: number | null | undefined): {
  scored: boolean;
  reason: string;
} {
  if (typeof score !== "number" || !Number.isFinite(score) || score <= 0) {
    return {
      scored: false,
      reason:
        "A catalogue browse pick — not yet scored against your profile. Save or skip looks to teach GYF your taste.",
    };
  }
  if (score >= 0.75) {
    return {
      scored: true,
      reason: "Strong match with your style profile based on its visual signals.",
    };
  }
  if (score >= 0.5) {
    return { scored: true, reason: "Moderate match — worth a look alongside the pairings below." };
  }
  return {
    scored: true,
    reason: "Outside your usual profile — an exploratory pick if you want to branch out.",
  };
}
