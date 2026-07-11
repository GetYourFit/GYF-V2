import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Accessibility flags (16_IMPLEMENTATION_PLAN §5.1.5).
///
/// Merges system settings (reduce motion, bold text, high contrast)
/// with in-app user overrides. `AnimationManager` and `HapticService`
/// consult these flags; widgets read them via provider.
@immutable
class AccessibilityState {
  const AccessibilityState({
    this.reduceMotion = false,
    this.highContrast = false,
    this.reduceMotionOverride,
  });

  final bool reduceMotion;
  final bool highContrast;

  /// User's in-app override; null = follow system.
  final bool? reduceMotionOverride;

  bool get effectiveReduceMotion => reduceMotionOverride ?? reduceMotion;

  AccessibilityState copyWith({
    bool? reduceMotion,
    bool? highContrast,
    bool? Function()? reduceMotionOverride,
  }) =>
      AccessibilityState(
        reduceMotion: reduceMotion ?? this.reduceMotion,
        highContrast: highContrast ?? this.highContrast,
        reduceMotionOverride: reduceMotionOverride != null
            ? reduceMotionOverride()
            : this.reduceMotionOverride,
      );
}

class AccessibilityManager extends Notifier<AccessibilityState> {
  @override
  AccessibilityState build() => const AccessibilityState();

  /// Called from the app root whenever [MediaQuery] changes.
  void syncFromSystem(MediaQueryData media) {
    state = state.copyWith(
      reduceMotion: media.disableAnimations,
      highContrast: media.highContrast,
    );
  }

  void setReduceMotionOverride(bool? value) {
    state = state.copyWith(reduceMotionOverride: () => value);
  }
}

final accessibilityProvider =
    NotifierProvider<AccessibilityManager, AccessibilityState>(
  AccessibilityManager.new,
);
