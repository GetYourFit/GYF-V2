import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Theme preference manager (16_IMPLEMENTATION_PLAN §5.1.1).
/// Light / Dark / System, persisted. Premium theme is architecture-ready
/// via [GyfThemeChoice] extension without UI exposure yet.
enum GyfThemeChoice { light, dark, system }

class ThemeManager extends Notifier<GyfThemeChoice> {
  static const _prefKey = 'gyf.theme_choice';

  @override
  GyfThemeChoice build() {
    _restore();
    return GyfThemeChoice.system;
  }

  Future<void> _restore() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString(_prefKey);
    if (saved != null) {
      state = GyfThemeChoice.values.asNameMap()[saved] ?? GyfThemeChoice.system;
    }
  }

  Future<void> setChoice(GyfThemeChoice choice) async {
    state = choice;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_prefKey, choice.name);
  }

  ThemeMode get themeMode => switch (state) {
        GyfThemeChoice.light => ThemeMode.light,
        GyfThemeChoice.dark => ThemeMode.dark,
        GyfThemeChoice.system => ThemeMode.system,
      };
}

final themeManagerProvider =
    NotifierProvider<ThemeManager, GyfThemeChoice>(ThemeManager.new);
