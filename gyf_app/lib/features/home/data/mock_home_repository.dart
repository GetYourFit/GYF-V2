import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/widgets/gyf_expandable_collection_grid.dart';

/// Home feed payload (05 Part 3), mocked per 16 §2 — the UI never
/// depends on backend implementation.
class HomeFeed {
  const HomeFeed({
    required this.hero,
    required this.collections,
    required this.continueJourney,
  });

  final HeroRecommendation hero;
  final List<HomeCollection> collections;

  /// "Continue Journey" — where the user left off (05 Part 3).
  final ContinueJourney continueJourney;
}

class ContinueJourney {
  const ContinueJourney({required this.title, required this.subtitle});

  final String title;
  final String subtitle;
}

class HeroRecommendation {
  const HeroRecommendation({
    required this.headline,
    required this.reason,
    required this.confidence,
  });

  final String headline;
  final String reason;
  final int confidence;
}

class HomeCollection {
  const HomeCollection({
    required this.title,
    required this.subtitle,
    required this.compatibility,
    required this.products,
  });

  final String title;
  final String subtitle;
  final int compatibility;
  final List<GyfCollectionProduct> products;
}

class HomeRepository {
  Future<HomeFeed> fetchFeed() async {
    await Future<void>.delayed(const Duration(milliseconds: 400));
    List<GyfCollectionProduct> products(String seed, int n) => [
          for (var i = 0; i < n; i++)
            GyfCollectionProduct(
              brand: const ['Uniqlo', 'COS', 'Zara', 'Levi’s'][i % 4],
              name: '$seed piece ${i + 1}',
              price: '₹${1499 + i * 300}',
              matchPercent: 96 - i * 2,
              aiReason: 'Complements items you already own.',
              sizes: const ['S', 'M', 'L'],
            ),
        ];
    return HomeFeed(
      hero: const HeroRecommendation(
        headline: 'Linen shirt + tapered chinos',
        reason: 'Warm day, smart-casual calendar, and your neutral palette.',
        confidence: 94,
      ),
      continueJourney: const ContinueJourney(
        title: 'Finish your wardrobe setup',
        subtitle: '12 of 24 items added — 5 minutes to go.',
      ),
      collections: [
        HomeCollection(
          title: 'Today’s Picks',
          subtitle: 'Chosen for your morning and the weather.',
          compatibility: 94,
          products: products('Everyday', 8),
        ),
        HomeCollection(
          title: 'Trending This Week',
          subtitle: 'What people with your StyleDNA are loving.',
          compatibility: 88,
          products: products('Trending', 10),
        ),
        HomeCollection(
          title: 'Recently Viewed',
          subtitle: 'Pick up where you left off.',
          compatibility: 90,
          products: products('Viewed', 6),
        ),
      ],
    );
  }
}

final homeRepositoryProvider =
    Provider<HomeRepository>((_) => HomeRepository());

/// Async feed the screen watches; retry by invalidating this provider.
final homeFeedProvider = FutureProvider<HomeFeed>(
  (ref) => ref.watch(homeRepositoryProvider).fetchFeed(),
);
