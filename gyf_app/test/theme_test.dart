import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gyf_app/app/design_tokens/design_tokens.dart';
import 'package:gyf_app/app/theme/gyf_theme.dart';

void main() {
  test('navigation bar indicator stays neutral', () {
    final theme = GyfTheme.light();
    final colors = theme.extension<GyfColorScheme>()!;
    expect(theme.navigationBarTheme.indicatorColor, colors.surfaceElevated);
  });
}
