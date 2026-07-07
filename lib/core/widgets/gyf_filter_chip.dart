import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/design_tokens/design_tokens.dart';
import '../services/haptic_service.dart';

/// Filter chip (06_COMPONENT_LIBRARY Part 5): pill shape, selected /
/// default / disabled states, optional AI-suggested treatment,
/// optional remove affordance (applied filters become removable chips).
class GyfFilterChip extends ConsumerWidget {
  const GyfFilterChip({
    required this.label,
    this.selected = false,
    this.aiSuggested = false,
    this.enabled = true,
    this.onSelected,
    this.onRemoved,
    super.key,
  });

  final String label;
  final bool selected;
  final bool aiSuggested;
  final bool enabled;
  final ValueChanged<bool>? onSelected;
  final VoidCallback? onRemoved;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = Theme.of(context).extension<GyfColorScheme>()!;

    return FilterChip(
      label: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (aiSuggested) ...[
            Icon(
              Icons.auto_awesome,
              size: GyfIconSize.xs,
              color: selected ? colors.textBrand : colors.secondary,
            ),
            const SizedBox(width: GyfSpacing.s4),
          ],
          Text(label),
        ],
      ),
      selected: selected,
      onSelected: enabled && onSelected != null
          ? (value) {
              ref.read(hapticServiceProvider).emit(GyfHaptic.selection);
              onSelected!(value);
            }
          : null,
      onDeleted: onRemoved != null
          ? () {
              ref.read(hapticServiceProvider).emit(GyfHaptic.selection);
              onRemoved!();
            }
          : null,
      deleteIcon: onRemoved != null
          ? const Icon(Icons.close, size: GyfIconSize.xs)
          : null,
      showCheckmark: false,
      side: aiSuggested && !selected
          ? BorderSide(color: colors.secondary, width: GyfBorderWidth.regular)
          : null,
    );
  }
}
