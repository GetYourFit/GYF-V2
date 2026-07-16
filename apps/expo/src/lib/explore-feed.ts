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
): ExploreRequest {
  const offset = page * EXPLORE_PAGE_SIZE;
  const scope = gender ? { gender } : {};

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

export function formatCatalogPrice(
  value: number | null | undefined,
  currency?: string | null,
): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Price unavailable";
  const code = currency?.trim();
  return code
    ? `${code} ${Math.round(value).toLocaleString()}`
    : Math.round(value).toLocaleString();
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
