import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/design_tokens/design_tokens.dart';
import '../services/haptic_service.dart';

/// Bottom sheet + dialog + toast entry points (06_COMPONENT_LIBRARY
/// Parts 4/6). These are the only ways features may open overlays, so
/// motion, blur, and haptics stay consistent app-wide.
///
/// Modal hierarchy rules (10_NAVIGATION_BIBLE): dialogs only for
/// delete/logout/reset/permission/critical warnings; bottom sheets for
/// filters/sort/share/quick actions; never stack dialogs.
abstract final class GyfOverlays {
  /// Opens a modal bottom sheet: drag handle, optional title, scrollable
  /// content, drag + tap-outside dismiss, blurred backdrop, selection
  /// haptic on open.
  static Future<T?> showSheet<T>({
    required BuildContext context,
    required WidgetRef ref,
    required Widget child,
    String? title,
    double initialSize = 0.5,
  }) {
    ref.read(hapticServiceProvider).emit(GyfHaptic.selection);
    final colors = Theme.of(context).extension<GyfColorScheme>()!;
    return showModalBottomSheet<T>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      barrierColor: colors.modalScrim,
      builder: (context) => BackdropFilter(
        filter: ImageFilter.blur(sigmaX: GyfBlur.md, sigmaY: GyfBlur.md),
        child: DraggableScrollableSheet(
          expand: false,
          initialChildSize: initialSize,
          minChildSize: 0.25,
          maxChildSize: 1.0,
          builder: (context, scrollController) => Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (title != null)
                Padding(
                  padding: const EdgeInsets.fromLTRB(
                    GyfSpacing.marginStandard,
                    GyfSpacing.s8,
                    GyfSpacing.marginStandard,
                    GyfSpacing.s16,
                  ),
                  child: Text(
                    title,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
              Expanded(
                child: SingleChildScrollView(
                  controller: scrollController,
                  padding: const EdgeInsets.symmetric(
                    horizontal: GyfSpacing.marginStandard,
                  ),
                  child: child,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Confirmation dialog for destructive/critical decisions only.
  /// Returns true when confirmed. Destructive style highlights the
  /// confirm action in error color and emits a warning haptic.
  static Future<bool> showConfirmDialog({
    required BuildContext context,
    required WidgetRef ref,
    required String title,
    required String message,
    required String confirmLabel,
    String cancelLabel = 'Cancel',
    bool destructive = false,
  }) async {
    ref.read(hapticServiceProvider).emit(
          destructive ? GyfHaptic.warning : GyfHaptic.selection,
        );
    final colors = Theme.of(context).extension<GyfColorScheme>()!;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(cancelLabel),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: destructive
                ? TextButton.styleFrom(foregroundColor: colors.error)
                : null,
            child: Text(confirmLabel),
          ),
        ],
      ),
    );
    return confirmed ?? false;
  }

  /// Bottom toast: icon + message + optional undo, auto-dismissed ≤ 3 s,
  /// max 2 lines, never stacks (replaces the current one).
  static void showToast({
    required BuildContext context,
    required String message,
    IconData? icon,
    String? undoLabel,
    VoidCallback? onUndo,
  }) {
    final messenger = ScaffoldMessenger.of(context);
    messenger.hideCurrentSnackBar();
    messenger.showSnackBar(
      SnackBar(
        duration: const Duration(seconds: 3),
        content: Row(
          children: [
            if (icon != null) ...[
              Icon(icon, size: GyfIconSize.sm),
              const SizedBox(width: GyfSpacing.s8),
            ],
            Expanded(
              child: Text(
                message,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
        action: undoLabel != null && onUndo != null
            ? SnackBarAction(label: undoLabel, onPressed: onUndo)
            : null,
      ),
    );
  }
}
