import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/design_tokens/design_tokens.dart';
import '../services/haptic_service.dart';

/// Wishlist heart (06_COMPONENT_LIBRARY Part 8).
/// Save: fill + scale 1.00 → 1.15 → 1.00 + success haptic.
/// Remove: selection haptic only.
class GyfWishlistButton extends ConsumerStatefulWidget {
  const GyfWishlistButton({
    required this.saved,
    required this.onChanged,
    this.loading = false,
    super.key,
  });

  final bool saved;
  final ValueChanged<bool> onChanged;
  final bool loading;

  @override
  ConsumerState<GyfWishlistButton> createState() => _GyfWishlistButtonState();
}

class _GyfWishlistButtonState extends ConsumerState<GyfWishlistButton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulse;
  late final Animation<double> _scale;

  @override
  void initState() {
    super.initState();
    _pulse = AnimationController(vsync: this, duration: GyfMotion.standard);
    _scale = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 1.0, end: 1.15), weight: 1),
      TweenSequenceItem(tween: Tween(begin: 1.15, end: 1.0), weight: 1),
    ]).animate(CurvedAnimation(parent: _pulse, curve: GyfCurve.enter));
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  void _toggle() {
    final saving = !widget.saved;
    if (saving) {
      _pulse.forward(from: 0);
      ref.read(hapticServiceProvider).emit(GyfHaptic.success);
    } else {
      ref.read(hapticServiceProvider).emit(GyfHaptic.selection);
    }
    widget.onChanged(saving);
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<GyfColorScheme>()!;
    return Semantics(
      button: true,
      label: widget.saved ? 'Remove from wishlist' : 'Save to wishlist',
      toggled: widget.saved,
      child: IconButton(
        onPressed: widget.loading ? null : _toggle,
        constraints: const BoxConstraints(
          minWidth: GyfSpacing.touchTargetMin,
          minHeight: GyfSpacing.touchTargetMin,
        ),
        icon: widget.loading
            ? const SizedBox(
                width: GyfIconSize.sm,
                height: GyfIconSize.sm,
                child: CircularProgressIndicator(
                  strokeWidth: GyfBorderWidth.focus,
                ),
              )
            : ScaleTransition(
                scale: _scale,
                child: Icon(
                  widget.saved ? Icons.favorite : Icons.favorite_border,
                  color: widget.saved ? colors.error : colors.textSecondary,
                  size: GyfIconSize.md,
                ),
              ),
      ),
    );
  }
}
