import 'package:flutter/material.dart';

import '../../app/design_tokens/design_tokens.dart';

/// Shared page chrome for product surfaces: title, optional subtitle,
/// and trailing actions. Keeps the top of every page structurally
/// consistent without forcing one page layout on every screen.
class GyfPageChrome extends StatelessWidget {
  const GyfPageChrome({
    required this.title,
    this.subtitle,
    this.actions,
    this.padding = const EdgeInsets.fromLTRB(
      GyfSpacing.marginStandard,
      GyfSpacing.s16,
      GyfSpacing.marginStandard,
      0,
    ),
    super.key,
  });

  final String title;
  final String? subtitle;
  final List<Widget>? actions;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<GyfColorScheme>()!;
    final text = Theme.of(context).textTheme;

    return Padding(
      padding: padding,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  title,
                  style: text.headlineSmall,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (actions != null && actions!.isNotEmpty) ...[
                const SizedBox(width: GyfSpacing.s12),
                Row(mainAxisSize: MainAxisSize.min, children: actions!),
              ],
            ],
          ),
          if (subtitle != null) ...[
            const SizedBox(height: GyfSpacing.s8),
            Text(
              subtitle!,
              style: GyfTypography.body.copyWith(color: colors.textSecondary),
            ),
          ],
        ],
      ),
    );
  }
}
