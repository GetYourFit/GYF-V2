import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/design_tokens/design_tokens.dart';
import '../services/haptic_service.dart';

/// Text input (06_COMPONENT_LIBRARY Part 2).
///
/// Contract: label always visible, helper text, validation states,
/// error shake 6 px / 180 ms + error haptic when [errorText] appears.
class GyfTextField extends ConsumerStatefulWidget {
  const GyfTextField({
    required this.label,
    this.controller,
    this.hint,
    this.helperText,
    this.errorText,
    this.successText,
    this.obscureText = false,
    this.keyboardType,
    this.enabled = true,
    this.maxLines = 1,
    this.onChanged,
    this.onSubmitted,
    super.key,
  });

  final String label;
  final TextEditingController? controller;
  final String? hint;
  final String? helperText;
  final String? errorText;
  final String? successText;
  final bool obscureText;
  final TextInputType? keyboardType;
  final bool enabled;
  final int maxLines;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;

  @override
  ConsumerState<GyfTextField> createState() => _GyfTextFieldState();
}

class _GyfTextFieldState extends ConsumerState<GyfTextField>
    with SingleTickerProviderStateMixin {
  static const double _shakeAmplitude = 6;

  late final AnimationController _shake = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 180),
  );
  late bool _obscured = widget.obscureText;

  @override
  void didUpdateWidget(GyfTextField old) {
    super.didUpdateWidget(old);
    if (widget.errorText != null && old.errorText != widget.errorText) {
      _shake.forward(from: 0);
      ref.read(hapticServiceProvider).emit(GyfHaptic.error);
    }
  }

  @override
  void dispose() {
    _shake.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<GyfColorScheme>()!;
    final text = Theme.of(context).textTheme;

    final field = TextField(
      controller: widget.controller,
      obscureText: _obscured,
      keyboardType: widget.keyboardType,
      enabled: widget.enabled,
      maxLines: widget.obscureText ? 1 : widget.maxLines,
      onChanged: widget.onChanged,
      onSubmitted: widget.onSubmitted,
      decoration: InputDecoration(
        hintText: widget.hint,
        errorText: widget.errorText,
        helperText: widget.errorText == null
            ? (widget.successText ?? widget.helperText)
            : null,
        helperStyle: widget.successText != null
            ? GyfTypography.caption.copyWith(color: colors.success)
            : null,
        suffixIcon: widget.obscureText
            ? IconButton(
                onPressed: () => setState(() => _obscured = !_obscured),
                icon: Icon(
                  _obscured
                      ? Icons.visibility_outlined
                      : Icons.visibility_off_outlined,
                  size: GyfIconSize.sm,
                ),
                tooltip: _obscured ? 'Show password' : 'Hide password',
              )
            : (widget.successText != null
                  ? Icon(Icons.check_circle_outline, color: colors.success)
                  : null),
      ),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Label always visible above the field, never floating placeholder.
        Text(
          widget.label,
          style: text.labelMedium?.copyWith(
            color: widget.errorText != null
                ? colors.error
                : colors.textSecondary,
          ),
        ),
        const SizedBox(height: GyfSpacing.s8),
        AnimatedBuilder(
          animation: _shake,
          builder: (context, child) {
            final t = _shake.value;
            // Two full oscillations decaying to zero.
            final dx = _shakeAmplitude * (1 - t) * _oscillation(t);
            return Transform.translate(offset: Offset(dx, 0), child: child);
          },
          child: field,
        ),
      ],
    );
  }

  double _oscillation(double t) {
    const cycles = 2.0;
    return (t * cycles * 2).floor().isEven ? 1 : -1;
  }
}
