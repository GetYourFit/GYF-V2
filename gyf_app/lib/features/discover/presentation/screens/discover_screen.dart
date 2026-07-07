import 'package:flutter/material.dart';

import '../../../../core/widgets/gyf_empty_state.dart';

/// Discover (05_SCREEN_SPECIFICATIONS Part 5) — Phase 3.2.
class DiscoverScreen extends StatelessWidget {
  const DiscoverScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const SafeArea(
      child: GyfEmptyState(
        headline: 'Discover is coming together.',
        description:
            'Collections, brands, and editorial will live here. Built in Phase 3.',
      ),
    );
  }
}
