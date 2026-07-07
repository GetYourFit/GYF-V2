import 'package:flutter/material.dart';

import '../../app/design_tokens/design_tokens.dart';

/// Stepped progress indicator (06 Part 7) — the persistent onboarding
/// progress bar. [current] is 0-based; completed segments fill with the
/// brand color, the active segment animates its fill.
class GyfSteppedProgress extends StatelessWidget {
  const GyfSteppedProgress({
    required this.stepCount,
    required this.current,
    super.key,
  });

  final int stepCount;
  final int current;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<GyfColorScheme>()!;
    return Semantics(
      label: 'Step ${current + 1} of $stepCount',
      value: '${current + 1}',
      child: Row(
        children: [
          for (var i = 0; i < stepCount; i++) ...[
            if (i > 0) const SizedBox(width: GyfSpacing.s4),
            Expanded(
              child: AnimatedContainer(
                duration: GyfMotion.standard,
                curve: GyfCurve.enter,
                height: GyfSpacing.s4,
                decoration: BoxDecoration(
                  color: i <= current ? colors.primary : colors.borderLight,
                  borderRadius: BorderRadius.circular(GyfRadius.pill),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// Linear progress with the app's rounded pill shape (06 Part 7).
class GyfLinearProgress extends StatelessWidget {
  const GyfLinearProgress({this.value, super.key});

  /// Null renders the indeterminate variant.
  final double? value;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(GyfRadius.pill),
      child: LinearProgressIndicator(value: value, minHeight: GyfSpacing.s4),
    );
  }
}
