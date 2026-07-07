import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gyf_app/app/theme/gyf_theme.dart';
import 'package:gyf_app/features/home/presentation/screens/home_screen.dart';

void main() {
  testWidgets('home loads skeletons then hero + collections', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          theme: GyfTheme.light(),
          home: const Scaffold(body: HomeScreen()),
        ),
      ),
    );
    // Loading state: skeletons, no spinner.
    expect(find.byType(CircularProgressIndicator), findsNothing);

    await tester.pump(const Duration(milliseconds: 500));
    await tester.pump();
    expect(find.text('Linen shirt + tapered chinos'), findsOneWidget);
    expect(find.text('Today’s Picks'), findsOneWidget);
    // Second collection is below the fold in the lazy list.
    await tester.scrollUntilVisible(
      find.text('Trending This Week'),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Trending This Week'), findsOneWidget);
    // Let the staggered entrance animations finish their timers.
    await tester.pumpAndSettle();
  });
}
