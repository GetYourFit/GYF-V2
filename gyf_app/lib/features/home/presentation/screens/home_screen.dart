import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/design_tokens/design_tokens.dart';
import '../../../../app/router/gyf_router.dart';
import '../../../../core/services/haptic_service.dart';
import '../../../../core/widgets/gyf_widgets.dart';
import '../../data/mock_home_repository.dart';

/// Home — AI Fashion Hub (05 Part 3, plan §7.1). Greeting → search →
/// AI Hero Recommendation → collection sections via the §5.6 Expandable
/// Collection Grid. 5-state matrix: the feed provider drives
/// loading/success/error; pull-to-refresh re-fetches.
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  String _greeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = Theme.of(context).textTheme;
    final feed = ref.watch(homeFeedProvider);

    return SafeArea(
      child: RefreshIndicator(
        onRefresh: () async {
          ref.read(hapticServiceProvider).emit(GyfHaptic.selection);
          ref.invalidate(homeFeedProvider);
          await ref.read(homeFeedProvider.future);
        },
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(GyfSpacing.marginStandard),
          children: [
            Text(_greeting(), style: text.headlineSmall),
            const SizedBox(height: GyfSpacing.s4),
            Text('What should I wear today?', style: text.bodyMedium),
            const SizedBox(height: GyfSpacing.s16),
            GyfSearchField(
              hint: 'Search styles, brands, outfits',
              onSubmitted: (_) {},
            ),
            const SizedBox(height: GyfSpacing.s16),
            const _QuickActionsRow(),
            const SizedBox(height: GyfSpacing.s24),
            ...feed.when(
              loading: () => const [
                // Skeletons mirror the final layout — never spinners.
                GyfSkeleton(height: 180),
                SizedBox(height: GyfSpacing.s16),
                GyfSkeleton(height: 320),
              ],
              error: (_, __) => [
                GyfErrorState(
                  variant: GyfErrorVariant.retry,
                  onPrimary: () => ref.invalidate(homeFeedProvider),
                ),
              ],
              data: (data) => [
                _HeroRecommendationCard(hero: data.hero),
                const SizedBox(height: GyfSpacing.s16),
                _ContinueJourneyCard(journey: data.continueJourney),
                for (final (i, collection) in data.collections.indexed) ...[
                  const SizedBox(height: GyfSpacing.s16),
                  GyfExpandableCollectionGrid(
                    title: collection.title,
                    subtitle: collection.subtitle,
                    compatibilityScore: collection.compatibility,
                    updatedLabel: 'Updated today',
                    products: collection.products,
                    onSavedChanged: (_, saved) {
                      if (saved) {
                        ref.read(hapticServiceProvider).emit(GyfHaptic.success);
                      }
                    },
                  )
                      .animate(delay: GyfMotion.stagger * (i + 1))
                      .fadeIn(duration: GyfMotion.medium, curve: GyfCurve.enter)
                      .slideY(begin: 0.04, duration: GyfMotion.medium),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// AI Hero Recommendation — hero card with AI explanation + confidence.
class _HeroRecommendationCard extends ConsumerWidget {
  const _HeroRecommendationCard({required this.hero});

  final HeroRecommendation hero;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = Theme.of(context).extension<GyfColorScheme>()!;
    return GyfPressableCard(
      onTap: () => context.go(GyfRoutes.aiStylist),
      semanticLabel:
          'Today’s recommendation: ${hero.headline}, ${hero.confidence} '
          'percent match',
      child: Container(
        padding: const EdgeInsets.all(GyfSpacing.s20),
        decoration: BoxDecoration(gradient: colors.aiGradient),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  Icons.auto_awesome,
                  color: colors.textInverse,
                  size: GyfIconSize.sm,
                ),
                const SizedBox(width: GyfSpacing.s8),
                Expanded(
                  child: Text(
                    'Today’s look',
                    style: GyfTypography.caption
                        .copyWith(color: colors.textInverse),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(width: GyfSpacing.s8),
                // Flexible+FittedBox: the badge's own text (percent +
                // quality label) can be wider than the space left on
                // the narrowest phones — scale it down rather than
                // overflow. Flexible is required for FittedBox to
                // actually receive a bounded width from the Row.
                Flexible(
                  child: FittedBox(
                    fit: BoxFit.scaleDown,
                    alignment: Alignment.centerRight,
                    child: GyfConfidenceBadge(percent: hero.confidence),
                  ),
                ),
              ],
            ),
            const SizedBox(height: GyfSpacing.s12),
            Text(
              hero.headline,
              style: GyfTypography.title.copyWith(color: colors.textInverse),
            ),
            const SizedBox(height: GyfSpacing.s8),
            Text(
              hero.reason,
              style:
                  GyfTypography.bodySmall.copyWith(color: colors.textInverse),
            ),
          ],
        ),
      ),
    );
  }
}

/// Quick actions (05 Part 3): the three flagship shortcuts.
class _QuickActionsRow extends StatelessWidget {
  const _QuickActionsRow();

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<GyfColorScheme>()!;
    return Row(
      children: [
        for (final (icon, label, route) in [
          (Icons.photo_camera_outlined, 'Outfit check', GyfRoutes.aiStylist),
          (Icons.checkroom_outlined, 'Add clothing', GyfRoutes.wardrobe),
          (Icons.auto_awesome, 'Ask AI', GyfRoutes.aiStylist),
        ]) ...[
          if (label != 'Outfit check') const SizedBox(width: GyfSpacing.s8),
          Expanded(
            child: GyfPressableCard(
              onTap: () => context.go(route),
              semanticLabel: label,
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  vertical: GyfSpacing.s12,
                ),
                child: Column(
                  children: [
                    Icon(icon, color: colors.primary, size: GyfIconSize.sm),
                    const SizedBox(height: GyfSpacing.s4),
                    Text(
                      label,
                      style: GyfTypography.caption,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }
}

/// Continue Journey — resume the last incomplete flow.
class _ContinueJourneyCard extends StatelessWidget {
  const _ContinueJourneyCard({required this.journey});

  final ContinueJourney journey;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<GyfColorScheme>()!;
    return GyfPressableCard(
      onTap: () => context.go(GyfRoutes.wardrobe),
      semanticLabel: 'Continue: ${journey.title}',
      child: Padding(
        padding: const EdgeInsets.all(GyfSpacing.s16),
        child: Row(
          children: [
            Icon(Icons.play_circle_outline, color: colors.primary),
            const SizedBox(width: GyfSpacing.s12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(journey.title, style: GyfTypography.label),
                  const SizedBox(height: GyfSpacing.s2),
                  Text(
                    journey.subtitle,
                    style: GyfTypography.caption
                        .copyWith(color: colors.textSecondary),
                  ),
                ],
              ),
            ),
            Icon(
              Icons.chevron_right,
              color: colors.textTertiary,
              size: GyfIconSize.sm,
            ),
          ],
        ),
      ),
    );
  }
}
