import 'package:flutter/animation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/design_tokens/design_tokens.dart';
import '../services/accessibility_manager.dart';

/// Motion gatekeeper (16_IMPLEMENTATION_PLAN §5.1.4).
///
/// When reduced motion is on: hero/large/background motion is disabled,
/// essential fades and state transitions are kept (near-instant).
class AnimationManager {
  const AnimationManager(this._reduceMotion);

  final bool _reduceMotion;

  bool get reduceMotion => _reduceMotion;

  /// Duration for decorative/large motion — collapses under reduced motion.
  Duration decorative(Duration token) => _reduceMotion ? Duration.zero : token;

  /// Duration for essential feedback (state changes, focus) — kept but fast.
  Duration essential(Duration token) => _reduceMotion ? GyfMotion.fast : token;

  Curve curve(Curve token) => _reduceMotion ? GyfCurve.linear : token;
}

final animationManagerProvider = Provider<AnimationManager>((ref) {
  final a11y = ref.watch(accessibilityProvider);
  return AnimationManager(a11y.effectiveReduceMotion);
});
