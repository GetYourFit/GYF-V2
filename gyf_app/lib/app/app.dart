import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/services/accessibility_manager.dart';
import '../core/services/theme_manager.dart';
import 'design_tokens/design_tokens.dart';
import 'router/gyf_router.dart';
import 'theme/gyf_theme.dart';

class GyfApp extends ConsumerWidget {
  const GyfApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    ref.watch(themeManagerProvider);
    final themeMode = ref.read(themeManagerProvider.notifier).themeMode;

    return MaterialApp.router(
      title: 'GYF',
      debugShowCheckedModeBanner: false,
      theme: GyfTheme.light(),
      darkTheme: GyfTheme.dark(),
      themeMode: themeMode,
      themeAnimationDuration: GyfMotion.themeSwitch,
      themeAnimationCurve: GyfCurve.navigate,
      routerConfig: router,
      builder: (context, child) {
        // Keep accessibility flags in sync with system settings.
        final media = MediaQuery.of(context);
        WidgetsBinding.instance.addPostFrameCallback((_) {
          ref.read(accessibilityProvider.notifier).syncFromSystem(media);
        });
        return _MobileFrame(child: child ?? const SizedBox.shrink());
      },
    );
  }
}

/// GYF is a mobile-first product. On wide viewports (desktop web demo)
/// the app renders inside a centered phone-width frame so layout,
/// typography and touch targets match the real mobile experience;
/// on phones it fills the screen as normal.
class _MobileFrame extends StatelessWidget {
  const _MobileFrame({required this.child});

  static const double _maxWidth = 430; // large-phone breakpoint

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<GyfColorScheme>()!;
    final width = MediaQuery.sizeOf(context).width;
    if (width <= GyfBreakpoints.tablet) return child;
    return ColoredBox(
      color: colors.surfaceVariant,
      child: Center(
        child: ClipRRect(
          borderRadius: BorderRadius.circular(GyfRadius.xxl),
          child: Container(
            width: _maxWidth,
            margin: const EdgeInsets.symmetric(vertical: GyfSpacing.s24),
            decoration: const BoxDecoration(boxShadow: GyfShadows.modal),
            child: MediaQuery(
              // The frame is the phone: children size to its width.
              data: MediaQuery.of(context).copyWith(
                size: Size(
                  _maxWidth,
                  MediaQuery.sizeOf(context).height - GyfSpacing.s48,
                ),
              ),
              child: child,
            ),
          ),
        ),
      ),
    );
  }
}
