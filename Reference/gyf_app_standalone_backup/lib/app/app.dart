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
        return child ?? const SizedBox.shrink();
      },
    );
  }
}
