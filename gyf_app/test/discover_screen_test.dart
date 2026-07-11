import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gyf_app/app/theme/gyf_theme.dart';
import 'package:gyf_app/features/discover/presentation/screens/discover_screen.dart';

void main() {
  Future<void> pumpDiscover(WidgetTester tester, {Size? size}) async {
    if (size != null) {
      tester.view.physicalSize = size;
      tester.view.devicePixelRatio = 1;
    }
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          theme: GyfTheme.light(),
          home: const Scaffold(body: DiscoverScreen()),
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 500));
    await tester.pump();
  }

  testWidgets('shows category pills, search, and masonry tiles', (
    tester,
  ) async {
    await pumpDiscover(tester);
    expect(find.text('For You'), findsOneWidget);
    expect(find.text('Editorial'), findsOneWidget);
    expect(find.byIcon(Icons.search), findsOneWidget);
    expect(find.text('For You capsule 1'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('renders without overflow at narrow mobile width', (
    tester,
  ) async {
    addTearDown(tester.view.reset);
    await pumpDiscover(tester, size: const Size(320, 844));
    expect(tester.takeException(), isNull);
  });

  testWidgets('selecting a category updates chip selection', (tester) async {
    await pumpDiscover(tester);
    await tester.tap(find.text('Editorial'));
    await tester.pump();
    final chip = tester.widget<FilterChip>(
      find.ancestor(
        of: find.text('Editorial'),
        matching: find.byType(FilterChip),
      ),
    );
    expect(chip.selected, isTrue);
  });

  testWidgets('typing filters the feed immediately', (tester) async {
    await pumpDiscover(tester);
    await tester.enterText(find.byType(TextField), 'A.P.C.');
    await tester.pump();
    expect(find.text('Curated capsule 1'), findsNothing);
    expect(find.textContaining('A.P.C.'), findsWidgets);
  });
}
