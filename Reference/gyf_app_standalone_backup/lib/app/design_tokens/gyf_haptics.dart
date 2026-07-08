/// Haptic tokens (02_DESIGN_SYSTEM Part 6).
///
/// Widgets never call platform haptic APIs — they emit one of these
/// tokens through `HapticService`, which enforces throttling and
/// user/system settings.
enum GyfHaptic {
  none,
  selection,
  light,
  medium,
  heavy,
  success,
  warning,
  error,
}

/// User-facing haptic intensity setting.
enum GyfHapticLevel { full, reduced, minimal, disabled }

/// Global haptic rules — enforced by HapticService, not by widgets.
abstract final class GyfHapticRules {
  /// Minimum interval between any two haptic events.
  static const Duration minInterval = Duration(milliseconds: 100);

  /// Tab-switch haptics are throttled harder.
  static const Duration tabThrottle = Duration(milliseconds: 150);

  /// Max duration of any single vibration.
  static const Duration maxDuration = Duration(milliseconds: 50);
}
