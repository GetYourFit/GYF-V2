import 'package:flutter/material.dart';

import '../../app/design_tokens/design_tokens.dart';

enum GyfAppBarVariant { standard, large, transparent }

/// App bar (06 Part 4): standard / large (collapses gracefully on
/// scroll) / transparent. One implementation, token-driven.
class GyfAppBar extends StatelessWidget implements PreferredSizeWidget {
  const GyfAppBar({
    required this.title,
    this.variant = GyfAppBarVariant.standard,
    this.actions,
    this.leading,
    super.key,
  });

  final String title;
  final GyfAppBarVariant variant;
  final List<Widget>? actions;
  final Widget? leading;

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<GyfColorScheme>()!;
    final transparent = variant == GyfAppBarVariant.transparent;
    return AppBar(
      title: Text(title),
      leading: leading,
      actions: actions,
      backgroundColor: transparent ? Colors.transparent : colors.background,
      elevation: 0,
      scrolledUnderElevation: transparent ? 0 : 1,
      surfaceTintColor: Colors.transparent,
    );
  }

  /// Large-title variant for scrollables: collapses into a standard bar.
  static Widget sliver({required String title, List<Widget>? actions}) {
    return Builder(
      builder: (context) {
        final colors = Theme.of(context).extension<GyfColorScheme>()!;
        return SliverAppBar.large(
          title: Text(title),
          actions: actions,
          backgroundColor: colors.background,
          surfaceTintColor: Colors.transparent,
          expandedHeight: GyfSpacing.s128,
        );
      },
    );
  }
}
