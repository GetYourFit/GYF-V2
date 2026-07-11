import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gyf_app/app/theme/gyf_theme.dart';
import 'package:gyf_app/core/widgets/gyf_widgets.dart';

Widget host(Widget child, {ThemeData? theme}) => ProviderScope(
      child: MaterialApp(
        theme: theme ?? GyfTheme.light(),
        home: Scaffold(body: Center(child: child)),
      ),
    );

void main() {
  group('GyfConfidenceBadge', () {
    testWidgets('maps percent to quality label', (tester) async {
      await tester.pumpWidget(host(const GyfConfidenceBadge(percent: 97)));
      expect(find.text('97% · Excellent Match'), findsOneWidget);

      await tester.pumpWidget(host(const GyfConfidenceBadge(percent: 62)));
      expect(find.text('62% · Good Match'), findsOneWidget);
    });
  });

  group('GyfWishlistButton', () {
    testWidgets('toggles and reports new value', (tester) async {
      bool? received;
      await tester.pumpWidget(
        host(GyfWishlistButton(saved: false, onChanged: (v) => received = v)),
      );
      await tester.tap(find.byType(GyfWishlistButton));
      await tester.pump(const Duration(milliseconds: 300));
      expect(received, isTrue);
      expect(find.byIcon(Icons.favorite_border), findsOneWidget);
    });

    testWidgets('loading disables interaction', (tester) async {
      var called = false;
      await tester.pumpWidget(
        host(
          GyfWishlistButton(
            saved: false,
            loading: true,
            onChanged: (_) => called = true,
          ),
        ),
      );
      await tester.tap(find.byType(GyfWishlistButton), warnIfMissed: false);
      await tester.pump();
      expect(called, isFalse);
    });
  });

  group('GyfTextField', () {
    testWidgets('shows always-visible label, helper, and error states', (
      tester,
    ) async {
      await tester.pumpWidget(
        host(
          const GyfTextField(
            label: 'Email',
            helperText: 'We never share your email.',
          ),
        ),
      );
      expect(find.text('Email'), findsOneWidget);
      expect(find.text('We never share your email.'), findsOneWidget);

      await tester.pumpWidget(
        host(
          const GyfTextField(
            label: 'Email',
            helperText: 'We never share your email.',
            errorText: 'Enter a valid email address.',
          ),
        ),
      );
      await tester.pump(const Duration(milliseconds: 200));
      expect(find.text('Enter a valid email address.'), findsOneWidget);
      expect(find.text('We never share your email.'), findsNothing);
    });

    testWidgets('password visibility toggles', (tester) async {
      await tester.pumpWidget(
        host(const GyfTextField(label: 'Password', obscureText: true)),
      );
      expect(find.byIcon(Icons.visibility_outlined), findsOneWidget);
      await tester.tap(find.byIcon(Icons.visibility_outlined));
      await tester.pump();
      expect(find.byIcon(Icons.visibility_off_outlined), findsOneWidget);
    });
  });

  group('GyfSearchField', () {
    testWidgets('shows clear button only when text present, and clears', (
      tester,
    ) async {
      await tester.pumpWidget(host(GyfSearchField(onVoice: () {})));
      expect(find.byIcon(Icons.close), findsNothing);
      expect(find.byIcon(Icons.mic_none), findsOneWidget);

      await tester.enterText(find.byType(TextField), 'sneakers');
      await tester.pump();
      expect(find.byIcon(Icons.close), findsOneWidget);
      expect(find.byIcon(Icons.mic_none), findsNothing);

      await tester.tap(find.byIcon(Icons.close));
      await tester.pump();
      expect(find.text('sneakers'), findsNothing);
    });
  });

  group('GyfProductCard', () {
    testWidgets('renders brand, name, prices, and match', (tester) async {
      await tester.pumpWidget(
        host(
          SizedBox(
            width: 240,
            child: GyfProductCard(
              brand: 'Uniqlo',
              name: 'Oxford shirt',
              price: '₹2,499',
              originalPrice: '₹3,999',
              matchPercent: 92,
              onTap: () {},
            ),
          ),
        ),
      );
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.text('Uniqlo'), findsOneWidget);
      expect(find.text('Oxford shirt'), findsOneWidget);
      expect(find.text('₹2,499'), findsOneWidget);
      expect(find.text('₹3,999'), findsOneWidget);
      expect(find.textContaining('92%'), findsOneWidget);
    });
  });

  group('GyfOutfitCard', () {
    testWidgets('states owned vs missing items', (tester) async {
      await tester.pumpWidget(
        host(
          GyfOutfitCard(
            title: 'Smart casual Friday',
            occasion: 'Office',
            matchPercent: 88,
            itemsOwned: 3,
            itemsTotal: 4,
            onGenerateAgain: () {},
          ),
        ),
      );
      expect(find.text('You own 3 of 4 items · 1 to find'), findsOneWidget);
      expect(find.text('Generate again'), findsOneWidget);
    });
  });

  group('GyfChatBubble', () {
    testWidgets('error bubble offers recovery', (tester) async {
      var retried = false;
      await tester.pumpWidget(
        host(
          GyfChatBubble(
            role: GyfChatRole.assistant,
            error: true,
            text: 'Your stylist needs another moment.',
            onRetry: () => retried = true,
          ),
        ),
      );
      await tester.tap(find.text('Generate again'));
      expect(retried, isTrue);
    });
  });

  group('GyfErrorState', () {
    testWidgets('every variant offers a recovery action', (tester) async {
      for (final variant in GyfErrorVariant.values) {
        await tester.pumpWidget(
          host(GyfErrorState(variant: variant, onPrimary: () {})),
        );
        expect(
          find.byType(GyfPrimaryButton),
          findsOneWidget,
          reason: 'variant $variant must offer recovery',
        );
      }
    });
  });

  group('dark theme', () {
    testWidgets('components render under dark ThemeData', (tester) async {
      await tester.pumpWidget(
        host(
          const Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              GyfBadge(label: 'AI', variant: GyfBadgeVariant.ai),
              GyfConfidenceBadge(percent: 80),
              GyfPriceBadge(price: '₹999'),
            ],
          ),
          theme: GyfTheme.dark(),
        ),
      );
      expect(find.text('AI'), findsOneWidget);
    });
  });
}
