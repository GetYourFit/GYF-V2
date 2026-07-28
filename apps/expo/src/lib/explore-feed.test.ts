import { describe, expect, test } from "bun:test";

import type { CatalogFacets } from "./api";
import {
  activeFilterCount,
  appendUniqueItems,
  audienceCanBrowse,
  audienceGender,
  buildExploreRequest,
  compatibilityReason,
  EMPTY_EXPLORE_FILTERS,
  exploreQuery,
  formatCatalogPrice,
  isPlainBrowse,
  priceFiltersUsable,
  removableFilterPills,
  withoutFilter,
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

  test("filtered Explore retains each profile's currency-denominated budget", () => {
    const filters = { ...clean, q: "linen shirt", maxPrice: 5_000 };
    const inr = buildExploreRequest(filters, 0, "seed", "men", null, {
      max: 2_000,
      currency: "INR",
    });
    const usd = buildExploreRequest(filters, 0, "seed", "women", null, {
      max: 80,
      currency: "USD",
    });

    expect(inr).toMatchObject({
      mode: "search",
      params: { gender: "men", max_price: 2_000, currency: "INR" },
    });
    expect(usd).toMatchObject({
      mode: "search",
      params: { gender: "women", max_price: 80, currency: "USD" },
    });
    // An explicitly unstated audience widens gender only; it must not discard
    // the separately stated budget and silently compare currencies by number.
    expect(
      buildExploreRequest(filters, 0, "seed", null, null, { max: 2_000, currency: "INR" }),
    ).toMatchObject({
      mode: "search",
      params: { max_price: 2_000, currency: "INR" },
    });
  });

  test("does not construct a catalogue request while an authenticated audience is unresolved", () => {
    expect(audienceCanBrowse({ state: "loading" })).toBe(false);
    expect(audienceCanBrowse({ state: "needs-profile" })).toBe(false);
    expect(audienceCanBrowse({ state: "error", error: new Error("offline") })).toBe(false);
    expect(audienceGender({ state: "loading" })).toBeUndefined();
    expect(audienceGender({ state: "needs-profile" })).toBeUndefined();
  });

  test("makes anonymous and explicitly unknown audience widening intentional", () => {
    expect(audienceCanBrowse({ state: "anonymous" })).toBe(true);
    expect(audienceCanBrowse({ state: "unknown" })).toBe(true);
    expect(audienceGender({ state: "anonymous" })).toBeNull();
    expect(audienceGender({ state: "unknown" })).toBeNull();
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

  test("keeps the canonical audience on similar pages and profile correction refreshes", () => {
    const men = { state: "known", gender: "men" } as const;
    const women = { state: "known", gender: "women" } as const;
    expect(buildExploreRequest(clean, 0, "seed", audienceGender(men)).params).toMatchObject({
      gender: "men",
    });
    expect(buildExploreRequest(clean, 0, "seed", audienceGender(women)).params).toMatchObject({
      gender: "women",
    });
    expect(buildExploreRequest(clean, 0, "seed", audienceGender(men)).params).not.toEqual(
      buildExploreRequest(clean, 0, "seed", audienceGender(women)).params,
    );
  });

  test("a tapped board item keeps filtered similarity inside the same budget currency", () => {
    expect(
      buildExploreRequest(
        { ...clean, slot: "top", maxPrice: 5_000 },
        2,
        "ignored",
        "women",
        "item/42",
        { max: 2_000, currency: "INR" },
      ),
    ).toEqual({
      mode: "similar",
      itemId: "item/42",
      params: {
        k: 24,
        offset: 48,
        slot: "top",
        max_price: 2_000,
        currency: "INR",
        gender: "women",
      },
    });
  });

  test("an unfiltered board item keeps ordinary similar results unconstrained by profile budget", () => {
    expect(
      buildExploreRequest(clean, 2, "ignored", "women", "item/42", {
        max: 2_000,
        currency: "INR",
      }),
    ).toEqual({
      mode: "similar",
      itemId: "item/42",
      params: { k: 24, offset: 48, gender: "women" },
    });
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

describe("applied filters render as removable pills", () => {
  test("no active filters means no pills", () => {
    expect(removableFilterPills(clean)).toEqual([]);
  });

  test("each active filter becomes one labelled pill in stable order", () => {
    const filters = {
      q: "red saree",
      slot: "top",
      occasion: "wedding",
      style: "minimalist",
      sort: "price_asc" as const,
      maxPrice: 2500,
    };
    expect(removableFilterPills(filters)).toEqual([
      { key: "q", label: "“red saree”" },
      { key: "slot", label: "top" },
      { key: "occasion", label: "wedding" },
      { key: "style", label: "minimalist" },
      { key: "maxPrice", label: "Max 2,500" },
      { key: "sort", label: "Price low" },
    ]);
  });

  test("removing one pill resets only that filter, immutably", () => {
    const filters = { ...clean, q: "coat", sort: "price_desc" as const };
    const next = withoutFilter(filters, "sort");
    expect(next).toEqual({ ...clean, q: "coat" });
    expect(filters.sort).toBe("price_desc");
    expect(withoutFilter(next, "q")).toEqual(clean);
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
  });

  test("renders each item's true currency with its native symbol — no relabel, no FX", () => {
    // INR: ₹ + Indian grouping (last 3, then pairs).
    expect(formatCatalogPrice(1999.4, "INR")).toBe("₹1,999");
    expect(formatCatalogPrice(199999, "INR")).toBe("₹1,99,999");
    expect(formatCatalogPrice(12345678, "INR")).toBe("₹1,23,45,678");
    expect(formatCatalogPrice(999, "inr")).toBe("₹999");
    // A genuinely USD-sourced item stays honestly in USD.
    expect(formatCatalogPrice(49, "USD")).toBe("$49");
    // Unknown code keeps the code; no code at all is a bare grouped number.
    expect(formatCatalogPrice(1500, "AED")).toBe("AED 1,500");
    expect(formatCatalogPrice(1500)).toBe("1,500");
  });
});
