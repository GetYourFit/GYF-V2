import 'package:flutter/material.dart';

/// Foundation color primitives (02_DESIGN_SYSTEM Part 2).
///
/// Never consume these directly in widgets — use [GyfColorScheme]
/// (semantic layer) resolved through the active theme.
abstract final class GyfPalette {
  // Brand
  static const Color indigo900 = Color(0xFF1E1B4B); // brand depth
  static const Color indigo700 = Color(0xFF4338CA); // primary action
  static const Color violet500 = Color(0xFF8B5CF6); // secondary / AI
  static const Color gold500 = Color(0xFFD4AF37); // premium

  // Status
  static const Color emerald600 = Color(0xFF16A34A); // success
  static const Color amber500 = Color(0xFFF59E0B); // warning
  static const Color red600 = Color(0xFFDC2626); // error
  static const Color cyan500 = Color(0xFF06B6D4); // info

  // Neutral scale (12 steps)
  static const Color neutral0 = Color(0xFFFFFFFF);
  static const Color neutral50 = Color(0xFFFAFAFA);
  static const Color neutral100 = Color(0xFFF5F5F5);
  static const Color neutral200 = Color(0xFFE5E5E5);
  static const Color neutral300 = Color(0xFFD4D4D4);
  static const Color neutral400 = Color(0xFFA3A3A3);
  static const Color neutral500 = Color(0xFF737373);
  static const Color neutral600 = Color(0xFF525252);
  static const Color neutral700 = Color(0xFF404040);
  static const Color neutral800 = Color(0xFF262626);
  static const Color neutral900 = Color(0xFF171717);
  static const Color neutral950 = Color(0xFF0A0A0A);

  // Premium set
  static const Color premiumGold = gold500;
  static const Color premiumBronze = Color(0xFFB08D57);
  static const Color premiumIvory = Color(0xFFFFFFF0);
}

/// Semantic color tokens, theme-resolved. One instance per brightness,
/// exposed as a [ThemeExtension] so widgets read
/// `Theme.of(context).extension<GyfColorScheme>()!` (or `context.gyfColors`).
@immutable
class GyfColorScheme extends ThemeExtension<GyfColorScheme> {
  const GyfColorScheme({
    required this.primary,
    required this.primaryContainer,
    required this.secondary,
    required this.secondaryContainer,
    required this.background,
    required this.surface,
    required this.surfaceVariant,
    required this.surfaceElevated,
    required this.overlay,
    required this.modalScrim,
    required this.error,
    required this.warning,
    required this.success,
    required this.info,
    required this.outline,
    required this.textPrimary,
    required this.textSecondary,
    required this.textTertiary,
    required this.textDisabled,
    required this.textInverse,
    required this.textBrand,
    required this.borderDefault,
    required this.borderLight,
    required this.borderFocus,
    required this.borderSelected,
    required this.borderError,
    required this.borderSuccess,
    required this.premiumGold,
    required this.premiumBronze,
    required this.premiumIvory,
    required this.aiGradient,
    required this.premiumGradient,
    required this.successGradient,
    required this.recommendationGradient,
  });

  final Color primary;
  final Color primaryContainer;
  final Color secondary;
  final Color secondaryContainer;
  final Color background;
  final Color surface;
  final Color surfaceVariant;
  final Color surfaceElevated;
  final Color overlay;
  final Color modalScrim;
  final Color error;
  final Color warning;
  final Color success;
  final Color info;
  final Color outline;
  final Color textPrimary;
  final Color textSecondary;
  final Color textTertiary;
  final Color textDisabled;
  final Color textInverse;
  final Color textBrand;
  final Color borderDefault;
  final Color borderLight;
  final Color borderFocus;
  final Color borderSelected;
  final Color borderError;
  final Color borderSuccess;
  final Color premiumGold;
  final Color premiumBronze;
  final Color premiumIvory;

  /// AI thinking / AI-generated identity gradient (indigo → violet).
  final Gradient aiGradient;

  /// Premium identity gradient (gold → amber).
  final Gradient premiumGradient;

  /// Success gradient (emerald → mint).
  final Gradient successGradient;

  /// Recommendation gradient (purple → blue).
  final Gradient recommendationGradient;

  static const GyfColorScheme light = GyfColorScheme(
    primary: GyfPalette.indigo700,
    primaryContainer: Color(0xFFE0E7FF),
    secondary: GyfPalette.violet500,
    secondaryContainer: Color(0xFFEDE9FE),
    background: GyfPalette.neutral50,
    surface: GyfPalette.neutral0,
    surfaceVariant: GyfPalette.neutral100,
    surfaceElevated: GyfPalette.neutral0,
    overlay: Color(0x66000000), // black 40%
    modalScrim: Color(0x99000000), // black 60%
    error: GyfPalette.red600,
    warning: GyfPalette.amber500,
    success: GyfPalette.emerald600,
    info: GyfPalette.cyan500,
    outline: GyfPalette.neutral300,
    textPrimary: GyfPalette.neutral900,
    textSecondary: GyfPalette.neutral600,
    textTertiary: GyfPalette.neutral500,
    textDisabled: GyfPalette.neutral400,
    textInverse: GyfPalette.neutral0,
    textBrand: GyfPalette.indigo700,
    borderDefault: GyfPalette.neutral200,
    borderLight: GyfPalette.neutral100,
    borderFocus: GyfPalette.indigo700,
    borderSelected: GyfPalette.indigo700,
    borderError: GyfPalette.red600,
    borderSuccess: GyfPalette.emerald600,
    premiumGold: GyfPalette.premiumGold,
    premiumBronze: GyfPalette.premiumBronze,
    premiumIvory: GyfPalette.premiumIvory,
    aiGradient: LinearGradient(
      colors: [GyfPalette.indigo700, GyfPalette.violet500],
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
    ),
    premiumGradient: LinearGradient(
      colors: [GyfPalette.gold500, GyfPalette.amber500],
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
    ),
    successGradient: LinearGradient(
      colors: [GyfPalette.emerald600, Color(0xFF6EE7B7)],
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
    ),
    recommendationGradient: LinearGradient(
      colors: [GyfPalette.violet500, Color(0xFF3B82F6)],
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
    ),
  );

