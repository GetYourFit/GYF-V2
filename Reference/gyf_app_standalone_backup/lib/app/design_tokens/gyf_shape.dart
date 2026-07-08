import 'package:flutter/material.dart';

/// Radius, border, elevation, shadow, blur, opacity, z-index tokens
/// (02_DESIGN_SYSTEM Part 4).
abstract final class GyfRadius {
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16; // buttons
  static const double xl = 20; // cards
  static const double xxl = 28; // dialogs
  static const double pill = 999; // chips

  static BorderRadius get button => BorderRadius.circular(lg);
  static BorderRadius get card => BorderRadius.circular(xl);
  static BorderRadius get dialog => BorderRadius.circular(xxl);
  static BorderRadius get chip => BorderRadius.circular(pill);
}

abstract final class GyfBorderWidth {
  static const double thin = 0.5;
  static const double regular = 1;
  static const double strong = 1.5;
  static const double focus = 2;
}

/// Shadow tokens — diffuse, low opacity, large blur, minimal offset.
abstract final class GyfShadows {
  static const List<BoxShadow> none = [];

  static const List<BoxShadow> xs = [
    BoxShadow(color: Color(0x0A000000), blurRadius: 4, offset: Offset(0, 1)),
  ];
  static const List<BoxShadow> sm = [
    BoxShadow(color: Color(0x0F000000), blurRadius: 8, offset: Offset(0, 2)),
  ];
  static const List<BoxShadow> md = [
    BoxShadow(color: Color(0x14000000), blurRadius: 16, offset: Offset(0, 4)),
  ];
  static const List<BoxShadow> lg = [
    BoxShadow(color: Color(0x1A000000), blurRadius: 24, offset: Offset(0, 8)),
  ];
  static const List<BoxShadow> xl = [
    BoxShadow(color: Color(0x1F000000), blurRadius: 32, offset: Offset(0, 12)),
  ];
  static const List<BoxShadow> modal = [
    BoxShadow(color: Color(0x29000000), blurRadius: 40, offset: Offset(0, 16)),
  ];
  static const List<BoxShadow> overlay = [
    BoxShadow(color: Color(0x33000000), blurRadius: 48, offset: Offset(0, 20)),
  ];
}

/// Backdrop blur sigmas. Nav bar → sm, sheets → md, dialogs/glass → lg,
/// system overlay → xl.
abstract final class GyfBlur {
  static const double none = 0;
  static const double sm = 8;
  static const double md = 16;
  static const double lg = 24;
  static const double xl = 40;
}

abstract final class GyfOpacity {
  static const double full = 1.0;
  static const double o90 = 0.9;
  static const double o80 = 0.8;
  static const double o60 = 0.6;
  static const double o40 = 0.4;
  static const double o20 = 0.2;
  static const double o10 = 0.1;
  static const double none = 0.0;
}

abstract final class GyfZIndex {
  static const int base = 0;
  static const int floating = 10;
  static const int dialog = 20;
  static const int modal = 30;
  static const int tooltip = 40;
  static const int overlay = 50;
  static const int system = 60;
}
