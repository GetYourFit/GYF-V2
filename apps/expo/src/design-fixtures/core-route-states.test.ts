import { describe, expect, test } from "bun:test";

import { columnsForWidth } from "@/components/grid/column-count";
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
    for (const fixture of CORE_ROUTE_FIXTURES) {
      expect(fixture.tier).toBe(tierForWidth(fixture.width));
      expect(fixture.exploreColumns).toBe(
        fixture.route === "explore" ? Math.max(2, columnsForWidth(fixture.width - 48)) : null,
      );
    }
  });

  test("records every required state for every route as supported evidence or an explicit gap", () => {
    expect(CORE_ROUTE_REQUIRED_STATES).toEqual({
      stylist: ["happy", "loading", "empty", "error", "offline", "capability-closed"],
      explore: ["happy", "loading", "empty", "error", "offline"],
      "item-detail": ["happy", "loading", "empty", "error", "offline"],
    });

    for (const route of ["stylist", "explore", "item-detail"] as const) {
      const routeFixtures = CORE_ROUTE_FIXTURES.filter(({ route: value }) => value === route);
      for (const state of CORE_ROUTE_REQUIRED_STATES[route]) {
        const matches = routeFixtures.filter(({ state: value }) => value === state);
        expect(matches.length).toBeGreaterThan(0);
        expect(matches.every(({ support }) => support === "supported" || support === "gap")).toBe(
          true,
        );
      }
    }
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
      for (const url of fixture.imageUrls) expect(new URL(url).protocol).toBe("https:");
      expect(JSON.stringify(fixture).toLowerCase()).not.toMatch(
        /avatar|body.photo|private|signed[_-]?url|user[_-]?(image|media|photo)/,
      );
    }
  });
});
