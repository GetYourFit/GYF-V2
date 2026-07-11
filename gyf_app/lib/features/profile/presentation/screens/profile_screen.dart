import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/design_tokens/design_tokens.dart';
import '../../../../core/services/theme_manager.dart';
import '../../../../core/widgets/gyf_widgets.dart';

/// Profile & Settings (05_SCREEN_SPECIFICATIONS Part 12) — cleaner, denser,
/// and less cluttered than the initial stub. The page keeps the existing working
/// theme switch but organizes the rest into a proper settings surface.
class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final choice = ref.watch(themeManagerProvider);
    final colors = Theme.of(context).extension<GyfColorScheme>()!;
    final text = Theme.of(context).textTheme;

    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(GyfSpacing.marginStandard),
        children: [
          const GyfPageChrome(
            title: 'Profile',
            subtitle: 'Your style, privacy, and appearance in one place.',
          ),
          const SizedBox(height: GyfSpacing.s24),
          GyfPressableCard(
            child: Padding(
              padding: const EdgeInsets.all(GyfSpacing.s16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 56,
                        height: 56,
                        decoration: BoxDecoration(
                          color: colors.primaryContainer,
                          borderRadius: BorderRadius.circular(GyfRadius.lg),
                        ),
                        alignment: Alignment.center,
                        child: Icon(
                          Icons.person,
                          color: colors.textBrand,
                          size: GyfIconSize.md,
                        ),
                      ),
                      const SizedBox(width: GyfSpacing.s12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Style profile', style: GyfTypography.h5),
                            const SizedBox(height: GyfSpacing.s2),
                            Text(
                              'Manual onboarding first. Photo estimates stay editable.',
                              style: GyfTypography.caption.copyWith(
                                color: colors.textSecondary,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const GyfBadge(
                        label: 'Live',
                        variant: GyfBadgeVariant.success,
                      ),
                    ],
                  ),
                  const SizedBox(height: GyfSpacing.s16),
                  const Wrap(
                    spacing: GyfSpacing.s8,
                    runSpacing: GyfSpacing.s8,
                    children: [
                      GyfBadge(
                        label: 'Manual input',
                        variant: GyfBadgeVariant.fresh,
                      ),
                      GyfBadge(
                        label: 'Photo beta',
                        variant: GyfBadgeVariant.ai,
                      ),
                      GyfBadge(
                        label: 'Privacy controls',
                        variant: GyfBadgeVariant.premium,
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: GyfSpacing.s24),
          Text('Appearance', style: text.titleSmall),
          const SizedBox(height: GyfSpacing.s12),
          GyfPressableCard(
            child: Padding(
              padding: const EdgeInsets.all(GyfSpacing.s16),
              child: SegmentedButton<GyfThemeChoice>(
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
            ),
          ),
          const SizedBox(height: GyfSpacing.s24),
          Text('Account', style: text.titleSmall),
          const SizedBox(height: GyfSpacing.s12),
          const _ProfileActionCard(
            icon: Icons.tune,
            title: 'Edit preferences',
            description: 'Update style, budget, occasion, and fit.',
          ),
          const SizedBox(height: GyfSpacing.s12),
          const _ProfileActionCard(
            icon: Icons.shield_outlined,
            title: 'Privacy & consent',
            description: 'Review photo, data, and deletion settings.',
          ),
          const SizedBox(height: GyfSpacing.s12),
          const _ProfileActionCard(
            icon: Icons.support_agent,
            title: 'Help & support',
            description: 'Get support without leaving the app.',
          ),
        ],
      ),
    );
  }
}

class _ProfileActionCard extends StatelessWidget {
  const _ProfileActionCard({
    required this.icon,
    required this.title,
    required this.description,
  });

  final IconData icon;
  final String title;
  final String description;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<GyfColorScheme>()!;
    return GyfPressableCard(
      child: Padding(
        padding: const EdgeInsets.all(GyfSpacing.s16),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: colors.surfaceVariant,
                borderRadius: BorderRadius.circular(GyfRadius.md),
              ),
              alignment: Alignment.center,
              child: Icon(icon, color: colors.primary, size: GyfIconSize.sm),
            ),
            const SizedBox(width: GyfSpacing.s12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: GyfTypography.label),
                  const SizedBox(height: GyfSpacing.s2),
                  Text(
                    description,
                    style: GyfTypography.caption.copyWith(
                      color: colors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
