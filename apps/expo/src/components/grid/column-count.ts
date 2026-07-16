import { breakpoints } from "@/theme/tokens";

/** Cards stop growing past this width — a 13" iPad gets more columns, not bigger cards. */
export const MAX_CARD_WIDTH = 260;

/** Grid columns per width tier: 1 compact / 2 phone / 3 regular / 4 wide. */
export function columnsForWidth(width: number): number {
  if (width < breakpoints.compact) return 1;
  if (width < breakpoints.regular) return 2;
  if (width < breakpoints.wide) return 3;
  return 4;
}

/** Card width for a grid row: container split by columns, capped at MAX_CARD_WIDTH. */
export function cardWidthFor(containerWidth: number, columns: number, gap: number): number {
  const raw = (containerWidth - gap * (columns - 1)) / columns;
  return Math.min(MAX_CARD_WIDTH, Math.max(120, raw));
}
