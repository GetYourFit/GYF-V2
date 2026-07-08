import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Discover / Explore feed payload — Pinterest-style masonry (Ref1–4).
class DiscoverTile {
  const DiscoverTile({
    required this.id,
    required this.aspectRatio,
    this.title,
    this.attribution,
    this.matchPercent,
  });

  final String id;
  final double aspectRatio;
  final String? title;
  final String? attribution;
  final int? matchPercent;
}

class DiscoverFeed {
  const DiscoverFeed({required this.categories, required this.tiles});

  final List<String> categories;
  final List<DiscoverTile> tiles;
}

class DiscoverRepository {
  Future<DiscoverFeed> fetchFeed() async {
    await Future<void>.delayed(const Duration(milliseconds: 400));
    const ratios = [0.75, 1.25, 0.9, 1.4, 1.0, 0.8, 1.3, 0.95];
    return DiscoverFeed(
      categories: const [
        'For You',
        'Editorial',
        'Archival',
        'Street',
        'Minimal',
        'Color',
      ],
      tiles: [
        for (var i = 0; i < 16; i++)
          DiscoverTile(
            id: 'tile-$i',
            aspectRatio: ratios[i % ratios.length],
            title: i % 5 == 0 ? 'Curated capsule ${i ~/ 5 + 1}' : null,
            attribution: i % 5 == 0 ? '@styledna' : null,
            matchPercent: i % 3 == 0 ? 82 + (i % 15) : null,
          ),
      ],
    );
  }
}

final discoverRepositoryProvider =
    Provider<DiscoverRepository>((_) => DiscoverRepository());

final discoverFeedProvider = FutureProvider<DiscoverFeed>(
  (ref) => ref.watch(discoverRepositoryProvider).fetchFeed(),
);

final selectedDiscoverCategoryProvider = StateProvider<String?>((_) => null);

final savedDiscoverTilesProvider = StateProvider<Set<String>>((_) => {});
