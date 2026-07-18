/**
 * The app's one haptic vocabulary (ScopeofIdea): tap = light impact for
 * ordinary presses/toggles, primary = medium impact for decisive actions,
 * select = tab/segment changes, success/error = async outcome notifications.
 * Web builds get silent no-ops; native failures are swallowed — feedback is
 * garnish, never a code path that can throw.
 */
let haptics: typeof import("expo-haptics") | null = null;
if (process.env.EXPO_OS && process.env.EXPO_OS !== "web") {
  haptics = require("expo-haptics");
}

export function tap(): void {
  void haptics?.impactAsync(haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function primary(): void {
  void haptics?.impactAsync(haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

export function select(): void {
  void haptics?.selectionAsync().catch(() => {});
}

export function success(): void {
  void haptics?.notificationAsync(haptics.NotificationFeedbackType.Success).catch(() => {});
}

export function error(): void {
  void haptics?.notificationAsync(haptics.NotificationFeedbackType.Error).catch(() => {});
}
