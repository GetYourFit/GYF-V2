/** Minimum hit area (44pt iOS / 48dp Android — 48 covers both). */
export const MIN_TARGET = 48;

/**
 * Pads the touch area of a visually smaller element up to MIN_TARGET.
 *
 * Pure on purpose: it lives here rather than beside `PressableScale` so it can be
 * unit-tested. Importing the component pulls in react-native, which the test runner
 * cannot parse — which is exactly why this maths went untested while several controls
 * depended on it.
 */
export function hitSlopFor(visualSize: number) {
  const pad = Math.max(0, (MIN_TARGET - visualSize) / 2);
  return { top: pad, bottom: pad, left: pad, right: pad };
}
