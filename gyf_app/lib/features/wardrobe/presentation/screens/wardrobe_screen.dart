import 'package:flutter/material.dart';

import '../../../../app/design_tokens/design_tokens.dart';
import '../../../../core/widgets/gyf_widgets.dart';

/// Wardrobe — digital closet (05_SCREEN_SPECIFICATIONS Part 7) —
/// Phase 3.5. Empty-state copy per 11_UX_WRITING_GUIDE.
class WardrobeScreen extends StatelessWidget {
  const WardrobeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(
        children: const [
          GyfPageChrome(
            title: 'Wardrobe',
            subtitle: 'Add your clothes to unlock outfits from what you own.',
          ),
          SizedBox(height: GyfSpacing.s16),
          Expanded(
            child: GyfEmptyState(
              headline: 'Your wardrobe is waiting.',
              description:
                  'Add your clothes to unlock outfits made from what you own.',
              primaryLabel: 'Add clothing',
            ),
          ),
        ],
      ),
    );
  }
}
