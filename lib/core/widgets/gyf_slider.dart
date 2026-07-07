import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/design_tokens/design_tokens.dart';
import '../services/haptic_service.dart';

/// The one slider style used app-wide (budget, AI creativity —
/// 06_COMPONENT_LIBRARY Part 2). Label always visible, current value
/// rendered through [valueLabel], selection haptic on each division step.
class GyfSlider extends ConsumerWidget {
  const GyfSlider({
    required this.label,
    required this.value,
    required this.onChanged,
    this.min = 0,
    this.max = 1,
    this.divisions,
    this.valueLabel,
    this.enabled = true,
    super.key,
  });

  final String label;
  final double value;
  final ValueChanged<double>? onChanged;
  final double min;
  final double max;
  final int? divisions;
  final String Function(double value)? valueLabel;
  final bool enabled;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = Theme.of(context).extension<GyfColorScheme>()!;
    final text = Theme.of(context).textTheme;
    final display = valueLabel?.call(value) ?? value.toStringAsFixed(0);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              label,
              style: text.labelMedium?.copyWith(color: colors.textSecondary),
            ),
            Text(
              display,
              style: text.labelMedium?.copyWith(color: colors.textBrand),
            ),
          ],
        ),
        Slider(
          value: value.clamp(min, max),
          min: min,
          max: max,
          divisions: divisions,
          label: display,
          onChanged: enabled && onChanged != null
              ? (v) {
                  if (v != value) {
                    ref.read(hapticServiceProvider).emit(GyfHaptic.selection);
                  }
                  onChanged!(v);
                }
              : null,
          semanticFormatterCallback: (v) =>
              '$label: ${valueLabel?.call(v) ?? v.toStringAsFixed(0)}',
        ),
      ],
    );
  }
}
