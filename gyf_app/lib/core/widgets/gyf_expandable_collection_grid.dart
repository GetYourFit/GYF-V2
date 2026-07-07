import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/design_tokens/design_tokens.dart';
import '../animations/animation_manager.dart';
import '../services/haptic_service.dart';
import 'gyf_badge.dart';
import 'gyf_empty_state.dart';
import 'gyf_error_state.dart';
import 'gyf_overlays.dart';
import 'gyf_primary_button.dart';
import 'gyf_secondary_button.dart';
import 'gyf_product_card.dart';
import 'gyf_skeleton.dart';

/// One product entry of a collection (mocked-repo payload shape,
/// FEATURE_EXPANDABLE_COLLECTION_GRID §Component Properties).
class GyfCollectionProduct {
  const GyfCollectionProduct({
    required this.brand,
    required this.name,
    required this.price,
    this.imageUrl,
    this.matchPercent,
    this.aiReason,
    this.sizes = const [],
    this.saved = false,
  });

  final String brand;
  final String name;
  final String price;
  final String? imageUrl;
  final int? matchPercent;
  final String? aiReason;
  final List<String> sizes;
  final bool saved;
}

enum GyfCollectionStatus { loaded, loading, empty, error }

/// Expandable Collection Grid (FEATURE_EXPANDABLE_COLLECTION_GRID) —
/// GYF's signature in-place collection component. One implementation
/// powers every collection type; collections expand inside the page
/// (never navigate), preserving browsing context.
///
/// Motion: expand 250–300 ms — selection haptic → header elevation →
/// height expansion → card fade-in with 40–50 ms stagger (opacity +
/// translateY + scale 0.98→1.00, no bounce). Collapse reverses in
/// 200–250 ms. Reduced motion skips the height animation.
class GyfExpandableCollectionGrid extends ConsumerStatefulWidget {
  const GyfExpandableCollectionGrid({
    required this.title,
    required this.products,
    this.subtitle,
    this.compatibilityScore,
    this.updatedLabel,
    this.previewCount = 4,
    this.initiallyExpanded = false,
    this.status = GyfCollectionStatus.loaded,
    this.columns = 2,
    this.showAIReason = true,
    this.showExpandButton = true,
    this.onProductTap,
    this.onSavedChanged,
    this.onGenerate,
    this.onRetry,
    super.key,
  });

  final String title;
  final String? subtitle;
  final List<GyfCollectionProduct> products;
  final int? compatibilityScore;
  final String? updatedLabel;
  final int previewCount;
  final bool initiallyExpanded;
  final GyfCollectionStatus status;

  /// Responsive column count: 2 phone / 3 large phone / 4 tablet /
  /// 5–6 large tablet — resolved by the host from GyfBreakpoints.
  final int columns;
  final bool showAIReason;
  final bool showExpandButton;
  final void Function(GyfCollectionProduct product)? onProductTap;
  final void Function(GyfCollectionProduct product, bool saved)? onSavedChanged;
  final VoidCallback? onGenerate;
  final VoidCallback? onRetry;

  @override
  ConsumerState<GyfExpandableCollectionGrid> createState() =>
      _GyfExpandableCollectionGridState();
}

