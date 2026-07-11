import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/design_tokens/design_tokens.dart';
import '../animations/animation_manager.dart';

/// Skeleton building block with shimmer (1.2–1.5 s loop).
/// Compose these to mirror the final layout — never generic rectangles
/// dropped arbitrarily (16_IMPLEMENTATION_PLAN §5.3.7).
class GyfSkeleton extends ConsumerStatefulWidget {
  const GyfSkeleton({
    this.width,
    this.height = GyfSpacing.s16,
    this.borderRadius,
    super.key,
  });

  const GyfSkeleton.circle({required double size, super.key})
    : width = size,
      height = size,
      borderRadius = const BorderRadius.all(Radius.circular(GyfRadius.pill));

  final double? width;
  final double height;
  final BorderRadius? borderRadius;

  @override
  ConsumerState<GyfSkeleton> createState() => _GyfSkeletonState();
}

class _GyfSkeletonState extends ConsumerState<GyfSkeleton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1300),
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (ref.read(animationManagerProvider).reduceMotion) {
      _controller.stop();
    } else {
      _controller.repeat();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<GyfColorScheme>()!;
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        return Container(
          width: widget.width,
          height: widget.height,
          decoration: BoxDecoration(
            borderRadius:
                widget.borderRadius ?? BorderRadius.circular(GyfRadius.sm),
            gradient: LinearGradient(
              begin: Alignment(-1 + 2 * _controller.value, 0),
              end: Alignment(0 + 2 * _controller.value, 0),
              colors: [
                colors.surfaceVariant,
                colors.borderDefault,
                colors.surfaceVariant,
              ],
            ),
          ),
        );
      },
    );
  }
}
