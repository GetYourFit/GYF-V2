import 'package:flutter/material.dart';

import '../../../../core/widgets/gyf_empty_state.dart';

/// AI Stylist — conversational experience (05_SCREEN_SPECIFICATIONS
/// Part 4) — Phase 3.3.
class AiStylistScreen extends StatelessWidget {
  const AiStylistScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const SafeArea(
      child: GyfEmptyState(
        headline: 'Your AI Stylist is on its way.',
        description:
            'Conversations, outfit generation, and explanations land in Phase 3.',
      ),
    );
  }
}