class _GyfExpandableCollectionGridState
    extends ConsumerState<GyfExpandableCollectionGrid>
    with SingleTickerProviderStateMixin {
  late bool _expanded = widget.initiallyExpanded;

  // Drives the staggered card reveal on expand. Created eagerly in
  // initState — a lazy `late` here would first instantiate the ticker
  // inside dispose() when the grid is never expanded.
  late final AnimationController _reveal;

  @override
  void initState() {
    super.initState();
    _reveal = AnimationController(
      vsync: this,
      duration: GyfMotion.medium,
      value: widget.initiallyExpanded ? 1 : 0,
    );
  }

  @override
  void dispose() {
    _reveal.dispose();
    super.dispose();
  }

  void _toggle() {
    final haptics = ref.read(hapticServiceProvider);
    setState(() => _expanded = !_expanded);
    if (_expanded) {
      haptics.emit(GyfHaptic.selection);
      haptics.emit(GyfHaptic.light);
      _reveal.forward(from: 0);
    } else {
      haptics.emit(GyfHaptic.selection);
      _reveal.value = 0;
    }
    // Announce expanded state to assistive tech.
    final announcement = _expanded
        ? '${widget.title} expanded. Showing ${widget.products.length} items.'
        : '${widget.title} collapsed.';
    SemanticsBinding.instance.platformDispatcher.views.isNotEmpty
        ? SemanticsService.sendAnnouncement(
            View.of(context),
            announcement,
            TextDirection.ltr,
          )
        : null;
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<GyfColorScheme>()!;
    final anim = ref.watch(animationManagerProvider);

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(GyfRadius.xl),
        border: Border.all(color: colors.borderLight),
        boxShadow: _expanded ? GyfShadows.md : GyfShadows.xs,
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _CollectionHeader(
            title: widget.title,
            subtitle: widget.showAIReason ? widget.subtitle : null,
            itemCount: widget.products.length,
            compatibilityScore: widget.compatibilityScore,
            updatedLabel: widget.updatedLabel,
            expanded: _expanded,
            showExpandButton:
                widget.showExpandButton && widget.products.isNotEmpty,
            onToggle: _toggle,
          ),
          AnimatedSize(
            duration: anim.essential(GyfMotion.medium),
            curve: GyfCurve.emphasized,
            alignment: Alignment.topCenter,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(
                GyfSpacing.s16,
                0,
                GyfSpacing.s16,
                GyfSpacing.s16,
              ),
              child: _body(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _body() {
    switch (widget.status) {
      case GyfCollectionStatus.loading:
        // Skeleton cards mirror the final grid — never spinners.
        return _grid([
          for (var i = 0; i < widget.previewCount; i++)
            const GyfSkeleton(height: 180),
        ]);
      case GyfCollectionStatus.empty:
        return GyfEmptyState(
          headline: 'Nothing here yet.',
          description: 'Your stylist can put a collection together for you.',
          primaryLabel: 'Generate collection',
          onPrimary: widget.onGenerate,
        );
      case GyfCollectionStatus.error:
        return GyfErrorState(
          variant: GyfErrorVariant.retry,
          onPrimary: widget.onRetry,
        );
      case GyfCollectionStatus.loaded:
        final visible = _expanded
            ? widget.products
            : widget.products.take(widget.previewCount).toList();
        final hidden = widget.products.length - visible.length;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _grid([
              for (final (i, product) in visible.indexed)
                _StaggeredReveal(
                  animation: _reveal,
                  // Cards already visible collapsed don't re-animate.
                  index: _expanded ? i - widget.previewCount : -1,
                  child: _card(product),
                ),
            ]),
            if (!_expanded && hidden > 0) ...[
              const SizedBox(height: GyfSpacing.s12),
              GyfGhostButton(label: '+$hidden more', onPressed: _toggle),
            ],
            if (_expanded) ...[
              const SizedBox(height: GyfSpacing.s12),
              GyfGhostButton(label: 'Collapse', onPressed: _toggle),
            ],
          ],
        );
    }
  }

  Widget _grid(List<Widget> children) {
    return LayoutBuilder(
      builder: (context, constraints) {
        // Product cards are image (3:4 of card width) + a text block of
        // roughly fixed height, so a fixed aspect ratio overflows at some
        // widths — size rows explicitly instead.
        final itemWidth =
            (constraints.maxWidth - GyfSpacing.s12 * (widget.columns - 1)) /
                widget.columns;
        final extent = itemWidth * 4 / 3 + 168;
        return GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: widget.columns,
            mainAxisSpacing: GyfSpacing.s12,
            crossAxisSpacing: GyfSpacing.s12,
            mainAxisExtent: extent,
          ),
          itemCount: children.length,
          itemBuilder: (context, i) => children[i],
        );
      },
    );
  }

  Widget _card(GyfCollectionProduct product) {
    return GyfProductCard(
      brand: product.brand,
      name: product.name,
      price: product.price,
      imageUrl: product.imageUrl,
      matchPercent: product.matchPercent,
      saved: product.saved,
      onSavedChanged: widget.onSavedChanged != null
          ? (saved) => widget.onSavedChanged!(product, saved)
          : null,
      onTap: () => widget.onProductTap != null
          ? widget.onProductTap!(product)
          : _showQuickPreview(product),
    );
  }

  /// Quick Preview bottom sheet — the user never loses collection context.
  void _showQuickPreview(GyfCollectionProduct product) {
    final colors = Theme.of(context).extension<GyfColorScheme>()!;
    GyfOverlays.showSheet<void>(
      context: context,
      ref: ref,
      title: product.name,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            height: 220,
            decoration: BoxDecoration(
              color: colors.surfaceVariant,
              borderRadius: BorderRadius.circular(GyfRadius.lg),
            ),
            alignment: Alignment.center,
            child: Icon(
              Icons.checkroom,
              size: GyfSpacing.s64,
              color: colors.textTertiary,
            ),
          ),
          const SizedBox(height: GyfSpacing.s16),
          Text(product.brand, style: GyfTypography.caption),
          Text(product.name, style: GyfTypography.title),
          const SizedBox(height: GyfSpacing.s8),
          Row(
            children: [
              Text(product.price, style: GyfTypography.title),
              const Spacer(),
              if (product.matchPercent != null)
                GyfConfidenceBadge(percent: product.matchPercent!),
            ],
          ),
          if (product.aiReason != null) ...[
            const SizedBox(height: GyfSpacing.s12),
            Text(
              product.aiReason!,
              style:
                  GyfTypography.bodySmall.copyWith(color: colors.textSecondary),
            ),
          ],
          if (product.sizes.isNotEmpty) ...[
            const SizedBox(height: GyfSpacing.s12),
            Wrap(
              spacing: GyfSpacing.s8,
              children: [
                for (final size in product.sizes)
                  GyfBadge(label: size, variant: GyfBadgeVariant.fresh),
              ],
            ),
          ],
          const SizedBox(height: GyfSpacing.s24),
          GyfPrimaryButton(
            label: 'View details',
            fullWidth: true,
            onPressed: () {
              Navigator.of(context).pop();
              widget.onProductTap?.call(product);
            },
          ),
        ],
      ),
    );
  }
}

