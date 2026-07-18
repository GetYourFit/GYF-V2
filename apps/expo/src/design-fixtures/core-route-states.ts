import { columnsForWidth } from "@/components/grid/column-count";
import type { OutfitRecommendation, SearchResult } from "@/lib/api";
import { tierForWidth, type SizeTier, type ThemeName } from "@/theme/tokens";

type DeepReadonly<T> = T extends readonly (infer Item)[]
  ? readonly DeepReadonly<Item>[]
  : T extends object
    ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
    : T;

function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (value && typeof value === "object") {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value as DeepReadonly<T>;
}

export const CORE_ROUTE_WIDTHS = deepFreeze([
  { name: "compact-phone", width: 320 },
  { name: "phone", width: 390 },
  { name: "tablet", width: 768 },
  { name: "desktop", width: 1280 },
] as const);

export const CORE_ROUTE_THEMES = deepFreeze(["light", "dark"] as const);

export const CORE_ROUTE_REQUIRED_STATES = deepFreeze({
  stylist: ["happy", "loading", "empty", "error", "offline", "capability-closed"],
  explore: ["happy", "loading", "empty", "error", "offline"],
  "item-detail": ["happy", "loading", "empty", "error", "offline"],
} as const);

type CoreRoute = keyof typeof CORE_ROUTE_REQUIRED_STATES;
type CoreRouteState = (typeof CORE_ROUTE_REQUIRED_STATES)[CoreRoute][number];
type Support = "supported" | "gap";
type FixtureData =
  | DeepReadonly<OutfitRecommendation>
  | readonly DeepReadonly<SearchResult>[]
  | DeepReadonly<SearchResult>
  | null;

const NO_IMAGES = deepFreeze([] as const);
const NO_RESULTS = deepFreeze([] as const);

const STYLIST_RECOMMENDATION = deepFreeze({
  recommendation_id: "fixture-recommendation-01",
  occasion: "work",
  outfits: [
    {
      items: [
        {
          item_id: "fixture-top-01",
          title: "Ivory cotton shirt",
          category: "shirt",
          slot: "top",
          price: 2499,
          currency: "INR",
          color: "ivory",
          affiliate_url: null,
          image_url: null,
          owned: false,
        },
        {
          item_id: "fixture-bottom-01",
          title: "Charcoal tailored trousers",
          category: "trousers",
          slot: "bottom",
          price: 3999,
          currency: "INR",
          color: "charcoal",
          affiliate_url: null,
          image_url: null,
          owned: false,
        },
        {
          item_id: "fixture-footwear-01",
          title: "Black leather loafers",
          category: "loafers",
          slot: "footwear",
          price: 4499,
          currency: "INR",
          color: "black",
          affiliate_url: null,
          image_url: null,
          owned: false,
        },
      ],
      explanation:
        "The restrained contrast fits a work setting and the selected smart-casual goal.",
      score: 0.86,
      confidence: 0.78,
      color_harmony: 0.9,
      formality_fit: 0.88,
    },
  ],
  cold_start: false,
  personalized: true,
  taste_strength: 0.64,
  applied_goals: ["smart casual"],
  wardrobe_grounded: false,
  anchor_item_id: null,
}) satisfies DeepReadonly<OutfitRecommendation>;

const CATALOGUE_ITEM = deepFreeze({
  item_id: "fixture-catalogue-01",
  title: "Indigo linen overshirt",
  score: 0.82,
  image_url: null,
  price: 3299,
  currency: "INR",
  color: "indigo",
  buy_url: null,
}) satisfies DeepReadonly<SearchResult>;

const CATALOGUE_RESULTS = deepFreeze([CATALOGUE_ITEM]);

type BaseFixture = Readonly<{
  baseId: string;
  route: CoreRoute;
  state: CoreRouteState;
  support: Support;
  supportNote: string;
  hero: string;
  primaryAction: string;
  explanationPath: string;
  data: FixtureData;
}>;

type CoreRouteFixture = BaseFixture &
  Readonly<{
    id: string;
    width: number;
    theme: ThemeName;
    tier: SizeTier;
    exploreColumns: number | null;
    mediaScope: "public-catalogue" | "none";
    imageUrls: readonly string[];
  }>;

