import 'package:flutter/material.dart';

import '../../app/design_tokens/design_tokens.dart';
import 'gyf_primary_button.dart';

/// Error state (06_COMPONENT_LIBRARY Part 7). Every error offers a
/// recovery path — never a dead end. Copy is calm and actionable
/// (11_UX_WRITING_GUIDE).
enum GyfErrorVariant { offline, retry, permission, unknown, ai, upload }

class GyfErrorState extends StatelessWidget {
  const GyfErrorState({
    required this.variant,
    this.onPrimary,
    this.secondaryLabel,
    this.onSecondary,
    super.key,
  });

  final GyfErrorVariant variant;
  final VoidCallback? onPrimary;
  final String? secondaryLabel;
  final VoidCallback? onSecondary;

  (IconData, String, String, String) get _content => switch (variant) {
    GyfErrorVariant.offline => (
      Icons.wifi_off_outlined,
      'You’re offline.',
      'Check your connection. Anything you saved is still here.',
      'Try again',
    ),
    GyfErrorVariant.retry => (
      Icons.refresh,
      'Something didn’t load.',
      'Give it another try — this usually resolves quickly.',
      'Try again',
    ),
    GyfErrorVariant.permission => (
      Icons.lock_outline,
      'Permission needed.',
      'Allow access in Settings to use this feature.',
      'Open settings',
    ),
    GyfErrorVariant.ai => (
      Icons.auto_awesome_outlined,
      'Your stylist needs another moment.',
      'The AI couldn’t finish that request.',
      'Generate again',
    ),
    GyfErrorVariant.upload => (
      Icons.cloud_upload_outlined,
      'Upload didn’t finish.',
      'Your photo is still on your device — try uploading again.',
      'Retry upload',
    ),
    GyfErrorVariant.unknown => (
      Icons.error_outline,
      'Something went wrong.',
      'Please try again. If it keeps happening, contact support.',
      'Try again',
    ),
  };

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<GyfColorScheme>()!;
    final text = Theme.of(context).textTheme;
    final (icon, headline, description, primaryLabel) = _content;

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(GyfSpacing.s32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: GyfIconSize.xxl, color: colors.textTertiary),
            const SizedBox(height: GyfSpacing.s16),
            Text(headline, style: text.titleLarge, textAlign: TextAlign.center),
            const SizedBox(height: GyfSpacing.s8),
            Text(
              description,
              style: text.bodyMedium,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: GyfSpacing.s24),
            GyfPrimaryButton(
              label: primaryLabel,
              onPressed: onPrimary,
              fullWidth: false,
            ),
            if (secondaryLabel != null) ...[
              const SizedBox(height: GyfSpacing.s8),
              TextButton(onPressed: onSecondary, child: Text(secondaryLabel!)),
            ],
          ],
        ),
      ),
    );
  }
}
