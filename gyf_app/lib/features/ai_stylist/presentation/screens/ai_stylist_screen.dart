import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/design_tokens/design_tokens.dart';
import '../../../../core/widgets/gyf_widgets.dart';
import '../../data/stylist_repository.dart';

/// AI Stylist — conversational experience (05_SCREEN_SPECIFICATIONS
/// Part 4). Same visual language as Discover (Ref1–4): outfit
/// suggestions render as sharp-edged tiles inline in the transcript.
/// Phase 3.3.
class AiStylistScreen extends ConsumerStatefulWidget {
  const AiStylistScreen({super.key});

  @override
  ConsumerState<AiStylistScreen> createState() => _AiStylistScreenState();
}

class _AiStylistScreenState extends ConsumerState<AiStylistScreen> {
  final _controller = TextEditingController();
  final _scroll = ScrollController();

  @override
  void dispose() {
    _controller.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _send([String? text]) {
    final value = text ?? _controller.text;
    if (value.trim().isEmpty) return;
    ref.read(stylistControllerProvider.notifier).send(value);
    _controller.clear();
    FocusScope.of(context).unfocus();
  }

  @override
  Widget build(BuildContext context) {
    final messages = ref.watch(stylistControllerProvider);

    return SafeArea(
      child: Column(
        children: [
          Expanded(
            child: ListView.builder(
              controller: _scroll,
              padding: const EdgeInsets.all(GyfSpacing.marginStandard),
              itemCount: messages.length,
              itemBuilder: (context, i) {
                final m = messages[i];
                return Padding(
                  padding: const EdgeInsets.only(bottom: GyfSpacing.s16),
                  child: Column(
                    crossAxisAlignment: m.role == GyfChatRole.user
                        ? CrossAxisAlignment.end
                        : CrossAxisAlignment.start,
                    children: [
                      GyfChatBubble(
                        role: m.role,
                        text: m.text,
                        loading: m.loading,
                      ),
                      if (m.suggestions.isNotEmpty) ...[
                        const SizedBox(height: GyfSpacing.s12),
                        SizedBox(
                          height: 220,
                          child: ListView.separated(
                            scrollDirection: Axis.horizontal,
                            itemCount: m.suggestions.length,
                            separatorBuilder: (_, __) =>
                                const SizedBox(width: GyfSpacing.s12),
                            itemBuilder: (context, j) {
                              final s = m.suggestions[j];
                              return SizedBox(
                                width: 160,
                                child: GyfSharpImageTile(
                                  aspectRatio: 3 / 4,
                                  title: s.title,
                                  matchPercent: s.matchPercent,
                                ),
                              );
                            },
                          ),
                        ),
                      ],
                      if (m.prompts.isNotEmpty) ...[
                        const SizedBox(height: GyfSpacing.s12),
                        Wrap(
                          spacing: GyfSpacing.s8,
                          runSpacing: GyfSpacing.s8,
                          children: [
                            for (final p in m.prompts)
                              GyfPromptChip(label: p, onTap: () => _send(p)),
                          ],
                        ),
                      ],
                    ],
                  ),
                );
              },
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(
              GyfSpacing.marginStandard,
              0,
              GyfSpacing.marginStandard,
              GyfSpacing.s16,
            ),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _controller,
                    textInputAction: TextInputAction.send,
                    onSubmitted: _send,
                    decoration: const InputDecoration(
                      hintText: 'Ask your stylist anything',
                    ),
                  ),
                ),
                const SizedBox(width: GyfSpacing.s8),
                IconButton.filled(
                  onPressed: _send,
                  icon: const Icon(Icons.arrow_upward),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
