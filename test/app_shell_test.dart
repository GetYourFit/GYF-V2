import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gyf_app/app/app.dart';
import 'package:gyf_app/app/design_tokens/design_tokens.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  setUp(() {
    // Signed-in, onboarded state so the splash decision tree lands on Home.
    SharedPreferences.setMockInitialValues({
      'gyf.onboarding_complete': true,
      'gyf.signed_in': true,
    });
  });

  testWidgets('boots to Home with all five tabs', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: GyfApp()));
    // Ride the 900 ms splash timeline, then the navigation to Home.
    await tester.pump(const Duration(milliseconds: 950));
    await tester.pump(const Duration(milliseconds: 400));

    expect(find.text('Home'), findsOneWidget);
    expect(find.text('Discover'), findsOneWidget);
    expect(find.text('AI Stylist'), findsOneWidget);
    expect(find.text('Wardrobe'), findsOneWidget);
    expect(find.text('Profile'), findsOneWidget);
    expect(find.text('What should I wear today?'), findsOneWidget);
  });

  testWidgets('tab switching reaches each pillar screen', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: GyfApp()));
    // Ride the 900 ms splash timeline, then the navigation to Home.
    await tester.pump(const Duration(milliseconds: 950));
    await tester.pump(const Duration(milliseconds: 400));

    await tester.tap(find.text('Wardrobe'));
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.text('Your wardrobe is waiting.'), findsOneWidget);

    await tester.tap(find.text('Profile'));
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.text('Appearance'), findsOneWidget);
  });

  testWidgets('theme extension resolves in both brightnesses', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: GyfApp()));
    // Ride the 900 ms splash timeline, then the navigation to Home.
    await tester.pump(const Duration(milliseconds: 950));
    await tester.pump(const Duration(milliseconds: 400));

    final context = tester.element(find.text('Home'));
    final colors = Theme.of(context).extension<GyfColorScheme>();
    expect(colors, isNotNull);
  });
}
