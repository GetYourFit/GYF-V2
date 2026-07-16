import { describe, expect, test } from "bun:test";

import type { CatalogFacets } from "./api";
import {
  activeFilterCount,
  appendUniqueItems,
  buildExploreRequest,
  compatibilityReason,
  EMPTY_EXPLORE_FILTERS,
  exploreQuery,
  formatCatalogPrice,
  isPlainBrowse,
  priceFiltersUsable,
  scopeGender,
  withUsablePriceFilters,
} from "./explore-feed";

const clean = EMPTY_EXPLORE_FILTERS;

const facets = (priced: number): CatalogFacets =>
  ({ total: 100, priced, price_min: 500, price_max: 9000 }) as CatalogFacets;

describe("Expo Explore request model", () => {
  test("uses cheap catalogue browse only when no filter is active", () => {
    expect(isPlainBrowse(clean)).toBe(true);
    expect(buildExploreRequest(clean, 1, "session-1")).toEqual({
      mode: "browse",
      params: {
        k: 24,
        offset: 24,
        seed: "session-1",
        slots: "top,bottom,full_body,footwear",
      },
    });
  });

  test("routes search, slot and budget filters through the endpoint that honors them", () => {
    expect(
      buildExploreRequest(
        { ...clean, q: "linen shirt", slot: "top", maxPrice: 2500, sort: "price_asc" },
        0,
        "ignored",
      ),
    ).toEqual({
      mode: "search",
      query: "linen shirt",
      params: { k: 24, offset: 0, sort: "price_asc", slot: "top", max_price: 2500 },
    });
  });

  // Browse honours neither occasion nor style, so falling through to it would
  // silently drop the chip the user just tapped and show a contradicting grid.
  test("occasion and style leave browse and join the scored query", () => {
    const filters = { ...clean, occasion: "wedding", style: "minimalist" };
    expect(isPlainBrowse(filters)).toBe(false);
    expect(exploreQuery(filters)).toBe("fashion wedding minimalist");
    expect(buildExploreRequest(filters, 0, "session-1")).toEqual({
      mode: "search",
      query: "fashion wedding minimalist",
      params: { k: 24, offset: 0, sort: "relevance", slots: "top,bottom,full_body,footwear" },
    });
  });

  test("a typed query keeps its own words ahead of the vocabulary filters", () => {
    expect(exploreQuery({ ...clean, q: "  red saree ", occasion: "festive" })).toBe(
      "red saree festive",
    );
  });

  test("the styling gender scopes both the browse feed and search", () => {
    expect(buildExploreRequest(clean, 0, "seed", "women")).toMatchObject({
      mode: "browse",
      params: { gender: "women" },
    });
    expect(buildExploreRequest({ ...clean, q: "coat" }, 0, "seed", "men")).toMatchObject({
      mode: "search",
      params: { gender: "men" },
    });
    // No stated gender must never narrow the catalogue to a guess.
    expect(buildExploreRequest(clean, 0, "seed", null).params).not.toHaveProperty("gender");
    expect(buildExploreRequest(clean, 0, "seed").params).not.toHaveProperty("gender");
  });

  test("an unstated gender widens the catalogue instead of scoping to a sentinel", () => {
    expect(scopeGender("women")).toBe("women");
    // `unknown` is the contract's not-stated sentinel; filtering on it matches nothing.
    expect(scopeGender("unknown")).toBeNull();
    expect(scopeGender("")).toBeNull();
    expect(scopeGender(null)).toBeNull();
    expect(scopeGender(undefined)).toBeNull();
  });

  test("sort alone is a filter — it cannot fall through to unsorted browse", () => {
    expect(isPlainBrowse({ ...clean, sort: "price_desc" })).toBe(false);
    expect(activeFilterCount({ ...clean, sort: "price_desc" })).toBe(1);
  });

  test("counts only filters the user actually set", () => {
    expect(activeFilterCount(clean)).toBe(0);
    expect(activeFilterCount({ ...clean, q: "   " })).toBe(0);
    expect(
      activeFilterCount({
        q: "shirt",
        slot: "top",
        occasion: "casual",
        style: "classic",
        maxPrice: 900,
        sort: "price_asc",
      }),
    ).toBe(6);
  });

  test("does not duplicate a repeated page-boundary item", () => {
    const item = (item_id: string) => ({ item_id, title: item_id, score: 0 });
    expect(appendUniqueItems([item("a")], [item("a"), item("b"), item("b")])).toEqual([
      item("a"),
      item("b"),
    ]);
  });
});

describe("price controls follow the catalogue, not the UI's wishes", () => {
  test("price filters are offered only when something is priced", () => {
    expect(priceFiltersUsable(facets(9_161))).toBe(true);
    expect(priceFiltersUsable(facets(0))).toBe(false);
    expect(priceFiltersUsable(null)).toBe(false);
  });

  test("an unpriced catalogue drops price filters instead of returning nothing", () => {
    const filtered = { ...clean, maxPrice: 2000, sort: "price_asc" as const, slot: "top" };
    expect(withUsablePriceFilters(filtered, facets(0))).toEqual({ ...clean, slot: "top" });
    // A priced catalogue keeps the user's choice untouched.
    expect(withUsablePriceFilters(filtered, facets(50))).toBe(filtered);
    // Nothing to drop: the same object comes back, so no needless re-fetch.
    expect(withUsablePriceFilters(clean, facets(0))).toBe(clean);
  });
});

describe("catalogue honesty", () => {
  test("an unscored browse row is labelled unscored, never a 0% judgment", () => {
    for (const score of [0, -0.2, null, undefined, Number.NaN]) {
      const { scored, reason } = compatibilityReason(score);
      expect(scored).toBe(false);
      expect(reason).toContain("not yet scored");
      expect(reason).not.toContain("%");
    }
  });

  test("a real score maps to its band", () => {
    expect(compatibilityReason(0.9).reason).toContain("Strong match");
    expect(compatibilityReason(0.6).reason).toContain("Moderate match");
    expect(compatibilityReason(0.2).reason).toContain("Outside your usual profile");
    expect(compatibilityReason(0.2).scored).toBe(true);
  });

  test("a missing price says so rather than rendering as free", () => {
    expect(formatCatalogPrice(null)).toBe("Price unavailable");
    expect(formatCatalogPrice(Number.NaN)).toBe("Price unavailable");
    expect(formatCatalogPrice(1999.4, "INR")).toBe("INR 1,999");
  });
});
