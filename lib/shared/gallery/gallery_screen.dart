import 'package:flutter/material.dart';

import '../../app/design_tokens/design_tokens.dart';
import '../../core/widgets/gyf_empty_state.dart';
import '../../core/widgets/gyf_primary_button.dart';
import '../../core/widgets/gyf_skeleton.dart';

/// Internal component gallery (Phase 1 exit criterion): every shared
/// component in every state, in the active theme. Grows with §5.3.
class GalleryScreen extends StatelessWidget {
  const GalleryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Component gallery')),
      body: ListView(
        padding: const EdgeInsets.all(GyfSpacing.marginStandard),
        children: [
          Text('GyfPrimaryButton', style: text.titleSmall),
          const SizedBox(height: GyfSpacing.s12),
          GyfPrimaryButton(label: 'Default', onPressed: () {}),
          const SizedBox(height: GyfSpacing.s8),
          GyfPrimaryButton(
            label: 'With icon',
            icon: Icons.auto_awesome,
            onPressed: () {},
          ),
          const SizedBox(height: GyfSpacing.s8),
          const GyfPrimaryButton(label: 'Loading', loading: true),
          const SizedBox(height: GyfSpacing.s8),
          const GyfPrimaryButton(label: 'Disabled'),
          const SizedBox(height: GyfSpacing.s32),
          Text('GyfSkeleton', style: text.titleSmall),
          const SizedBox(height: GyfSpacing.s12),
          const GyfSkeleton(height: 120),
          const SizedBox(height: GyfSpacing.s8),
          const Row(
            children: [
              GyfSkeleton.circle(size: GyfSpacing.s48),
              SizedBox(width: GyfSpacing.s12),
              Expanded(child: GyfSkeleton()),
            ],
          ),
          const SizedBox(height: GyfSpacing.s32),
          Text('GyfEmptyState', style: text.titleSmall),
          GyfEmptyState(
            headline: 'Nothing here yet.',
            description: 'This is the shared empty-state component.',
            primaryLabel: 'Primary action',
            onPrimary: () {},
            secondaryLabel: 'Secondary action',
            onSecondary: () {},
          ),
        ],
      ),
    );
  }
}
