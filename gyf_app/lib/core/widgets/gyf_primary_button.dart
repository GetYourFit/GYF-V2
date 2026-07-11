import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/design_tokens/design_tokens.dart';
import '../services/haptic_service.dart';

/// Primary filled button (06_COMPONENT_LIBRARY Part 1).
///
/// Contract: filled / loading / disabled / icon / full-width variants;
/// press scale 0.98 + light haptic; loading morphs label → spinner.
class GyfPrimaryButton extends ConsumerStatefulWidget {
  const GyfPrimaryButton({
    required this.label,
    this.onPressed,
    this.icon,
    this.loading = false,
    this.fullWidth = true,
    this.semanticHint,
    super.key,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool loading;
  final bool fullWidth;
  final String? semanticHint;

  bool get _enabled => onPressed != null && !loading;

  @override
  ConsumerState<GyfPrimaryButton> createState() => _GyfPrimaryButtonState();
}

class _GyfPrimaryButtonState extends ConsumerState<GyfPrimaryButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<GyfColorScheme>()!;

    final child = AnimatedSwitcher(
      duration: GyfMotion.quick,
      child: widget.loading
          ? SizedBox(
              key: const ValueKey('spinner'),
              width: GyfIconSize.sm,
              height: GyfIconSize.sm,
              child: CircularProgressIndicator(
                strokeWidth: GyfBorderWidth.focus,
                color: colors.textInverse,
              ),
            )
          : Row(
              key: const ValueKey('label'),
              mainAxisSize: MainAxisSize.min,
              children: [
                if (widget.icon != null) ...[
                  Icon(widget.icon, size: GyfIconSize.sm),
                  const SizedBox(width: GyfSpacing.s8),
                ],
                Text(widget.label),
              ],
            ),
    );

    return Semantics(
      button: true,
      enabled: widget._enabled,
      label: widget.label,
      hint: widget.semanticHint,
      child: Listener(
        onPointerDown: widget._enabled
            ? (_) => setState(() => _pressed = true)
            : null,
        onPointerUp: (_) => setState(() => _pressed = false),
        onPointerCancel: (_) => setState(() => _pressed = false),
        child: AnimatedScale(
          scale: _pressed ? 0.98 : 1.0,
          duration: GyfMotion.fast,
          curve: GyfCurve.enter,
          child: SizedBox(
            width: widget.fullWidth ? double.infinity : null,
            child: FilledButton(
              onPressed: widget._enabled
                  ? () {
                      ref.read(hapticServiceProvider).emit(GyfHaptic.light);
                      widget.onPressed!();
                    }
                  : null,
              child: child,
            ),
          ),
        ),
      ),
    );
  }
}
