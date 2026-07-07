import 'package:flutter/material.dart';

import '../../app/design_tokens/design_tokens.dart';
import 'gyf_primary_button.dart';

/// One shared empty-state widget, parameterized per feature
/// (16_IMPLEMENTATION_PLAN §5.3.7). Illustration + headline +
/// description + primary CTA (+ optional secondary).
class GyfEmptyState extends StatelessWidget {
  const GyfEmptyState({
    required this.headline,
    required this.description,
    this.illustration,
    this.primaryLabel,
    this.onPrimary,
    this.secondaryLabel,
    this.onSecondary,
    super.key,
  });

  final String headline;
  final String description;
  final Widget? illustration;
  final String? primaryLabel;
  final VoidCallback? onPrimary;
  final String? secondaryLabel;
  final VoidCallback? onSecondary;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(GyfSpacing.s32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (illustration != null) ...[
              illustration!,
              const SizedBox(height: GyfSpacing.s24),
            ],
            Text(headline, style: text.titleLarge, textAlign: TextAlign.center),
            const SizedBox(height: GyfSpacing.s8),
            Text(
              description,
              style: text.bodyMedium,
              textAlign: TextAlign.center,
            ),
            if (primaryLabel != null) ...[
              const SizedBox(height: GyfSpacing.s24),
              GyfPrimaryButton(
                label: primaryLabel!,
                onPressed: onPrimary,
                fullWidth: false,
              ),
            ],
            if (secondaryLabel != null) ...[
              const SizedBox(height: GyfSpacing.s8),
              TextButton(onPressed: onSecondary, child: Text(secondaryLabel!)),
            ],
          ],
        ),
      ),
    );
  }
}
