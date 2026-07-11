import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Discover / Explore feed payload — Pinterest-style masonry (Ref1–4).
class DiscoverTile {
  const DiscoverTile({
    required this.id,
    required this.category,
    required this.aspectRatio,
    this.title,
    this.attribution,
    this.matchPercent,
  });

  final String id;
  final String category;
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

    const categories = [
      'For You',
      'Editorial',
      'Archival',
      'Street',
      'Minimal',
      'Color',
      'Office',
      'Weekend',
    ];
    const brands = [
      'Uniqlo',
      'COS',
      'Zara',
      'Levi’s',
      'Arket',
      'A.P.C.',
      'Everlane',
      'Mango',
    ];
    const titles = [
      'linen shirt',
      'overshirt',
      'tapered trouser',
      'straight-leg jean',
      'boxy tee',
      'knit polo',
      'tailored short',
      'sneaker',
      'canvas tote',
      'relaxed blazer',
      'rib tank',
      'utility jacket',
    ];
    const ratios = [
      0.72,
      0.86,
      0.95,
      1.08,
      1.22,
      1.34,
      0.78,
      1.16,
    ];

    return DiscoverFeed(
      categories: categories,
      tiles: [
        for (var i = 0; i < 48; i++)
          DiscoverTile(
            id: 'tile-$i',
            category: categories[i % categories.length],
            aspectRatio: ratios[i % ratios.length],
            title: i % 4 == 0
                ? '${categories[i % categories.length]} capsule ${i ~/ 4 + 1}'
                : '${brands[i % brands.length]} ${titles[i % titles.length]}',
            attribution: i % 6 == 0 ? '@styledna' : brands[i % brands.length],
            matchPercent: 72 + (i % 18),
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
final discoverSearchQueryProvider = StateProvider<String>((_) => '');

final savedDiscoverTilesProvider = StateProvider<Set<String>>((_) => {});
