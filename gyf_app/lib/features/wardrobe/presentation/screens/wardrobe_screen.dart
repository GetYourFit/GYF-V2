import 'package:flutter/material.dart';

import '../../../../core/widgets/gyf_empty_state.dart';

/// Wardrobe — digital closet (05_SCREEN_SPECIFICATIONS Part 7) —
/// Phase 3.5. Empty-state copy per 11_UX_WRITING_GUIDE.
class WardrobeScreen extends StatelessWidget {
  const WardrobeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: GyfEmptyState(
        headline: 'Your wardrobe is waiting.',
        description:
            'Add your clothes to unlock outfits made from what you own.',
        primaryLabel: 'Add clothing',
        onPrimary: () {},
      ),
    );
  }
}
