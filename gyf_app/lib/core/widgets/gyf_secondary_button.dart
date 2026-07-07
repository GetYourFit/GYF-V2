import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/design_tokens/design_tokens.dart';
import '../services/haptic_service.dart';

/// Secondary (outlined) button (06_COMPONENT_LIBRARY Part 1).
class GyfSecondaryButton extends ConsumerWidget {
  const GyfSecondaryButton({
    required this.label,
    this.onPressed,
    this.icon,
    this.fullWidth = true,
    super.key,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool fullWidth;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Semantics(
      button: true,
      enabled: onPressed != null,
      label: label,
      child: SizedBox(
        width: fullWidth ? double.infinity : null,
        child: OutlinedButton(
          onPressed: onPressed == null
              ? null
              : () {
                  ref.read(hapticServiceProvider).emit(GyfHaptic.selection);
                  onPressed!();
                },
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (icon != null) ...[
                Icon(icon, size: GyfIconSize.sm),
                const SizedBox(width: GyfSpacing.s8),
              ],
              Text(label),
            ],
          ),
        ),
      ),
    );
  }
}

/// Ghost/text button — lowest emphasis.
class GyfGhostButton extends ConsumerWidget {
  const GyfGhostButton({required this.label, this.onPressed, super.key});

  final String label;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Semantics(
      button: true,
      enabled: onPressed != null,
      label: label,
      child: TextButton(
        onPressed: onPressed == null
            ? null
            : () {
                ref.read(hapticServiceProvider).emit(GyfHaptic.selection);
                onPressed!();
              },
        child: Text(label),
      ),
    );
  }
}

/// Icon button with guaranteed 48 dp touch target.
class GyfIconButton extends ConsumerWidget {
  const GyfIconButton({
    required this.icon,
    required this.semanticLabel,
    this.onPressed,
    this.selected = false,
    super.key,
  });

  final IconData icon;
  final String semanticLabel;
  final VoidCallback? onPressed;
  final bool selected;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = Theme.of(context).extension<GyfColorScheme>()!;
    return Semantics(
      button: true,
      enabled: onPressed != null,
      label: semanticLabel,
      selected: selected,
      child: IconButton(
        onPressed: onPressed == null
            ? null
            : () {
                ref.read(hapticServiceProvider).emit(GyfHaptic.selection);
                onPressed!();
              },
        iconSize: GyfIconSize.md,
        constraints: const BoxConstraints(
          minWidth: GyfSpacing.touchTargetMin,
          minHeight: GyfSpacing.touchTargetMin,
        ),
        color: selected ? colors.primary : colors.textSecondary,
        icon: Icon(icon),
      ),
    );
  }
}