  /// Dark theme — no pure black backgrounds.
  static const GyfColorScheme dark = GyfColorScheme(
    primary: Color(0xFF818CF8), // indigo raised for dark contrast
    primaryContainer: Color(0xFF312E81),
    secondary: Color(0xFFA78BFA),
    secondaryContainer: Color(0xFF4C1D95),
    background: Color(0xFF121214),
    surface: GyfPalette.neutral900,
    surfaceVariant: GyfPalette.neutral800,
    surfaceElevated: Color(0xFF1F1F23),
    overlay: Color(0x8A000000),
    modalScrim: Color(0x99000000),
    error: Color(0xFFF87171),
    warning: Color(0xFFFBBF24),
    success: Color(0xFF4ADE80),
    info: Color(0xFF22D3EE),
    outline: GyfPalette.neutral700,
    textPrimary: GyfPalette.neutral100,
    textSecondary: GyfPalette.neutral400,
    textTertiary: GyfPalette.neutral500,
    textDisabled: GyfPalette.neutral600,
    textInverse: GyfPalette.neutral900,
    textBrand: Color(0xFF818CF8),
    borderDefault: GyfPalette.neutral800,
    borderLight: GyfPalette.neutral900,
    borderFocus: Color(0xFF818CF8),
    borderSelected: Color(0xFF818CF8),
    borderError: Color(0xFFF87171),
    borderSuccess: Color(0xFF4ADE80),
    premiumGold: GyfPalette.premiumGold,
    premiumBronze: GyfPalette.premiumBronze,
    premiumIvory: GyfPalette.premiumIvory,
    aiGradient: LinearGradient(
      colors: [Color(0xFF6366F1), Color(0xFFA78BFA)],
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
    ),
    premiumGradient: LinearGradient(
      colors: [GyfPalette.gold500, Color(0xFFFBBF24)],
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
    ),
    successGradient: LinearGradient(
      colors: [Color(0xFF4ADE80), Color(0xFF6EE7B7)],
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
    ),
    recommendationGradient: LinearGradient(
      colors: [Color(0xFFA78BFA), Color(0xFF60A5FA)],
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
    ),
  );

  @override
  GyfColorScheme copyWith({Color? primary}) => this;

  @override
  GyfColorScheme lerp(GyfColorScheme? other, double t) {
    if (other == null) return this;
    Color c(Color a, Color b) => Color.lerp(a, b, t)!;
    return GyfColorScheme(
      primary: c(primary, other.primary),
      primaryContainer: c(primaryContainer, other.primaryContainer),
      secondary: c(secondary, other.secondary),
      secondaryContainer: c(secondaryContainer, other.secondaryContainer),
      background: c(background, other.background),
      surface: c(surface, other.surface),
      surfaceVariant: c(surfaceVariant, other.surfaceVariant),
      surfaceElevated: c(surfaceElevated, other.surfaceElevated),
      overlay: c(overlay, other.overlay),
      modalScrim: c(modalScrim, other.modalScrim),
      error: c(error, other.error),
      warning: c(warning, other.warning),
      success: c(success, other.success),
      info: c(info, other.info),
      outline: c(outline, other.outline),
      textPrimary: c(textPrimary, other.textPrimary),
      textSecondary: c(textSecondary, other.textSecondary),
      textTertiary: c(textTertiary, other.textTertiary),
      textDisabled: c(textDisabled, other.textDisabled),
      textInverse: c(textInverse, other.textInverse),
      textBrand: c(textBrand, other.textBrand),
      borderDefault: c(borderDefault, other.borderDefault),
      borderLight: c(borderLight, other.borderLight),
      borderFocus: c(borderFocus, other.borderFocus),
      borderSelected: c(borderSelected, other.borderSelected),
      borderError: c(borderError, other.borderError),
      borderSuccess: c(borderSuccess, other.borderSuccess),
      premiumGold: c(premiumGold, other.premiumGold),
      premiumBronze: c(premiumBronze, other.premiumBronze),
      premiumIvory: c(premiumIvory, other.premiumIvory),
      aiGradient: Gradient.lerp(aiGradient, other.aiGradient, t)!,
      premiumGradient:
          Gradient.lerp(premiumGradient, other.premiumGradient, t)!,
      successGradient:
          Gradient.lerp(successGradient, other.successGradient, t)!,
      recommendationGradient: Gradient.lerp(
        recommendationGradient,
        other.recommendationGradient,
        t,
      )!,
    );
  }
}
