import 'package:flutter/animation.dart';

/// Motion tokens (02_DESIGN_SYSTEM Part 5 — canonical table per
/// 16_IMPLEMENTATION_PLAN §4.5 decision; 14's names alias to these).
/// No local durations anywhere — widgets consume these only.
abstract final class GyfMotion {
  static const Duration instant = Duration.zero;
  static const Duration fast = Duration(milliseconds: 100);
  static const Duration quick = Duration(milliseconds: 150);
  static const Duration standard = Duration(milliseconds: 220);
  static const Duration medium = Duration(milliseconds: 300);
  static const Duration slow = Duration(milliseconds: 450);
  static const Duration hero = Duration(milliseconds: 600);
  static const Duration cinematic = Duration(milliseconds: 900);

  // Navigation animation contract
  static const Duration push = Duration(milliseconds: 250);
  static const Duration pop = standard; // 220 ms
  static const Duration modal = Duration(milliseconds: 180);
  static const Duration dialog = standard; // scale 0.95→1.00 + fade
  static const Duration bottomSheet = medium; // spring 300 ms
  static const Duration tabSwitch = Duration(milliseconds: 180);
  static const Duration themeSwitch = push; // 250 ms fade, no flash

  /// Stagger between cards on list/feed entrances.
  static const Duration staggerMin = Duration(milliseconds: 20);
  static const Duration stagger = Duration(milliseconds: 30);
  static const Duration staggerMax = Duration(milliseconds: 40);
}

abstract final class GyfCurve {
  static const Curve enter = Curves.easeOut;
  static const Curve exit = Curves.easeIn;
  static const Curve navigate = Curves.easeInOut;
  static const Curve spring = Curves.easeOutBack; // hero, AI cards, FAB
  static const Curve emphasized = Curves.easeInOutCubicEmphasized;
  static const Curve linear = Curves.linear;
}
