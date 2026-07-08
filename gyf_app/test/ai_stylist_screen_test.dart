import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gyf_app/app/theme/gyf_theme.dart';
import 'package:gyf_app/features/ai_stylist/presentation/screens/ai_stylist_screen.dart';

void main() {
  Future<void> pumpStylist(WidgetTester tester, {Size? size}) async {
    if (size != null) {
      tester.view.physicalSize = size;
      tester.view.devicePixelRatio = 1;
    }
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          theme: GyfTheme.light(),
          home: const Scaffold(body: AiStylistScreen()),
        ),
      ),
    );
    await tester.pump();
  }

  testWidgets('greets with prompts and renders without overflow',
      (tester) async {
    await pumpStylist(tester);
    expect(find.text('What are you dressing for today?'), findsOneWidget);
    expect(find.text('Work'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('renders without overflow at narrow mobile width',
      (tester) async {
    addTearDown(tester.view.reset);
    await pumpStylist(tester, size: const Size(320, 844));
    expect(tester.takeException(), isNull);
  });

  testWidgets('tapping a prompt sends it and shows suggestions',
      (tester) async {
    await pumpStylist(tester);
    await tester.tap(find.text('Work'));
    await tester.pump();
    expect(find.byType(CircularProgressIndicator), findsNothing);
    await tester.pump(const Duration(milliseconds: 700));
    expect(
      find.text('Here’s a look built around what you already own.'),
      findsOneWidget,
    );
    expect(find.text('Linen shirt + tapered chinos'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('typing and submitting via the composer sends a message',
      (tester) async {
    await pumpStylist(tester);
    await tester.enterText(find.byType(TextField), 'Something casual');
    await tester.testTextInput.receiveAction(TextInputAction.send);
    await tester.pump();
    expect(find.text('Something casual'), findsOneWidget);
    await tester.pump(const Duration(milliseconds: 700));
    expect(tester.takeException(), isNull);
  });
}
