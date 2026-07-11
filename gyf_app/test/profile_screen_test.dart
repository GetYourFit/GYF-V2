import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gyf_app/app/theme/gyf_theme.dart';
import 'package:gyf_app/features/profile/presentation/screens/profile_screen.dart';

void main() {
  testWidgets('profile is structured into clear sections', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          theme: GyfTheme.light(),
          home: const Scaffold(body: ProfileScreen()),
        ),
      ),
    );

    expect(find.text('Profile'), findsOneWidget);
    expect(find.text('Appearance'), findsOneWidget);
    expect(find.text('Account'), findsOneWidget);
    expect(find.text('Privacy & consent'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('profile stays readable on a narrow phone', (tester) async {
    tester.view.physicalSize = const Size(320, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          theme: GyfTheme.light(),
          home: const Scaffold(body: ProfileScreen()),
        ),
      ),
    );

    expect(tester.takeException(), isNull);
  });
}
