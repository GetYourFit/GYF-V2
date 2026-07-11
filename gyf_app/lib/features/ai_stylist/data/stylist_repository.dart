import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/widgets/gyf_chat_bubble.dart';

/// One outfit suggestion shown inline under an assistant reply, as a
/// sharp-edged tile (Ref1–4 language, same component as Discover).
class StylistSuggestion {
  const StylistSuggestion({required this.title, required this.matchPercent});

  final String title;
  final int matchPercent;
}

class StylistMessage {
  const StylistMessage({
    required this.role,
    this.text,
    this.loading = false,
    this.suggestions = const [],
    this.prompts = const [],
  });

  final GyfChatRole role;
  final String? text;
  final bool loading;
  final List<StylistSuggestion> suggestions;
  final List<String> prompts;
}

/// Mocked conversation controller — no backend, deterministic replies
/// (16_IMPLEMENTATION_PLAN §2: the UI never depends on backend
/// implementation).
class StylistController extends Notifier<List<StylistMessage>> {
  @override
  List<StylistMessage> build() => const [
    StylistMessage(
      role: GyfChatRole.assistant,
      text: 'What are you dressing for today?',
      prompts: ['Work', 'Date night', 'Weekend'],
    ),
  ];

  Future<void> send(String text) async {
    final trimmed = text.trim();
    if (trimmed.isEmpty) return;

    state = [...state, StylistMessage(role: GyfChatRole.user, text: trimmed)];
    state = [
      ...state,
      const StylistMessage(role: GyfChatRole.assistant, loading: true),
    ];

    await Future<void>.delayed(const Duration(milliseconds: 600));

    state = [
      ...state.sublist(0, state.length - 1),
      const StylistMessage(
        role: GyfChatRole.assistant,
        text: 'Here’s a look built around what you already own.',
        suggestions: [
          StylistSuggestion(
            title: 'Linen shirt + tapered chinos',
            matchPercent: 94,
          ),
          StylistSuggestion(
            title: 'Oversized knit + wide trousers',
            matchPercent: 88,
          ),
        ],
        prompts: ['Make it dressier', 'Show more like this', 'Save this look'],
      ),
    ];
  }
}

final stylistControllerProvider =
    NotifierProvider<StylistController, List<StylistMessage>>(
      StylistController.new,
    );
