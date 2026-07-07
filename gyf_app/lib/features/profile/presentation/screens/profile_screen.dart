import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/design_tokens/design_tokens.dart';
import '../../../../core/services/theme_manager.dart';

/// Profile & Settings (05_SCREEN_SPECIFICATIONS Part 12) — Phase 3.7.
/// Ships early with a working theme selector so light/dark can be
/// exercised from day one.
class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final choice = ref.watch(themeManagerProvider);
    final text = Theme.of(context).textTheme;
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(GyfSpacing.marginStandard),
        children: [
          Text('Profile', style: text.headlineSmall),
          const SizedBox(height: GyfSpacing.s24),
          Text('Appearance', style: text.titleSmall),
          const SizedBox(height: GyfSpacing.s12),
          SegmentedButton<GyfThemeChoice>(
            segments: const [
              ButtonSegment(
                value: GyfThemeChoice.light,
                label: Text('Light'),
                icon: Icon(Icons.light_mode_outlined),
              ),
              ButtonSegment(
                value: GyfThemeChoice.dark,
                label: Text('Dark'),
                icon: Icon(Icons.dark_mode_outlined),
              ),
              ButtonSegment(
                value: GyfThemeChoice.system,
                label: Text('System'),
                icon: Icon(Icons.settings_suggest_outlined),
              ),
            ],
            selected: {choice},
            onSelectionChanged: (selection) => ref
                .read(themeManagerProvider.notifier)
                .setChoice(selection.first),
          ),
        ],
      ),
    );
  }
}
