/**
 * How far the centred canvas may travel on one axis: half of whatever the
 * scaled content overflows the viewport by. Zero when it already fits.
 */
export function panLimit(viewport: number, content: number, scale: number): number {
  "worklet";
  return Math.max(0, (content * scale - viewport) / 2);
}
