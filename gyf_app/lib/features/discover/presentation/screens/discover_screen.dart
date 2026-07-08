import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/design_tokens/design_tokens.dart';
import '../../../../core/widgets/gyf_widgets.dart';
import '../../data/discover_repository.dart';

/// Discover / Explore — Pinterest-style masonry feed (Ref1–4): search,
/// horizontal category pills, sharp-edged image tiles in a two-column
/// masonry. Phase 3.2.
class DiscoverScreen extends ConsumerWidget {
  const DiscoverScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final feed = ref.watch(discoverFeedProvider);

    return SafeArea(
      child: feed.when(
        loading: () => ListView(
          padding: const EdgeInsets.all(GyfSpacing.marginStandard),
          children: const [
            GyfSkeleton(height: 48),
            SizedBox(height: GyfSpacing.s16),
            GyfSkeleton(height: 400),
          ],
        ),
        error: (_, __) => GyfErrorState(
          variant: GyfErrorVariant.retry,
          onPrimary: () => ref.invalidate(discoverFeedProvider),
        ),
        data: (data) => _DiscoverFeed(data: data),
      ),
    );
  }
}

class _DiscoverFeed extends ConsumerWidget {
  const _DiscoverFeed({required this.data});

  final DiscoverFeed data;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selected =
        ref.watch(selectedDiscoverCategoryProvider) ?? data.categories.first;
    final saved = ref.watch(savedDiscoverTilesProvider);

    return CustomScrollView(
      slivers: [
        const SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsets.fromLTRB(
              GyfSpacing.marginStandard,
              GyfSpacing.s16,
              GyfSpacing.marginStandard,
              0,
            ),
            child: GyfSearchField(hint: 'Try “archival fashion”'),
          ),
        ),
        SliverToBoxAdapter(
          child: SizedBox(
            height: GyfSpacing.s40 + GyfSpacing.s16,
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(
                horizontal: GyfSpacing.marginStandard,
                vertical: GyfSpacing.s12,
              ),
              scrollDirection: Axis.horizontal,
              itemCount: data.categories.length,
              separatorBuilder: (_, __) => const SizedBox(width: GyfSpacing.s8),
              itemBuilder: (context, i) {
                final label = data.categories[i];
                return GyfFilterChip(
                  label: label,
                  selected: label == selected,
                  onSelected: (_) => ref
                      .read(selectedDiscoverCategoryProvider.notifier)
                      .state = label,
                );
              },
            ),
          ),
        ),
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(
            GyfSpacing.marginStandard,
            0,
            GyfSpacing.marginStandard,
            GyfSpacing.marginStandard,
          ),
          sliver: SliverToBoxAdapter(
            child: GyfMasonryGrid(
              items: [
                for (final tile in data.tiles)
                  GyfMasonryItem(
                    aspectRatio: tile.aspectRatio,
                    child: GyfSharpImageTile(
                      aspectRatio: tile.aspectRatio,
                      title: tile.title,
                      subtitle: tile.attribution,
                      matchPercent: tile.matchPercent,
                      saved: saved.contains(tile.id),
                      onSaveChanged: (value) => ref
                          .read(savedDiscoverTilesProvider.notifier)
                          .update(
                            (s) => value
                                ? {...s, tile.id}
                                : ({...s}..remove(tile.id)),
                          ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
