import { describe, expect, test } from "bun:test";

import { tierForWidth } from "@/theme/tokens";

import {
  CORE_ROUTE_FIXTURES,
  CORE_ROUTE_REQUIRED_STATES,
  CORE_ROUTE_THEMES,
  CORE_ROUTE_WIDTHS,
} from "./core-route-states";

function expectDeepFrozen(value: unknown): void {
  if (!value || typeof value !== "object") return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const nested of Object.values(value)) expectDeepFrozen(nested);
}

function mediaUrlsIn(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(mediaUrlsIn);
  return Object.entries(value).flatMap(([key, nested]) =>
    /image_?url/i.test(key) && typeof nested === "string" ? [nested] : mediaUrlsIn(nested),
  );
}

describe("core route evidence matrix", () => {
  test("uses stable unique IDs and expands every case across every width and theme", () => {
    const ids = CORE_ROUTE_FIXTURES.map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(CORE_ROUTE_WIDTHS.map(({ width }) => width)).toEqual([320, 390, 768, 1280]);
    expect(CORE_ROUTE_THEMES).toEqual(["light", "dark"]);

    for (const baseId of new Set(CORE_ROUTE_FIXTURES.map(({ baseId }) => baseId))) {
      const variants = CORE_ROUTE_FIXTURES.filter((fixture) => fixture.baseId === baseId);
      expect(variants).toHaveLength(CORE_ROUTE_WIDTHS.length * CORE_ROUTE_THEMES.length);
      expect(new Set(variants.map(({ width }) => width))).toEqual(
        new Set(CORE_ROUTE_WIDTHS.map(({ width }) => width)),
      );
      expect(new Set(variants.map(({ theme }) => theme))).toEqual(new Set(CORE_ROUTE_THEMES));
    }
  });

  test("resolves the shared width tier and Explore column count", () => {
    const exploreColumns: Record<number, number> = { 320: 2, 390: 2, 768: 3, 1280: 4 };
    for (const fixture of CORE_ROUTE_FIXTURES) {
      expect(fixture.tier).toBe(tierForWidth(fixture.width));
      expect(fixture.exploreColumns).toBe(
        fixture.route === "explore" ? exploreColumns[fixture.width] : null,
      );
    }
  });

  test("records every required state for every route as supported evidence or an explicit gap", () => {
    const expectedSupport = {
      stylist: {
        happy: "supported",
        loading: "supported",
        empty: "supported",
        error: "supported",
        offline: "gap",
        "capability-closed": "supported",
      },
      explore: {
        happy: "supported",
        loading: "supported",
        empty: "supported",
        error: "supported",
        offline: "gap",
      },
      "item-detail": {
        happy: "supported",
        loading: "supported",
        empty: "supported",
        error: "supported",
        offline: "gap",
      },
    } as const;

    expect(CORE_ROUTE_REQUIRED_STATES).toEqual({
      stylist: ["happy", "loading", "empty", "error", "offline", "capability-closed"],
      explore: ["happy", "loading", "empty", "error", "offline"],
      "item-detail": ["happy", "loading", "empty", "error", "offline"],
    });

    for (const route of ["stylist", "explore", "item-detail"] as const) {
      const routeFixtures = CORE_ROUTE_FIXTURES.filter(({ route: value }) => value === route);
      for (const [state, support] of Object.entries(expectedSupport[route])) {
        const matches = routeFixtures.filter(({ state: value }) => value === state);
        expect(matches).toHaveLength(CORE_ROUTE_WIDTHS.length * CORE_ROUTE_THEMES.length);
        expect(matches.every((fixture) => fixture.support === support)).toBe(true);
      }
    }

    expect(new Set(CORE_ROUTE_FIXTURES.map(({ route, state }) => `${route}:${state}`))).toEqual(
      new Set(
        Object.entries(expectedSupport).flatMap(([route, states]) =>
          Object.keys(states).map((state) => `${route}:${state}`),
        ),
      ),
    );
  });

  test("keeps the Stylist happy and capability-closed evidence as complete outfits", () => {
    const fixtures = CORE_ROUTE_FIXTURES.filter(
      ({ route, state }) =>
        route === "stylist" && (state === "happy" || state === "capability-closed"),
    );
    for (const fixture of fixtures) {
      if (!fixture.data || !("outfits" in fixture.data)) throw new Error("missing Stylist data");
      expect(new Set(fixture.data.outfits[0]?.items.map(({ slot }) => slot))).toEqual(
        new Set(["top", "bottom", "footwear"]),
      );
    }
  });

  test("provides enough distinct Explore results to fill the widest fixture row", () => {
    const fixtures = CORE_ROUTE_FIXTURES.filter(
      ({ route, state }) => route === "explore" && state === "happy",
    );
    for (const fixture of fixtures) {
      if (!Array.isArray(fixture.data)) throw new Error("missing Explore results");
      expect(fixture.data).toHaveLength(4);
      expect(new Set(fixture.data.map(({ item_id }) => item_id)).size).toBe(4);
      expect(fixture.data.length).toBeGreaterThanOrEqual(fixture.exploreColumns ?? 0);
    }
  });

  test("records honest item-detail pairing and action data for each state", () => {
    const fixtureFor = (state: "happy" | "loading" | "empty" | "error") =>
      CORE_ROUTE_FIXTURES.find(
        (fixture) => fixture.route === "item-detail" && fixture.state === state,
      );
    const happy = fixtureFor("happy");
    const loading = fixtureFor("loading");
    const empty = fixtureFor("empty");
    const error = fixtureFor("error");
    for (const fixture of [happy, loading, empty, error]) {
      if (!fixture?.data || !("item" in fixture.data) || !("pairingState" in fixture.data)) {
        throw new Error("missing item-detail state data");
      }
    }
    if (
      !happy?.data ||
      !("pairing" in happy.data) ||
      !loading?.data ||
      !("pairing" in loading.data) ||
      !empty?.data ||
      !("pairing" in empty.data) ||
      !error?.data ||
      !("pairing" in error.data)
    ) {
      throw new Error("missing item-detail pairing data");
    }

    expect(happy.data.pairingState).toBe("ready");
    expect(new Set(happy.data.pairing?.items.map(({ slot }) => slot))).toEqual(
      new Set(["top", "bottom", "footwear"]),
    );
    expect(loading.data).toMatchObject({
      pairingState: "loading",
      pairing: null,
      actionError: null,
    });
    expect(empty.data).toMatchObject({ pairingState: "empty", pairing: null, actionError: null });
    expect(error.data.pairingState).toBe("ready");
    expect(error.data.pairing).not.toBeNull();
    expect(error.data.actionError).toBeTruthy();
  });

  test("makes the hero, one primary action, explanation path, and evidence status explicit", () => {
    expectDeepFrozen(CORE_ROUTE_WIDTHS);
    expectDeepFrozen(CORE_ROUTE_THEMES);
    expectDeepFrozen(CORE_ROUTE_REQUIRED_STATES);
    expectDeepFrozen(CORE_ROUTE_FIXTURES);
    for (const fixture of CORE_ROUTE_FIXTURES) {
      expect(fixture.hero.length).toBeGreaterThan(0);
      expect(fixture.primaryAction.length).toBeGreaterThan(0);
      expect(fixture.explanationPath.length).toBeGreaterThan(0);
      expect(fixture.supportNote.length).toBeGreaterThan(0);
    }
  });

  test("keeps catalogue imagery HTTPS-only and excludes private or user media", () => {
    for (const fixture of CORE_ROUTE_FIXTURES) {
      expect(fixture.mediaScope === "public-catalogue" || fixture.mediaScope === "none").toBe(true);
      if (fixture.mediaScope === "none") expect(fixture.imageUrls).toHaveLength(0);
      expect(new Set(fixture.imageUrls)).toEqual(new Set(mediaUrlsIn(fixture.data)));
      for (const url of fixture.imageUrls) expect(new URL(url).protocol).toBe("https:");
      expect(JSON.stringify(fixture).toLowerCase()).not.toMatch(
        /avatar|body.photo|private|signed[_-]?url|user[_-]?(image|media|photo)/,
      );
    }
  });
});