class _CollectionHeader extends StatelessWidget {
  const _CollectionHeader({
    required this.title,
    required this.subtitle,
    required this.itemCount,
    required this.compatibilityScore,
    required this.updatedLabel,
    required this.expanded,
    required this.showExpandButton,
    required this.onToggle,
  });

  final String title;
  final String? subtitle;
  final int itemCount;
  final int? compatibilityScore;
  final String? updatedLabel;
  final bool expanded;
  final bool showExpandButton;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<GyfColorScheme>()!;
    return Semantics(
      container: true,
      button: showExpandButton,
      label: '$title, $itemCount looks'
          '${expanded ? ', expanded' : ', collapsed'}',
      child: InkWell(
        onTap: showExpandButton ? onToggle : null,
        child: Padding(
          padding: const EdgeInsets.all(GyfSpacing.s16),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: GyfTypography.title),
                    if (subtitle != null) ...[
                      const SizedBox(height: GyfSpacing.s4),
                      Text(
                        subtitle!,
                        style: GyfTypography.bodySmall
                            .copyWith(color: colors.textSecondary),
                      ),
                    ],
                    const SizedBox(height: GyfSpacing.s4),
                    Text(
                      [
                        '$itemCount looks',
                        if (updatedLabel != null) updatedLabel!,
                      ].join(' · '),
                      style: GyfTypography.caption
                          .copyWith(color: colors.textTertiary),
                    ),
                  ],
                ),
              ),
              if (compatibilityScore != null) ...[
                const SizedBox(width: GyfSpacing.s8),
                GyfConfidenceBadge(percent: compatibilityScore!),
              ],
              if (showExpandButton) ...[
                const SizedBox(width: GyfSpacing.s8),
                AnimatedRotation(
                  turns: expanded ? 0.5 : 0,
                  duration: GyfMotion.standard,
                  curve: GyfCurve.navigate,
                  child: Icon(
                    Icons.expand_more,
                    color: colors.textSecondary,
                    semanticLabel: expanded ? 'Collapse' : 'Expand',
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Per-card reveal: opacity + translateY + scale 0.98→1.00 with a
/// 40–50 ms stagger. [index] < 0 renders immediately (preview cards).
class _StaggeredReveal extends StatelessWidget {
  const _StaggeredReveal({
    required this.animation,
    required this.index,
    required this.child,
  });

  final Animation<double> animation;
  final int index;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (index < 0) return child;
    final startMs = 45.0 * index;
    final totalMs = GyfMotion.medium.inMilliseconds.toDouble();
    final start = (startMs / totalMs).clamp(0.0, 0.9);
    final curved = CurvedAnimation(
      parent: animation,
      curve: Interval(start, 1, curve: GyfCurve.enter),
    );
    return AnimatedBuilder(
      animation: curved,
      builder: (context, child) {
        final t = curved.value;
        return Opacity(
          opacity: t,
          child: Transform.translate(
            offset: Offset(0, GyfSpacing.s12 * (1 - t)),
            child: Transform.scale(scale: 0.98 + 0.02 * t, child: child),
          ),
        );
      },
      child: child,
    );
  }
}
