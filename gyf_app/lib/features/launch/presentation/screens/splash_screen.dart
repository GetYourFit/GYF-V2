import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/design_tokens/design_tokens.dart';
import '../../../../app/router/gyf_router.dart';
import '../../../../core/animations/animation_manager.dart';
import '../../../../core/services/haptic_service.dart';
import '../../../../core/services/session_manager.dart';

/// GYF splash (05 Part 1). Timeline: 0 ms background → 100 ms logo fade →
/// 250 ms scale 0.92→1.00 → ~330 ms soft-impact haptic → 450 ms glow →
/// 900 ms navigate per the decision tree in [SessionState.launchTarget].
class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen>
    with SingleTickerProviderStateMixin {
  static const _timeline = Duration(milliseconds: 900);

  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: _timeline,
  );

  late final Animation<double> _logoFade = CurvedAnimation(
    parent: _controller,
    curve: const Interval(100 / 900, 250 / 900, curve: GyfCurve.enter),
  );
  late final Animation<double> _logoScale =
      Tween(begin: 0.92, end: 1.0).animate(
    CurvedAnimation(
      parent: _controller,
      curve: const Interval(250 / 900, 450 / 900, curve: GyfCurve.spring),
    ),
  );
  late final Animation<double> _glow = CurvedAnimation(
    parent: _controller,
    curve: const Interval(450 / 900, 700 / 900, curve: GyfCurve.enter),
  );

  bool _hapticFired = false;
  bool _navigated = false;

  @override
  void initState() {
    super.initState();
    _controller.addListener(_onTick);
    _controller.addStatusListener(_onStatus);
    if (ref.read(animationManagerProvider).reduceMotion) {
      _controller.value = 1;
    } else {
      _controller.forward();
    }
  }

  void _onTick() {
    // Soft-impact haptic at the 320–350 ms mark of the timeline.
    if (!_hapticFired && _controller.value >= 330 / 900) {
      _hapticFired = true;
      ref.read(hapticServiceProvider).emit(GyfHaptic.light);
    }
  }

  void _onStatus(AnimationStatus status) {
    if (status == AnimationStatus.completed) _maybeNavigate();
  }

  void _maybeNavigate() {
    if (_navigated || !mounted) return;
    final session = ref.read(sessionManagerProvider);
    // Session restore is one of the parallel init tasks; wait for it.
    if (!session.restored) return;
    _navigated = true;
    switch (session.launchTarget) {
      case GyfLaunchTarget.onboarding:
        context.go(GyfRoutes.onboarding);
      case GyfLaunchTarget.auth:
        context.go(GyfRoutes.authWelcome);
      case GyfLaunchTarget.home:
        context.go(GyfRoutes.home);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<GyfColorScheme>()!;
    // If prefs restore finished after the animation, navigate on rebuild.
    ref.listen(sessionManagerProvider, (_, next) {
      if (next.restored && _controller.isCompleted) _maybeNavigate();
    });

    return Scaffold(
      backgroundColor: colors.background,
      body: Center(
        child: AnimatedBuilder(
          animation: _controller,
          builder: (context, _) {
            return Opacity(
              opacity: _logoFade.value,
              child: Transform.scale(
                scale: _logoScale.value,
                child: Container(
                  padding: const EdgeInsets.all(GyfSpacing.s24),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: colors.primary
                            .withValues(alpha: 0.35 * _glow.value),
                        blurRadius: GyfSpacing.s40 * _glow.value,
                      ),
                    ],
                  ),
                  child: Text(
                    'GYF',
                    style: GyfTypography.displayL.copyWith(
                      color: colors.textBrand,
                      letterSpacing: 8,
                    ),
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}
