import 'package:flutter/material.dart';

/// Typography tokens (02_DESIGN_SYSTEM Part 3).
///
/// Line heights: Display 110%, Heading 120%, Body 150%, Caption 140%.
/// Letter-spacing: Display −1%, Caption +1%, Buttons +0.5%.
/// Tabular numerals for prices/stats/dates via [tabularFeatures].
abstract final class GyfTypography {
  static const List<FontFeature> tabularFeatures = [
    FontFeature.tabularFigures(),
  ];

  static TextStyle _style(
    double size,
    FontWeight weight,
    double heightPct, {
    double spacingPct = 0,
  }) =>
      TextStyle(
        fontSize: size,
        fontWeight: weight,
        height: heightPct / 100,
        letterSpacing: size * spacingPct / 100,
      );

  static final TextStyle displayXL =
      _style(64, FontWeight.w800, 110, spacingPct: -1);
  static final TextStyle displayL =
      _style(56, FontWeight.w800, 110, spacingPct: -1);
  static final TextStyle displayM =
      _style(48, FontWeight.w800, 110, spacingPct: -1);
  static final TextStyle h1 = _style(40, FontWeight.w700, 120);
  static final TextStyle h2 = _style(34, FontWeight.w700, 120);
  static final TextStyle h3 = _style(28, FontWeight.w700, 120);
  static final TextStyle h4 = _style(24, FontWeight.w600, 120);
  static final TextStyle h5 = _style(20, FontWeight.w600, 120);
  static final TextStyle title = _style(18, FontWeight.w600, 120);
  static final TextStyle bodyLarge = _style(17, FontWeight.w400, 150);
  static final TextStyle body = _style(16, FontWeight.w400, 150);
  static final TextStyle bodySmall = _style(14, FontWeight.w400, 150);
  static final TextStyle caption =
      _style(12, FontWeight.w400, 140, spacingPct: 1);
  static final TextStyle micro =
      _style(11, FontWeight.w500, 140, spacingPct: 1);
  static final TextStyle button =
      _style(16, FontWeight.w600, 120, spacingPct: 0.5);
  static final TextStyle label = _style(14, FontWeight.w500, 140);

  /// Maps token styles into Material [TextTheme] slots so Material
  /// components pick them up automatically.
  static TextTheme textTheme(Color primary, Color secondary) => TextTheme(
        displayLarge: displayXL.copyWith(color: primary),
        displayMedium: displayL.copyWith(color: primary),
        displaySmall: displayM.copyWith(color: primary),
        headlineLarge: h1.copyWith(color: primary),
        headlineMedium: h2.copyWith(color: primary),
        headlineSmall: h3.copyWith(color: primary),
        titleLarge: h4.copyWith(color: primary),
        titleMedium: h5.copyWith(color: primary),
        titleSmall: title.copyWith(color: primary),
        bodyLarge: bodyLarge.copyWith(color: primary),
        bodyMedium: body.copyWith(color: primary),
        bodySmall: bodySmall.copyWith(color: secondary),
        labelLarge: button.copyWith(color: primary),
        labelMedium: label.copyWith(color: secondary),
        labelSmall: micro.copyWith(color: secondary),
      );
}
