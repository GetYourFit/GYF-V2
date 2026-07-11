import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/design_tokens/design_tokens.dart';
import '../services/haptic_service.dart';

/// Shared pressable card base (06_COMPONENT_LIBRARY Part 3 motion
/// contract): pressed scale 0.97 / 120 ms, shadow drop, light haptic.
/// Elevation: default L2 (sm shadow), pressed L1 (xs), selected L3 +
/// accent border.
class GyfPressableCard extends ConsumerStatefulWidget {
  const GyfPressableCard({
    required this.child,
    this.onTap,
    this.selected = false,
    this.semanticLabel,
    super.key,
  });

  final Widget child;
  final VoidCallback? onTap;
  final bool selected;
  final String? semanticLabel;

  @override
  ConsumerState<GyfPressableCard> createState() => _GyfPressableCardState();
}

class _GyfPressableCardState extends ConsumerState<GyfPressableCard> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<GyfColorScheme>()!;
    final enabled = widget.onTap != null;

    return Semantics(
      button: enabled,
      label: widget.semanticLabel,
      selected: widget.selected,
      child: GestureDetector(
        onTapDown: enabled ? (_) => setState(() => _pressed = true) : null,
        onTapUp: enabled ? (_) => setState(() => _pressed = false) : null,
        onTapCancel: enabled ? () => setState(() => _pressed = false) : null,
        onTap: enabled
            ? () {
                ref.read(hapticServiceProvider).emit(GyfHaptic.light);
                widget.onTap!();
              }
            : null,
        child: AnimatedScale(
          scale: _pressed ? 0.97 : 1.0,
          duration: const Duration(milliseconds: 120),
          curve: GyfCurve.enter,
          child: AnimatedContainer(
            duration: GyfMotion.fast,
            decoration: BoxDecoration(
              color: colors.surface,
              borderRadius: GyfRadius.card,
              border: widget.selected
                  ? Border.all(
                      color: colors.borderSelected,
                      width: GyfBorderWidth.strong,
                    )
                  : Border.all(
                      color: colors.borderLight,
                      width: GyfBorderWidth.thin,
                    ),
              boxShadow: _pressed
                  ? GyfShadows.xs
                  : widget.selected
                  ? GyfShadows.md
                  : GyfShadows.sm,
            ),
            child: ClipRRect(borderRadius: GyfRadius.card, child: widget.child),
          ),
        ),
      ),
    );
  }
}
