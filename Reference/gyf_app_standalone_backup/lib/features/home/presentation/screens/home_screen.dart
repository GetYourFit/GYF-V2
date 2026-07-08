import 'package:flutter/material.dart';

import '../../../../app/design_tokens/design_tokens.dart';
import '../../../../core/widgets/gyf_skeleton.dart';

/// Home — AI Fashion Hub (05_SCREEN_SPECIFICATIONS Part 3).
/// Placeholder shell: greeting + search + skeleton feed. The full
/// section stack (AI Hero Recommendation, Today's Picks, …) lands in
/// Phase 3.1.
class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  String _greeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(GyfSpacing.marginStandard),
        children: [
          Text(_greeting(), style: text.headlineSmall),
          const SizedBox(height: GyfSpacing.s4),
          Text('What should I wear today?', style: text.bodyMedium),
          const SizedBox(height: GyfSpacing.s16),
          const TextField(
            decoration: InputDecoration(
              hintText: 'Search styles, brands, outfits',
              prefixIcon: Icon(Icons.search),
            ),
          ),
          const SizedBox(height: GyfSpacing.s24),
          // Hero recommendation placeholder — mirrors final card layout.
          const GyfSkeleton(height: 220),
          const SizedBox(height: GyfSpacing.s16),
          const GyfSkeleton(width: 160, height: GyfSpacing.s20),
          const SizedBox(height: GyfSpacing.s12),
          const Row(
            children: [
              Expanded(child: GyfSkeleton(height: 180)),
              SizedBox(width: GyfSpacing.s12),
              Expanded(child: GyfSkeleton(height: 180)),
            ],
          ),
        ],
      ),
    );
  }
}
