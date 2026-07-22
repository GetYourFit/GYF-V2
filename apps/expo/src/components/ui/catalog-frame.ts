/** Used until an image reports its size, and whenever it reports nonsense. */
export const DEFAULT_RATIO = 4 / 3;

/**
 * Retailer feeds carry everything from square packshots to very tall lookbook
 * crops. Letting the frame go fully natural would leave one card five times
 * the height of its neighbour, so the band is clamped: portrait-leaning, but
 * wide enough that a square packshot is not cropped into a portrait.
 */
export const MIN_RATIO = 0.85;
export const MAX_RATIO = 1.5;

/**
 * Height-over-width for a catalog image's frame.
 *
 * Every plate used to be a hard 4:3 with contentFit="cover", so any source
 * that was not 4:3 lost its edges — on a garment shot that means the hem or
 * the shoes. Sizing the frame to the source keeps the whole article visible
 * without letterboxing it.
 */
export function frameRatio(sourceWidth?: number | null, sourceHeight?: number | null): number {
  if (!sourceWidth || !sourceHeight || sourceWidth <= 0 || sourceHeight <= 0) {
    return DEFAULT_RATIO;
  }
  const ratio = sourceHeight / sourceWidth;
  if (!Number.isFinite(ratio)) return DEFAULT_RATIO;
  return Math.min(MAX_RATIO, Math.max(MIN_RATIO, ratio));
}
