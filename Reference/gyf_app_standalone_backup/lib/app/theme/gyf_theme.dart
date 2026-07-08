import 'package:flutter/material.dart';

import '../design_tokens/design_tokens.dart';

/// Builds Material [ThemeData] for both brightnesses entirely from
/// design tokens. Zero raw values here beyond token references.
abstract final class GyfTheme {
  static ThemeData light() => _build(GyfColorScheme.light, Brightness.light);
  static ThemeData dark() => _build(GyfColorScheme.dark, Brightness.dark);

  static ThemeData _build(GyfColorScheme c, Brightness brightness) {
    final textTheme = GyfTypography.textTheme(c.textPrimary, c.textSecondary);
    final scheme = ColorScheme(
      brightness: brightness,
      primary: c.primary,
      onPrimary: c.textInverse,
      primaryContainer: c.primaryContainer,
      onPrimaryContainer: c.textPrimary,
      secondary: c.secondary,
      onSecondary: c.textInverse,
      secondaryContainer: c.secondaryContainer,
      onSecondaryContainer: c.textPrimary,
      error: c.error,
      onError: c.textInverse,
      surface: c.surface,
      onSurface: c.textPrimary,
      surfaceContainerHighest: c.surfaceVariant,
      onSurfaceVariant: c.textSecondary,
      outline: c.outline,
      shadow: Colors.black,
      scrim: c.modalScrim,
      inverseSurface: c.textPrimary,
      onInverseSurface: c.surface,
      inversePrimary: c.primaryContainer,
      tertiary: c.info,
      onTertiary: c.textInverse,
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: c.background,
      textTheme: textTheme,
      splashFactory: InkSparkle.splashFactory,
      extensions: [c],
      appBarTheme: AppBarTheme(
        backgroundColor: c.background,
        foregroundColor: c.textPrimary,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleTextStyle: GyfTypography.title.copyWith(color: c.textPrimary),
      ),
      cardTheme: CardThemeData(
        color: c.surface,
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: GyfRadius.card),
        margin: EdgeInsets.zero,
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: c.primary,
          foregroundColor: c.textInverse,
          minimumSize: const Size(
            GyfSpacing.touchTargetMin,
            GyfSpacing.touchTargetRecommended,
          ),
          shape: RoundedRectangleBorder(borderRadius: GyfRadius.button),
          textStyle: GyfTypography.button,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: c.primary,
          side:
              BorderSide(color: c.borderDefault, width: GyfBorderWidth.regular),
          minimumSize: const Size(
            GyfSpacing.touchTargetMin,
            GyfSpacing.touchTargetRecommended,
          ),
          shape: RoundedRectangleBorder(borderRadius: GyfRadius.button),
          textStyle: GyfTypography.button,
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: c.primary,
          minimumSize: const Size(
            GyfSpacing.touchTargetMin,
            GyfSpacing.touchTargetMin,
          ),
          textStyle: GyfTypography.button,
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: c.surfaceVariant,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: GyfSpacing.s16,
          vertical: GyfSpacing.s16,
        ),
        border: OutlineInputBorder(
          borderRadius: GyfRadius.button,
          borderSide: BorderSide(color: c.borderDefault),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: GyfRadius.button,
          borderSide: BorderSide(color: c.borderDefault),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: GyfRadius.button,
          borderSide:
              BorderSide(color: c.borderFocus, width: GyfBorderWidth.focus),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: GyfRadius.button,
          borderSide: BorderSide(color: c.borderError),
        ),
        labelStyle: GyfTypography.label.copyWith(color: c.textSecondary),
        hintStyle: GyfTypography.body.copyWith(color: c.textTertiary),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: c.surfaceVariant,
        selectedColor: c.primaryContainer,
        labelStyle: GyfTypography.label.copyWith(color: c.textPrimary),
        shape: RoundedRectangleBorder(borderRadius: GyfRadius.chip),
        side: BorderSide(color: c.borderDefault, width: GyfBorderWidth.thin),
        padding: const EdgeInsets.symmetric(
          horizontal: GyfSpacing.s12,
          vertical: GyfSpacing.s8,
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: c.surfaceElevated,
        shape: RoundedRectangleBorder(borderRadius: GyfRadius.dialog),
        titleTextStyle: GyfTypography.h5.copyWith(color: c.textPrimary),
        contentTextStyle: GyfTypography.body.copyWith(color: c.textSecondary),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: c.surfaceElevated,
        modalBarrierColor: c.modalScrim,
        showDragHandle: true,
        shape: const RoundedRectangleBorder(
          borderRadius:
              BorderRadius.vertical(top: Radius.circular(GyfRadius.xxl)),
        ),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: brightness == Brightness.light
            ? GyfPalette.neutral900
            : GyfPalette.neutral100,
        contentTextStyle: GyfTypography.bodySmall.copyWith(
          color: brightness == Brightness.light
              ? GyfPalette.neutral0
              : GyfPalette.neutral900,
        ),
        shape: RoundedRectangleBorder(borderRadius: GyfRadius.button),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: c.surface,
        indicatorColor: c.primaryContainer,
        height: 72,
        labelTextStyle: WidgetStatePropertyAll(
          GyfTypography.micro.copyWith(color: c.textSecondary),
        ),
      ),
      dividerTheme: DividerThemeData(
        color: c.borderDefault,
        thickness: GyfBorderWidth.thin,
        space: GyfSpacing.s0,
      ),
      pageTransitionsTheme: const PageTransitionsTheme(
        builders: {
          TargetPlatform.iOS: FadeForwardsPageTransitionsBuilder(),
          TargetPlatform.android: FadeForwardsPageTransitionsBuilder(),
        },
      ),
    );
  }
}

extension GyfThemeContext on BuildContext {
  GyfColorScheme get gyfColors =>
      Theme.of(this).extension<GyfColorScheme>() ?? GyfColorScheme.light;
}
