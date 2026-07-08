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
  beige: "#e3d5b8",
  tan: "#d2b48c",
  khaki: "#c3b091",
  brown: "#6b4a30",
  camel: "#c19a6b",
  black: "#141414",
  charcoal: "#333333",
  gray: "#8a8a8a",
  grey: "#8a8a8a",
  silver: "#b0b0b0",
  red: "#b23a2f",
  maroon: "#5c1f1f",
  burgundy: "#5e2129",
  pink: "#d98ea6",
  "hot pink": "#e6598a",
  rose: "#c98a97",
  orange: "#c96a2e",
  rust: "#a5522b",
  peach: "#e8b48f",
  yellow: "#d9b93c",
  mustard: "#bd9a2e",
  gold: "#b8973f",
  green: "#4a6b4d",
  olive: "#6b6b3a",
  sage: "#8a9a7b",
  mint: "#a3c6ad",
  teal: "#2f6b66",
  blue: "#3d5a80",
  navy: "#26344a",
  "sky blue": "#7fa8c9",
  denim: "#42607d",
  purple: "#6a4c7d",
  lavender: "#a494b8",
  multi: "#4a4a4a",
  multicolor: "#4a4a4a",
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
