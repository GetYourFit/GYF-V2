import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/design_tokens/design_tokens.dart';
import '../animations/animation_manager.dart';
import '../services/haptic_service.dart';

/// Chat bubble (06_COMPONENT_LIBRARY Part 9): user / assistant /
/// loading / error variants.
enum GyfChatRole { user, assistant }

class GyfChatBubble extends StatelessWidget {
  const GyfChatBubble({
    required this.role,
    this.text,
    this.loading = false,
    this.error = false,
    this.onRetry,
    super.key,
  }) : assert(text != null || loading, 'non-loading bubbles need text');

  final GyfChatRole role;
  final String? text;
  final bool loading;
  final bool error;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<GyfColorScheme>()!;
    final textTheme = Theme.of(context).textTheme;
    final isUser = role == GyfChatRole.user;

    final Widget content;
    if (loading) {
      content = const _AiThinkingIndicator();
    } else if (error) {
      content = Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            text ?? 'Your stylist needs another moment.',
            style: textTheme.bodyMedium?.copyWith(color: colors.error),
          ),
          if (onRetry != null)
            TextButton(onPressed: onRetry, child: const Text('Generate again')),
        ],
      );
    } else {
      content = Text(
        text!,
        style: textTheme.bodyMedium?.copyWith(
          color: isUser ? colors.textInverse : colors.textPrimary,
        ),
      );
    }

    return Align(
      alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: Semantics(
        label: isUser ? 'You said' : 'Your AI stylist said',
        child: Container(
          constraints: BoxConstraints(
            maxWidth: MediaQuery.sizeOf(context).width * 0.78,
          ),
          margin: const EdgeInsets.symmetric(vertical: GyfSpacing.s4),
          padding: const EdgeInsets.symmetric(
            horizontal: GyfSpacing.s16,
            vertical: GyfSpacing.s12,
          ),
          decoration: BoxDecoration(
            color: isUser ? null : colors.surfaceVariant,
            gradient: isUser ? colors.aiGradient : null,
            borderRadius: BorderRadius.only(
              topLeft: const Radius.circular(GyfRadius.xl),
              topRight: const Radius.circular(GyfRadius.xl),
              bottomLeft: Radius.circular(isUser ? GyfRadius.xl : GyfRadius.xs),
              bottomRight: Radius.circular(
                isUser ? GyfRadius.xs : GyfRadius.xl,
              ),
            ),
          ),
          child: content,
        ),
      ),
    );
  }
}

/// Custom AI thinking indicator — never a generic spinner
/// (16_IMPLEMENTATION_PLAN §5.3.7). Three dots pulsing in sequence;
/// static under reduced motion. No haptic during thinking.
class _AiThinkingIndicator extends ConsumerStatefulWidget {
  const _AiThinkingIndicator();

  @override
  ConsumerState<_AiThinkingIndicator> createState() =>
      _AiThinkingIndicatorState();
}

class _AiThinkingIndicatorState extends ConsumerState<_AiThinkingIndicator>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: GyfMotion.cinematic,
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
    return Semantics(
      label: 'Your stylist is thinking',
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, _) {
          return Row(
            mainAxisSize: MainAxisSize.min,
            children: List.generate(3, (i) {
              final phase = (_controller.value * 3 - i).clamp(0.0, 1.0);
              final emphasis = phase < 0.5 ? phase * 2 : (1 - phase) * 2;
              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: GyfSpacing.s2),
                child: Container(
                  width: GyfSpacing.s8,
                  height: GyfSpacing.s8,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: Color.lerp(
                      colors.textTertiary,
                      colors.secondary,
                      emphasis,
                    ),
                  ),
                ),
              );
            }),
          );
        },
      ),
    );
  }
}

/// Follow-up suggestion chip below AI responses (max 5 per response;
/// enforced by the conversation view, not here).
class GyfPromptChip extends ConsumerWidget {
  const GyfPromptChip({required this.label, required this.onTap, super.key});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = Theme.of(context).extension<GyfColorScheme>()!;
    return ActionChip(
      label: Text(label),
      avatar: Icon(
        Icons.auto_awesome,
        size: GyfIconSize.xs,
        color: colors.secondary,
      ),
      onPressed: () {
        ref.read(hapticServiceProvider).emit(GyfHaptic.selection);
        onTap();
      },
    );
  }
}
