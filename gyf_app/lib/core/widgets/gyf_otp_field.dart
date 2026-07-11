import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/design_tokens/design_tokens.dart';
import '../services/haptic_service.dart';

/// OTP input (06_COMPONENT_LIBRARY Part 2).
///
/// Contract: [length] boxes driven by a single hidden field so autofill,
/// paste and auto-advance all work; error state shakes 6 px / 180 ms with
/// error haptic; [onCompleted] fires once when all digits are entered.
class GyfOtpField extends ConsumerStatefulWidget {
  const GyfOtpField({
    this.length = 6,
    this.errorText,
    this.enabled = true,
    this.onCompleted,
    this.onChanged,
    super.key,
  });

  final int length;
  final String? errorText;
  final bool enabled;
  final ValueChanged<String>? onCompleted;
  final ValueChanged<String>? onChanged;

  @override
  ConsumerState<GyfOtpField> createState() => _GyfOtpFieldState();
}

class _GyfOtpFieldState extends ConsumerState<GyfOtpField>
    with SingleTickerProviderStateMixin {
  static const double _shakeAmplitude = 6;

  final _controller = TextEditingController();
  final _focusNode = FocusNode();
  late final AnimationController _shake = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 180),
  );
  bool _completed = false;

  @override
  void didUpdateWidget(GyfOtpField old) {
    super.didUpdateWidget(old);
    if (widget.errorText != null && old.errorText != widget.errorText) {
      _shake.forward(from: 0);
      ref.read(hapticServiceProvider).emit(GyfHaptic.error);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    _focusNode.dispose();
    _shake.dispose();
    super.dispose();
  }

  void _onChanged(String value) {
    setState(() {});
    widget.onChanged?.call(value);
    if (value.length == widget.length && !_completed) {
      _completed = true;
      ref.read(hapticServiceProvider).emit(GyfHaptic.selection);
      widget.onCompleted?.call(value);
    } else if (value.length < widget.length) {
      _completed = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<GyfColorScheme>()!;
    final text = Theme.of(context).textTheme;
    final value = _controller.text;
    final hasError = widget.errorText != null;

    final boxes = Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        for (var i = 0; i < widget.length; i++) ...[
          if (i > 0) const SizedBox(width: GyfSpacing.s8),
          _OtpBox(
            char: i < value.length ? value[i] : null,
            active: _focusNode.hasFocus && i == value.length,
            error: hasError,
            colors: colors,
            textTheme: text,
          ),
        ],
      ],
    );

    return Semantics(
      label: 'Verification code, ${widget.length} digits',
      textField: true,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          GestureDetector(
            onTap: widget.enabled ? _focusNode.requestFocus : null,
            child: AnimatedBuilder(
              animation: _shake,
              builder: (context, child) {
                final t = _shake.value;
                final dx = _shakeAmplitude * (1 - t) * _oscillation(t);
                return Transform.translate(offset: Offset(dx, 0), child: child);
              },
              child: Stack(
                children: [
                  boxes,
                  // Hidden real field: keeps autofill/paste/keyboard native.
                  Positioned.fill(
                    child: Opacity(
                      opacity: 0,
                      child: TextField(
                        controller: _controller,
                        focusNode: _focusNode,
                        enabled: widget.enabled,
                        keyboardType: TextInputType.number,
                        autofillHints: const [AutofillHints.oneTimeCode],
                        inputFormatters: [
                          FilteringTextInputFormatter.digitsOnly,
                          LengthLimitingTextInputFormatter(widget.length),
                        ],
                        onChanged: _onChanged,
                        decoration: const InputDecoration(
                          border: InputBorder.none,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (hasError) ...[
            const SizedBox(height: GyfSpacing.s8),
            Text(
              widget.errorText!,
              style: GyfTypography.caption.copyWith(color: colors.error),
            ),
          ],
        ],
      ),
    );
  }

  double _oscillation(double t) {
    const cycles = 2.0;
    return (t * cycles * 2).floor().isEven ? 1 : -1;
  }
}

class _OtpBox extends StatelessWidget {
  const _OtpBox({
    required this.char,
    required this.active,
    required this.error,
    required this.colors,
    required this.textTheme,
  });

  final String? char;
  final bool active;
  final bool error;
  final GyfColorScheme colors;
  final TextTheme textTheme;

  @override
  Widget build(BuildContext context) {
    final borderColor = error
        ? colors.borderError
        : active
        ? colors.borderFocus
        : colors.borderDefault;
    return AnimatedContainer(
      duration: GyfMotion.quick,
      curve: GyfCurve.enter,
      width: GyfSpacing.s48,
      height: GyfSpacing.touchTargetRecommended,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(GyfRadius.md),
        border: Border.all(
          color: borderColor,
          width: active || error
              ? GyfBorderWidth.focus
              : GyfBorderWidth.regular,
        ),
      ),
      child: Text(char ?? '', style: textTheme.titleLarge),
    );
  }
}
