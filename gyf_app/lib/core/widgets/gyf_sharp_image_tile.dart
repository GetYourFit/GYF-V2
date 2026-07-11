import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/design_tokens/design_tokens.dart';
import '../services/haptic_service.dart';
import 'gyf_badge.dart';
import 'gyf_wishlist_button.dart';

/// Sharp-edged image tile (Ref1–4 masonry language): deliberately no
/// border radius/clip on the image itself — every other surface in the
/// app (cards, chips, sheets) stays rounded per GyfRadius, but explore
/// and stylist suggestion imagery is square-cornered edge to edge.
class GyfSharpImageTile extends ConsumerWidget {
  const GyfSharpImageTile({
    required this.aspectRatio,
    this.title,
    this.subtitle,
    this.matchPercent,
    this.saved,
    this.onSaveChanged,
    this.onTap,
    super.key,
  });

  final double aspectRatio;
  final String? title;
  final String? subtitle;
  final int? matchPercent;
  final bool? saved;
  final ValueChanged<bool>? onSaveChanged;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = Theme.of(context).extension<GyfColorScheme>()!;
    final hasCaption = title != null;

    return Semantics(
      button: onTap != null,
      label: [
        if (title != null) title!,
        if (subtitle != null) subtitle!,
        if (matchPercent != null) '$matchPercent percent match',
      ].join(', '),
      child: GestureDetector(
        onTap: onTap == null
            ? null
            : () {
                ref.read(hapticServiceProvider).emit(GyfHaptic.light);
                onTap!();
              },
        child: Stack(
          children: [
            AspectRatio(
              aspectRatio: aspectRatio,
              // Deliberately no ClipRRect/BorderRadius — sharp corners.
              child: ColoredBox(
                color: colors.surfaceVariant,
                child: Icon(
                  Icons.checkroom,
                  color: colors.textTertiary,
                  size: GyfIconSize.xl,
                ),
              ),
            ),
            if (matchPercent != null)
              Positioned(
                top: GyfSpacing.s8,
                left: GyfSpacing.s8,
                child: GyfConfidenceBadge(percent: matchPercent!),
              ),
            if (saved != null && onSaveChanged != null)
              Positioned(
                top: GyfSpacing.s0,
                right: GyfSpacing.s0,
                child:
                    GyfWishlistButton(saved: saved!, onChanged: onSaveChanged!),
              ),
            if (hasCaption)
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                child: Container(
                  padding: const EdgeInsets.fromLTRB(
                    GyfSpacing.s8,
                    GyfSpacing.s24,
                    GyfSpacing.s8,
                    GyfSpacing.s8,
                  ),
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [Colors.transparent, Colors.black87],
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        title!,
                        style:
                            GyfTypography.label.copyWith(color: Colors.white),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      if (subtitle != null)
                        Text(
                          subtitle!,
                          style: GyfTypography.caption
                              .copyWith(color: Colors.white70),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
