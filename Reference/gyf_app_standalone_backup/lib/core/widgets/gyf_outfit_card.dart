import 'package:flutter/material.dart';

import '../../app/design_tokens/design_tokens.dart';
import 'gyf_badge.dart';
import 'gyf_card.dart';
import 'gyf_secondary_button.dart';

/// Outfit card (06_COMPONENT_LIBRARY Part 3): preview, occasion,
/// AI match, items owned vs missing, "Generate again" action.
class GyfOutfitCard extends StatelessWidget {
  const GyfOutfitCard({
    required this.title,
    required this.occasion,
    required this.matchPercent,
    required this.itemsOwned,
    required this.itemsTotal,
    this.preview,
    this.onTap,
    this.onGenerateAgain,
    super.key,
  });

  final String title;
  final String occasion;
  final int matchPercent;
  final int itemsOwned;
  final int itemsTotal;
  final Widget? preview;
  final VoidCallback? onTap;
  final VoidCallback? onGenerateAgain;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<GyfColorScheme>()!;
    final text = Theme.of(context).textTheme;
    final missing = itemsTotal - itemsOwned;

    return GyfPressableCard(
      onTap: onTap,
      semanticLabel:
          '$title outfit for $occasion, $matchPercent percent match, '
          'you own $itemsOwned of $itemsTotal items',
      child: Padding(
        padding: const EdgeInsets.all(GyfSpacing.s16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                GyfBadge(label: occasion, variant: GyfBadgeVariant.fresh),
                const Spacer(),
                GyfConfidenceBadge(percent: matchPercent),
              ],
            ),
            if (preview != null) ...[
              const SizedBox(height: GyfSpacing.s12),
              ClipRRect(
                borderRadius: BorderRadius.circular(GyfRadius.md),
                child: preview,
              ),
            ],
            const SizedBox(height: GyfSpacing.s12),
            Text(title, style: text.titleSmall),
            const SizedBox(height: GyfSpacing.s4),
            Text(
              missing == 0
                  ? 'You own everything in this look.'
                  : 'You own $itemsOwned of $itemsTotal items · $missing to find',
              style: text.bodySmall?.copyWith(color: colors.textSecondary),
            ),
            if (onGenerateAgain != null) ...[
              const SizedBox(height: GyfSpacing.s12),
              GyfSecondaryButton(
                label: 'Generate again',
                icon: Icons.refresh,
                fullWidth: false,
                onPressed: onGenerateAgain,
              ),
            ],
          ],
        ),
      ),
    );
  }
}
