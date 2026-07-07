import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/design_tokens/design_tokens.dart';
import '../services/haptic_service.dart';

/// Search field (06_COMPONENT_LIBRARY Part 2): search icon, optional
/// voice + camera entry points, clear button. Focus emits no haptic
/// (07 Part G rule).
class GyfSearchField extends ConsumerStatefulWidget {
  const GyfSearchField({
    this.controller,
    this.hint = 'Search styles, brands, outfits',
    this.onSubmitted,
    this.onVoice,
    this.onCamera,
    this.autofocus = false,
    super.key,
  });

  final TextEditingController? controller;
  final String hint;
  final ValueChanged<String>? onSubmitted;
  final VoidCallback? onVoice;
  final VoidCallback? onCamera;
  final bool autofocus;

  @override
  ConsumerState<GyfSearchField> createState() => _GyfSearchFieldState();
}

class _GyfSearchFieldState extends ConsumerState<GyfSearchField> {
  late final TextEditingController _controller =
      widget.controller ?? TextEditingController();

  @override
  void initState() {
    super.initState();
    _controller.addListener(_onTextChanged);
  }

  void _onTextChanged() => setState(() {});

  @override
  void dispose() {
    _controller.removeListener(_onTextChanged);
    if (widget.controller == null) _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final hasText = _controller.text.isNotEmpty;
    return Semantics(
      textField: true,
      label: 'Search',
      child: TextField(
        controller: _controller,
        autofocus: widget.autofocus,
        textInputAction: TextInputAction.search,
        onSubmitted: widget.onSubmitted,
        decoration: InputDecoration(
          hintText: widget.hint,
          prefixIcon: const Icon(Icons.search, size: GyfIconSize.sm),
          suffixIcon: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (hasText)
                IconButton(
                  onPressed: () {
                    _controller.clear();
                    ref.read(hapticServiceProvider).emit(GyfHaptic.selection);
                  },
                  icon: const Icon(Icons.close, size: GyfIconSize.sm),
                  tooltip: 'Clear search',
                )
              else ...[
                if (widget.onVoice != null)
                  IconButton(
                    onPressed: widget.onVoice,
                    icon: const Icon(Icons.mic_none, size: GyfIconSize.sm),
                    tooltip: 'Voice search',
                  ),
                if (widget.onCamera != null)
                  IconButton(
                    onPressed: widget.onCamera,
                    icon: const Icon(
                      Icons.photo_camera_outlined,
                      size: GyfIconSize.sm,
                    ),
                    tooltip: 'Camera search',
                  ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
