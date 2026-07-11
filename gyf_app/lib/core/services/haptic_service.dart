import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/design_tokens/design_tokens.dart';

/// Sole gateway to platform haptics (16_IMPLEMENTATION_PLAN §5.1.3).
///
/// Widgets emit interaction events as [GyfHaptic] tokens; this service
/// enforces global throttling, per-event mapping, and the user's
/// [GyfHapticLevel] setting. Nothing else in the app may touch
/// [HapticFeedback] directly.
class HapticService {
  HapticService({DateTime Function()? clock}) : _clock = clock ?? DateTime.now;

  final DateTime Function() _clock;
  GyfHapticLevel level = GyfHapticLevel.full;
  DateTime? _last;
  DateTime? _lastTab;

  /// Emit a haptic event. [isTabSwitch] applies the stricter tab throttle.
  Future<void> emit(GyfHaptic haptic, {bool isTabSwitch = false}) async {
    if (haptic == GyfHaptic.none || level == GyfHapticLevel.disabled) return;
    if (!_allowedAtLevel(haptic)) return;

    final now = _clock();
    if (_last != null && now.difference(_last!) < GyfHapticRules.minInterval) {
      return;
    }
    if (isTabSwitch &&
        _lastTab != null &&
        now.difference(_lastTab!) < GyfHapticRules.tabThrottle) {
      return;
    }

    _last = now;
    if (isTabSwitch) _lastTab = now;
    await _invoke(haptic);
  }

  bool _allowedAtLevel(GyfHaptic haptic) => switch (level) {
    GyfHapticLevel.full => true,
    GyfHapticLevel.reduced => haptic != GyfHaptic.heavy,
    GyfHapticLevel.minimal =>
      haptic == GyfHaptic.success ||
          haptic == GyfHaptic.error ||
          haptic == GyfHaptic.warning,
    GyfHapticLevel.disabled => false,
  };

  Future<void> _invoke(GyfHaptic haptic) => switch (haptic) {
    GyfHaptic.selection => HapticFeedback.selectionClick(),
    GyfHaptic.light => HapticFeedback.lightImpact(),
    GyfHaptic.medium => HapticFeedback.mediumImpact(),
    GyfHaptic.heavy || GyfHaptic.success => HapticFeedback.heavyImpact(),
    GyfHaptic.warning || GyfHaptic.error => HapticFeedback.vibrate(),
    GyfHaptic.none => Future<void>.value(),
  };
}

final hapticServiceProvider = Provider<HapticService>((ref) => HapticService());
