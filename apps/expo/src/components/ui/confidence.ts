/** Formats a 0–1 (or 0–100) confidence value as a whole-percent match label. */
export function formatMatchPercent(value: number | null | undefined): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const percent = Math.round(value <= 1 ? value * 100 : value);
  if (percent < 0 || percent > 100) return null;
  return `${percent}% MATCH`;
}
