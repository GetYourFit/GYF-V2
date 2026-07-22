/**
 * How far the centred canvas may travel on one axis: half of whatever the
 * scaled content overflows the viewport by. Zero when it already fits.
 */
export function panLimit(viewport: number, content: number, scale: number): number {
  "worklet";
  return Math.max(0, (content * scale - viewport) / 2);
}

export const MIN_SCALE = 0.6;
export const MAX_SCALE = 3;

/** Wheel travel (px) that doubles or halves the scale. */
const WHEEL_ZOOM_PITCH = 300;

/**
 * Desktop web has no pinch, so the wheel is the only way off 1x — and at 1x
 * the content fits, so nothing pans and the canvas reads as inert. Exponential
 * so zooming in and back out by the same travel lands where it started.
 */
export function zoomByWheel(scale: number, deltaY: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * Math.exp(-deltaY / WHEEL_ZOOM_PITCH)));
}
