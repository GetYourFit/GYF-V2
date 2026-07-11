import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/design_tokens/design_tokens.dart';
import '../../core/widgets/gyf_widgets.dart';

/// Internal component gallery (Phase 1 exit criterion): every shared
/// component in every state, in the active theme. Grows with §5.3.
class GalleryScreen extends ConsumerStatefulWidget {
  const GalleryScreen({super.key});

  @override
  ConsumerState<GalleryScreen> createState() => _GalleryScreenState();
}

class _GalleryScreenState extends ConsumerState<GalleryScreen> {
  bool _saved = false;
  bool _chipSelected = true;
  String? _fieldError;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Component gallery')),
      body: ListView(
        padding: const EdgeInsets.all(GyfSpacing.marginStandard),
        children: [
          _section('Buttons', [
            GyfPrimaryButton(label: 'Primary', onPressed: () {}),
            GyfPrimaryButton(
              label: 'With icon',
              icon: Icons.auto_awesome,
              onPressed: () {},
            ),
            const GyfPrimaryButton(label: 'Loading', loading: true),
            const GyfPrimaryButton(label: 'Disabled'),
            GyfSecondaryButton(label: 'Secondary', onPressed: () {}),
            GyfGhostButton(label: 'Ghost', onPressed: () {}),
            Row(
              children: [
                GyfIconButton(
                  icon: Icons.share_outlined,
                  semanticLabel: 'Share',
                  onPressed: () {},
                ),
                GyfIconButton(
                  icon: Icons.bookmark,
                  semanticLabel: 'Bookmarked',
                  selected: true,
                  onPressed: () {},
                ),
                GyfWishlistButton(
                  saved: _saved,
                  onChanged: (v) => setState(() => _saved = v),
                ),
              ],
            ),
          ]),
          _section('Inputs', [
            const GyfTextField(
              label: 'Email',
              hint: 'you@example.com',
              helperText: 'We never share your email.',
            ),
            GyfTextField(
              label: 'Password',
              obscureText: true,
              errorText: _fieldError,
            ),
            GyfSecondaryButton(
              label: 'Trigger error shake',
              fullWidth: false,
              onPressed: () => setState(
                () => _fieldError =
                    'Passwords don’t match. (${DateTime.now().second})',
              ),
            ),
            const GyfTextField(label: 'Username', successText: 'Available'),
            GyfSearchField(onVoice: () {}, onCamera: () {}),
          ]),
          _section('Chips', [
            Wrap(
              spacing: GyfSpacing.s8,
              children: [
                GyfFilterChip(
                  label: 'Casual',
                  selected: _chipSelected,
                  onSelected: (v) => setState(() => _chipSelected = v),
                ),
                GyfFilterChip(
                  label: 'AI pick',
                  aiSuggested: true,
                  onSelected: (_) {},
                ),
                GyfFilterChip(
                  label: 'Applied',
                  selected: true,
                  onRemoved: () {},
                ),
                const GyfFilterChip(label: 'Disabled', enabled: false),
              ],
            ),
          ]),
          _section('Badges', [
            const Wrap(
              spacing: GyfSpacing.s8,
              runSpacing: GyfSpacing.s8,
              children: [
                GyfBadge(label: 'Success', variant: GyfBadgeVariant.success),
                GyfBadge(label: 'Warning', variant: GyfBadgeVariant.warning),
                GyfBadge(label: 'Premium', variant: GyfBadgeVariant.premium),
                GyfBadge(label: 'New', variant: GyfBadgeVariant.fresh),
                GyfBadge(label: 'AI', variant: GyfBadgeVariant.ai),
                GyfConfidenceBadge(percent: 97),
                GyfConfidenceBadge(percent: 62),
                GyfPriceBadge(price: '₹2,499', originalPrice: '₹3,999'),
              ],
            ),
          ]),
          _section('Expandable collection grid', [
            GyfExpandableCollectionGrid(
              title: 'Summer Essentials',
              subtitle: 'Perfect for warm weather and your neutral wardrobe.',
              compatibilityScore: 94,
              updatedLabel: 'Updated today',
              products: [
                for (var i = 0; i < 10; i++)
                  GyfCollectionProduct(
                    brand: 'Uniqlo',
                    name: 'Linen shirt ${i + 1}',
                    price: '₹1,999',
                    matchPercent: 95 - i * 3,
                    aiReason: 'Complements items you already own.',
                    sizes: const ['S', 'M', 'L'],
                  ),
              ],
              onSavedChanged: (_, __) {},
            ),
            const GyfExpandableCollectionGrid(
              title: 'Loading collection',
              products: [],
              status: GyfCollectionStatus.loading,
            ),
            GyfExpandableCollectionGrid(
              title: 'Empty collection',
              products: const [],
              status: GyfCollectionStatus.empty,
              onGenerate: () {},
            ),
            GyfExpandableCollectionGrid(
              title: 'Broken collection',
              products: const [],
              status: GyfCollectionStatus.error,
              onRetry: () {},
            ),
          ]),
          _section('Cards', [
            SizedBox(
              width: 220,
              child: GyfProductCard(
                brand: 'Uniqlo',
                name: 'Oxford slim-fit shirt, light blue',
                price: '₹2,499',
                originalPrice: '₹3,999',
                matchPercent: 92,
                saved: _saved,
                onSavedChanged: (v) => setState(() => _saved = v),
                onTap: () {},
              ),
            ),
            GyfOutfitCard(
              title: 'Smart casual Friday',
              occasion: 'Office',
              matchPercent: 88,
              itemsOwned: 3,
              itemsTotal: 4,
              onTap: () {},
              onGenerateAgain: () {},
            ),
          ]),
          _section('AI chat', [
            const GyfChatBubble(
              role: GyfChatRole.user,
              text: 'Style my white sneakers for a date.',
            ),
            const GyfChatBubble(
              role: GyfChatRole.assistant,
              text: 'Great choice — white sneakers ground a relaxed date look. '
                  'Try slim dark denim and an open overshirt.',
            ),
            const GyfChatBubble(role: GyfChatRole.assistant, loading: true),
            GyfChatBubble(
              role: GyfChatRole.assistant,
              error: true,
              text: 'Your stylist needs another moment.',
              onRetry: () {},
            ),
            Wrap(
              spacing: GyfSpacing.s8,
              children: [
                GyfPromptChip(label: 'Explain', onTap: () {}),
                GyfPromptChip(label: 'Alternative', onTap: () {}),
              ],
            ),
          ]),
          _section('Overlays & feedback', [
            GyfSecondaryButton(
              label: 'Bottom sheet',
              fullWidth: false,
              onPressed: () => GyfOverlays.showSheet<void>(
                context: context,
                ref: ref,
                title: 'Sort by',
                child: const Text('Sheet content'),
              ),
            ),
            GyfSecondaryButton(
              label: 'Destructive dialog',
              fullWidth: false,
              onPressed: () => GyfOverlays.showConfirmDialog(
                context: context,
                ref: ref,
                title: 'Delete board?',
                message: 'This can’t be undone.',
                confirmLabel: 'Delete',
                destructive: true,
              ),
            ),
            GyfSecondaryButton(
              label: 'Toast with undo',
              fullWidth: false,
              onPressed: () => GyfOverlays.showToast(
                context: context,
                message: 'Removed from wishlist.',
                icon: Icons.favorite_border,
                undoLabel: 'Undo',
                onUndo: () {},
              ),
            ),
          ]),
          _section('States', [
            const GyfSkeleton(height: 120),
            const Row(
              children: [
                GyfSkeleton.circle(size: GyfSpacing.s48),
                SizedBox(width: GyfSpacing.s12),
                Expanded(child: GyfSkeleton()),
              ],
            ),
            GyfEmptyState(
              headline: 'Nothing here yet.',
              description: 'This is the shared empty-state component.',
              primaryLabel: 'Primary action',
              onPrimary: () {},
              secondaryLabel: 'Secondary action',
              onSecondary: () {},
            ),
            GyfErrorState(variant: GyfErrorVariant.offline, onPrimary: () {}),
            GyfErrorState(variant: GyfErrorVariant.ai, onPrimary: () {}),
          ]),
        ].expand((w) => [w, const SizedBox(height: GyfSpacing.s16)]).toList(),
      ),
    );
  }

  Widget _section(String title, List<Widget> children) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: GyfSpacing.s12),
        ...children.expand((w) => [w, const SizedBox(height: GyfSpacing.s8)]),
      ],
    );
  }
}
