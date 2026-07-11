import 'package:flutter/material.dart';

import '../../app/design_tokens/design_tokens.dart';

/// Status badges (06_COMPONENT_LIBRARY Part 8):
/// success / warning / premium / new / AI variants.
enum GyfBadgeVariant { success, warning, premium, fresh, ai }

class GyfBadge extends StatelessWidget {
  const GyfBadge({required this.label, required this.variant, super.key});

  final String label;
  final GyfBadgeVariant variant;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<GyfColorScheme>()!;

    final (Color bg, Color fg, Gradient? gradient) = switch (variant) {
      GyfBadgeVariant.success => (
          colors.success.withValues(alpha: GyfOpacity.o10),
          colors.success,
          null,
        ),
      GyfBadgeVariant.warning => (
          colors.warning.withValues(alpha: GyfOpacity.o10),
          colors.warning,
          null,
        ),
      GyfBadgeVariant.premium => (
          Colors.transparent,
          colors.textInverse,
          colors.premiumGradient,
        ),
      GyfBadgeVariant.fresh => (
          colors.primaryContainer,
          colors.textBrand,
          null,
        ),
      GyfBadgeVariant.ai => (
          Colors.transparent,
          colors.textInverse,
          colors.aiGradient,
        ),
    };

    return Semantics(
      label: label,
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: GyfSpacing.s8,
          vertical: GyfSpacing.s2,
        ),
        decoration: BoxDecoration(
          color: gradient == null ? bg : null,
          gradient: gradient,
          borderRadius: GyfRadius.chip,
        ),
        child: Text(label, style: GyfTypography.micro.copyWith(color: fg)),
      ),
    );
  }
}

/// "97% · Excellent Match" — used app-wide for AI confidence.
class GyfConfidenceBadge extends StatelessWidget {
  const GyfConfidenceBadge({required this.percent, super.key})
      : assert(percent >= 0 && percent <= 100);

  final int percent;

  String get _quality => switch (percent) {
        >= 90 => 'Excellent Match',
        >= 75 => 'Great Match',
        >= 60 => 'Good Match',
        _ => 'Fair Match',
      };

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<GyfColorScheme>()!;
    final color = percent >= 75
        ? colors.success
        : percent >= 60
            ? colors.warning
            : colors.textSecondary;
    return Semantics(
      label: '$percent percent, $_quality',
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: GyfSpacing.s8,
          vertical: GyfSpacing.s2,
        ),
        decoration: BoxDecoration(
          color: color.withValues(alpha: GyfOpacity.o10),
          borderRadius: GyfRadius.chip,
        ),
        child: Text(
          '$percent% · $_quality',
          style: GyfTypography.micro.copyWith(
            color: color,
            fontFeatures: GyfTypography.tabularFeatures,
          ),
        ),
      ),
    );
  }
}

/// Price display with optional strike-through original price.
/// Tabular numerals per typography rules.
class GyfPriceBadge extends StatelessWidget {
  const GyfPriceBadge({required this.price, this.originalPrice, super.key});

  final String price;
  final String? originalPrice;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<GyfColorScheme>()!;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          price,
          style: GyfTypography.bodySmall.copyWith(
            color: colors.textPrimary,
            fontWeight: FontWeight.w600,
            fontFeatures: GyfTypography.tabularFeatures,
          ),
        ),
        if (originalPrice != null) ...[
          const SizedBox(width: GyfSpacing.s8),
          Text(
            originalPrice!,
            style: GyfTypography.caption.copyWith(
              color: colors.textTertiary,
              decoration: TextDecoration.lineThrough,
              fontFeatures: GyfTypography.tabularFeatures,
            ),
          ),
        ],
      ],
    );
  }
}
