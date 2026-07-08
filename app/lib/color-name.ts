/** Maps the catalog's free-text color field (e.g. "off white", "navy",
 *  "gray") to a CSS color for background tinting. Catalog values are
 *  loosely normalized product-copy strings, not a closed enum, so this is
 *  a best-effort lookup with a null fallback — callers keep the current
 *  background when a color has no confident match. */
const COLOR_MAP: Record<string, string> = {
  white: "#f5f4f0",
  "off white": "#efe9df",
  cream: "#f0e6d2",
  ivory: "#f2ecdf",
  eggshell: "#f1ecdd",
  ecru: "#e8dfc3",
  champagne: "#e9dcc1",
  beige: "#e3d5b8",
  nude: "#e2c2a3",
  sand: "#dcc79b",
  wheat: "#e4c98e",
  stone: "#ccc2ac",
  taupe: "#b09b8c",
  tan: "#d2b48c",
  camel: "#c19a6b",
  khaki: "#c3b091",
  brown: "#6b4a30",
  chocolate: "#4a2f20",
  mocha: "#5a4234",
  coffee: "#4b3524",
  espresso: "#3b2a1f",
  black: "#141414",
  jet: "#101010",
  onyx: "#161616",
  charcoal: "#333333",
  graphite: "#3d3d3d",
  gray: "#8a8a8a",
  grey: "#8a8a8a",
  silver: "#b0b0b0",
  red: "#b23a2f",
  crimson: "#9c2b2b",
  scarlet: "#b1301f",
  brick: "#a4472f",
  terracotta: "#b0603f",
  clay: "#a8664a",
  maroon: "#5c1f1f",
  burgundy: "#5e2129",
  wine: "#5a1f2e",
  berry: "#7a2d4a",
  cherry: "#8f1f2c",
  pink: "#d98ea6",
  "hot pink": "#e6598a",
  fuchsia: "#c23b8a",
  magenta: "#bd3b8f",
  blush: "#e3b8bd",
  rose: "#c98a97",
  mauve: "#a6798a",
  plum: "#5f3a56",
  orange: "#c96a2e",
  rust: "#a5522b",
  coral: "#d97a5e",
  salmon: "#d98f7c",
  peach: "#e8b48f",
  apricot: "#dfa25e",
  yellow: "#d9b93c",
  mustard: "#bd9a2e",
  gold: "#b8973f",
  amber: "#c58a2e",
  turmeric: "#c08a24",
  green: "#4a6b4d",
  olive: "#6b6b3a",
  sage: "#8a9a7b",
  mint: "#a3c6ad",
  emerald: "#2f6b4e",
  forest: "#2c4a34",
  "forest green": "#2c4a34",
  hunter: "#2d4632",
  lime: "#9ab83a",
  chartreuse: "#a3b83c",
  teal: "#2f6b66",
  turquoise: "#3f9990",
  aqua: "#4fa8a0",
  cyan: "#4a9bab",
  blue: "#3d5a80",
  cobalt: "#2e4f8a",
  royal: "#2c4c9a",
  "royal blue": "#2c4c9a",
  cerulean: "#3d7ea6",
  "sky blue": "#7fa8c9",
  "baby blue": "#a9c8dd",
  "powder blue": "#b4cbdb",
  steel: "#5f7688",
  navy: "#26344a",
  indigo: "#3a3a6b",
  denim: "#42607d",
  chambray: "#5c7994",
  purple: "#6a4c7d",
  violet: "#6f5a9a",
  lavender: "#a494b8",
  lilac: "#b6a0c4",
  multi: "#4a4a4a",
  multicolor: "#4a4a4a",
  "multi color": "#4a4a4a",
  "multi-color": "#4a4a4a",
  print: "#4a4a4a",
  printed: "#4a4a4a",
};

/** Lowercased lookup key: strips punctuation and collapses whitespace so
 *  "Off-White" / "off_white" / "OFF WHITE" all hit the same entry. */
function normalize(color: string): string {
  return color
    .toLowerCase()
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** CSS color for a catalog color string, or null if unrecognized. */
export function colorNameToCss(color: string | null | undefined): string | null {
  if (!color) return null;
  const key = normalize(color);
  if (COLOR_MAP[key]) return COLOR_MAP[key];
  // Loose fallback: the catalog sometimes prefixes/suffixes a base color
  // with a modifier ("dark green", "light blue") — match the last word.
  const words = key.split(" ");
  const lastWord = words[words.length - 1];
  return COLOR_MAP[lastWord] ?? null;
}