const BASE_FIXTURES: readonly BaseFixture[] = deepFreeze([
  {
    baseId: "stylist-happy",
    route: "stylist",
    state: "happy",
    support: "supported",
    supportNote: "The route renders a complete explained outfit from the recommendation response.",
    hero: "One complete work look",
    primaryAction: "Save look",
    explanationPath: "Confidence reason and applied style context",
    data: STYLIST_RECOMMENDATION,
  },
  {
    baseId: "stylist-loading",
    route: "stylist",
    state: "loading",
    support: "supported",
    supportNote: "The route reports only reading or warming status while the request is pending.",
    hero: "Reserved look reveal",
    primaryAction: "Pull to refresh",
    explanationPath: "Truthful request status",
    data: null,
  },
  {
    baseId: "stylist-empty",
    route: "stylist",
    state: "empty",
    support: "supported",
    supportNote:
      "An empty recommendation response keeps the styling context and offers another slate.",
    hero: "No complete looks yet",
    primaryAction: "Get another slate",
    explanationPath: "Catalogue cannot support a complete look",
    data: { ...STYLIST_RECOMMENDATION, outfits: [] },
  },
  {
    baseId: "stylist-error",
    route: "stylist",
    state: "error",
    support: "supported",
    supportNote: "Request failures retain the route context and expose a bounded retry.",
    hero: "Stylist request interruption",
    primaryAction: "Try again",
    explanationPath: "Connection or service error message",
    data: null,
  },
  {
    baseId: "stylist-offline",
    route: "stylist",
    state: "offline",
    support: "gap",
    supportNote:
      "The route has a generic connection error but no independently detected offline state.",
    hero: "Last known styling context",
    primaryAction: "Retry when connected",
    explanationPath: "Explicit offline status is still missing",
    data: null,
  },
  {
    baseId: "stylist-capability-closed",
    route: "stylist",
    state: "capability-closed",
    support: "supported",
    supportNote: "Try-on fails closed until system status proves that a rendering lane is usable.",
    hero: "Complete outfit without try-on",
    primaryAction: "Save look",
    explanationPath: "Rendering-lane closure and no-photo reason",
    data: STYLIST_RECOMMENDATION,
  },
  {
    baseId: "explore-happy",
    route: "explore",
    state: "happy",
    support: "supported",
    supportNote:
      "The route renders deduplicated API catalogue results with stable responsive columns.",
    hero: "Edited catalogue grid",
    primaryAction: "Open selected item",
    explanationPath: "Result coverage, price, and active facets",
    data: CATALOGUE_RESULTS,
  },
  {
    baseId: "explore-loading",
    route: "explore",
    state: "loading",
    support: "supported",
    supportNote: "The grid preserves its shape with a bounded set of loading placeholders.",
    hero: "Reserved catalogue grid",
    primaryAction: "Search catalogue",
    explanationPath: "Loading grid without invented progress",
    data: null,
  },
  {
    baseId: "explore-empty",
    route: "explore",
    state: "empty",
    support: "supported",
    supportNote:
      "No-match results retain filters and explain that catalogue rows are not invented.",
    hero: "No pieces matched",
    primaryAction: "Clear filters",
    explanationPath: "Search and filter mismatch guidance",
    data: NO_RESULTS,
  },
  {
    baseId: "explore-error",
    route: "explore",
    state: "error",
    support: "supported",
    supportNote: "Catalogue failures keep the Explore context and expose a bounded retry.",
    hero: "Catalogue request interruption",
    primaryAction: "Try again",
    explanationPath: "Connection or search-service error message",
    data: null,
  },
  {
    baseId: "explore-offline",
    route: "explore",
    state: "offline",
    support: "gap",
    supportNote:
      "The route has a generic connection error but no independently detected offline state.",
    hero: "Catalogue browsing context",
    primaryAction: "Retry when connected",
    explanationPath: "Explicit offline status is still missing",
    data: null,
  },
  {
    baseId: "item-detail-happy",
    route: "item-detail",
    state: "happy",
    support: "supported",
    supportNote:
      "The sheet keeps catalogue context while showing item facts and a complete-look entry.",
    hero: "Indigo linen overshirt",
    primaryAction: "Add to wardrobe",
    explanationPath: "Compatibility reason and complete-look evidence",
    data: CATALOGUE_ITEM,
  },
  {
    baseId: "item-detail-loading",
    route: "item-detail",
    state: "loading",
    support: "supported",
    supportNote:
      "Item facts stay usable while complete-look pairings load without a fake percentage.",
    hero: "Indigo linen overshirt",
    primaryAction: "Add to wardrobe",
    explanationPath: "Pairing placeholders under the item reason",
    data: CATALOGUE_ITEM,
  },
  {
    baseId: "item-detail-empty",
    route: "item-detail",
    state: "empty",
    support: "supported",
    supportNote: "A missing pairing is stated without inventing a compatible look.",
    hero: "Indigo linen overshirt",
    primaryAction: "Add to wardrobe",
    explanationPath: "No complete look available reason",
    data: CATALOGUE_ITEM,
  },
  {
    baseId: "item-detail-error",
    route: "item-detail",
    state: "error",
    support: "supported",
    supportNote: "Wardrobe and retailer action failures remain beside the unchanged item.",
    hero: "Indigo linen overshirt",
    primaryAction: "Retry the failed action",
    explanationPath: "Nothing-changed action error",
    data: CATALOGUE_ITEM,
  },
  {
    baseId: "item-detail-offline",
    route: "item-detail",
    state: "offline",
    support: "gap",
    supportNote: "The sheet has no independently detected offline state for pairing or actions.",
    hero: "Selected catalogue item",
    primaryAction: "Retry when connected",
    explanationPath: "Explicit offline status is still missing",
    data: CATALOGUE_ITEM,
  },
]);

export const CORE_ROUTE_FIXTURES: readonly CoreRouteFixture[] = deepFreeze(
  BASE_FIXTURES.flatMap((fixture) =>
    CORE_ROUTE_WIDTHS.flatMap(({ width }) =>
      CORE_ROUTE_THEMES.map((theme: ThemeName) => ({
        ...fixture,
        id: `${fixture.baseId}:${width}:${theme}`,
        width,
        theme,
        tier: tierForWidth(width),
        exploreColumns:
          fixture.route === "explore" ? Math.max(2, columnsForWidth(width - 48)) : null,
        mediaScope: "none" as const,
        imageUrls: NO_IMAGES,
      })),
    ),
  ),
);
