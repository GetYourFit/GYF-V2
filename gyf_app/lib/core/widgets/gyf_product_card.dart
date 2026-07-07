import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../app/design_tokens/design_tokens.dart';
import 'gyf_badge.dart';
import 'gyf_card.dart';
import 'gyf_skeleton.dart';
import 'gyf_wishlist_button.dart';

/// Product card (06_COMPONENT_LIBRARY Part 3): image, brand, name,
/// price, AI match %, wishlist toggle. Backend-independent — takes
/// plain values; images go placeholder → skeleton → fade-in.
class GyfProductCard extends StatelessWidget {
  const GyfProductCard({
    required this.brand,
    required this.name,
    required this.price,
    this.imageUrl,
    this.originalPrice,
    this.matchPercent,
    this.saved = false,
    this.onSavedChanged,
    this.onTap,
    super.key,
  });

  final String brand;
  final String name;
  final String price;
  final String? imageUrl;
  final String? originalPrice;
  final int? matchPercent;
  final bool saved;
  final ValueChanged<bool>? onSavedChanged;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<GyfColorScheme>()!;
    final text = Theme.of(context).textTheme;

    return GyfPressableCard(
      onTap: onTap,
      semanticLabel: '$brand $name, $price'
          '${matchPercent != null ? ', $matchPercent percent match' : ''}',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Stack(
            children: [
              AspectRatio(
                aspectRatio: 3 / 4,
                child: imageUrl == null
                    ? ColoredBox(
                        color: colors.surfaceVariant,
                        child: Icon(
                          Icons.checkroom,
                          size: GyfIconSize.xl,
                          color: colors.textTertiary,
                        ),
                      )
                    : CachedNetworkImage(
                        imageUrl: imageUrl!,
                        fit: BoxFit.cover,
                        fadeInDuration: GyfMotion.quick,
                        placeholder: (context, url) =>
                            const GyfSkeleton(height: double.infinity),
                        errorWidget: (context, url, error) => ColoredBox(
                          color: colors.surfaceVariant,
                          child: Icon(
                            Icons.image_not_supported_outlined,
                            color: colors.textTertiary,
                          ),
                        ),
                      ),
              ),
              if (onSavedChanged != null)
                Positioned(
                  top: GyfSpacing.s4,
                  right: GyfSpacing.s4,
                  child: GyfWishlistButton(
                    saved: saved,
                    onChanged: onSavedChanged!,
                  ),
                ),
            ],
          ),
          Padding(
            padding: const EdgeInsets.all(GyfSpacing.s12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (matchPercent != null) ...[
                  GyfConfidenceBadge(percent: matchPercent!),
                  const SizedBox(height: GyfSpacing.s8),
                ],
                Text(
                  brand,
                  style: text.labelSmall,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: GyfSpacing.s2),
                Text(
                  name,
                  style: text.bodySmall?.copyWith(color: colors.textPrimary),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: GyfSpacing.s8),
                GyfPriceBadge(price: price, originalPrice: originalPrice),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
