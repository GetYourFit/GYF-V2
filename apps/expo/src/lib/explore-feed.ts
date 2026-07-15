import type { SearchParams, SearchResult } from "./api";

export const EXPLORE_PAGE_SIZE = 24;
export const EXPLORE_SLOTS = ["top", "bottom", "full_body", "footwear"] as const;

export type ExploreSort = "relevance" | "price_asc" | "price_desc";

export type ExploreFilters = {
  q: string;
  slot: string | null;
  sort: ExploreSort;
  maxPrice: number | null;
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

/** Browse has no filter support. Any user filter must use search or it is lost. */
export function isPlainBrowse(filters: ExploreFilters): boolean {
  return (
    !filters.q.trim() && !filters.slot && filters.sort === "relevance" && filters.maxPrice == null
  );
}

export function buildExploreRequest(
  filters: ExploreFilters,
  page: number,
  seed: string,
): ExploreRequest {
  const offset = page * EXPLORE_PAGE_SIZE;
  if (isPlainBrowse(filters)) {
    return {
      mode: "browse",
      params: {
        k: EXPLORE_PAGE_SIZE,
        offset,
        seed,
        slots: EXPLORE_SLOTS.join(","),
      },
    };
  }

  return {
    mode: "search",
    query: filters.q.trim() || "fashion",
    params: {
      k: EXPLORE_PAGE_SIZE,
      offset,
      sort: filters.sort,
      ...(filters.slot ? { slot: filters.slot } : { slots: EXPLORE_SLOTS.join(",") }),
      ...(filters.maxPrice != null ? { max_price: filters.maxPrice } : {}),
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
