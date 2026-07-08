import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gyf_app/app/theme/gyf_theme.dart';
import 'package:gyf_app/core/widgets/gyf_widgets.dart';

Widget host(Widget child) => ProviderScope(
      child: MaterialApp(
        theme: GyfTheme.light(),
        home: Scaffold(body: SingleChildScrollView(child: child)),
      ),
    );

List<GyfCollectionProduct> products(int n) => [
      for (var i = 0; i < n; i++)
        GyfCollectionProduct(
          brand: 'Brand',
          name: 'Item ${i + 1}',
          price: '₹999',
        ),
    ];

void main() {
  group('GyfExpandableCollectionGrid', () {
    testWidgets('collapsed shows preview count and +N more', (tester) async {
      await tester.pumpWidget(
        host(
          GyfExpandableCollectionGrid(
            title: 'Summer Essentials',
            products: products(10),
          ),
        ),
      );
      expect(find.text('Item 1'), findsOneWidget);
      expect(find.text('Item 4'), findsOneWidget);
      expect(find.text('Item 5'), findsNothing);
      expect(find.text('+6 more'), findsOneWidget);
    });

    testWidgets('expands in place and collapses again', (tester) async {
      // Tall viewport so lazily built grid rows all render.
      tester.view.physicalSize = const Size(800, 4000);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(
        host(
          GyfExpandableCollectionGrid(
            title: 'Summer Essentials',
            products: products(6),
          ),
        ),
      );
      await tester.tap(find.text('+2 more'));
      await tester.pumpAndSettle();
      expect(find.text('Item 6'), findsOneWidget);
      expect(find.text('Collapse'), findsOneWidget);

      await tester.tap(find.text('Collapse'));
      await tester.pumpAndSettle();
      expect(find.text('Item 6'), findsNothing);
      expect(find.text('+2 more'), findsOneWidget);
    });

    testWidgets('loading renders skeletons, never spinners', (tester) async {
      await tester.pumpWidget(
        host(
          const GyfExpandableCollectionGrid(
            title: 'Loading',
            products: [],
            status: GyfCollectionStatus.loading,
          ),
        ),
      );
      await tester.pump();
      expect(find.byType(GyfSkeleton), findsWidgets);
      expect(find.byType(CircularProgressIndicator), findsNothing);
    });

    testWidgets('error state offers retry recovery', (tester) async {
      var retried = false;
      await tester.pumpWidget(
        host(
          GyfExpandableCollectionGrid(
            title: 'Broken',
            products: const [],
            status: GyfCollectionStatus.error,
            onRetry: () => retried = true,
          ),
        ),
      );
      await tester.tap(find.byType(GyfPrimaryButton));
      expect(retried, isTrue);
    });

    testWidgets('header with compatibility badge does not overflow at 320px',
        (tester) async {
      tester.view.physicalSize = const Size(320, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(
        host(
          GyfExpandableCollectionGrid(
            title: 'Summer Essentials',
            subtitle: 'Curated for warm weather',
            compatibilityScore: 94,
            updatedLabel: 'Updated today',
            products: products(4),
          ),
        ),
      );
      expect(tester.takeException(), isNull);
    });

    testWidgets('header announces item count and state to a11y',
        (tester) async {
      final handle = tester.ensureSemantics();
      await tester.pumpWidget(
        host(
          GyfExpandableCollectionGrid(
            title: 'Summer Essentials',
            products: products(8),
          ),
        ),
      );
      final labels = tester.semantics
          .simulatedAccessibilityTraversal()
          .map((node) => node.label);
      expect(
        labels.any((l) => l.contains('Summer Essentials, 8 looks, collapsed')),
        isTrue,
      );
      handle.dispose();
    });
  });
}
