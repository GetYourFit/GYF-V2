import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gyf_app/app/theme/gyf_theme.dart';
import 'package:gyf_app/core/services/session_manager.dart';
import 'package:gyf_app/core/widgets/gyf_widgets.dart';
import 'package:gyf_app/features/auth/application/auth_controller.dart';
import 'package:gyf_app/features/onboarding/application/onboarding_controller.dart';
import 'package:shared_preferences/shared_preferences.dart';

Widget host(Widget child, {ThemeData? theme}) => ProviderScope(
  child: MaterialApp(
    theme: theme ?? GyfTheme.light(),
    home: Scaffold(body: Center(child: child)),
  ),
);

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  group('GyfOtpField', () {
    testWidgets('fills boxes and fires onCompleted once', (tester) async {
      String? completed;
      await tester.pumpWidget(
        host(GyfOtpField(onCompleted: (code) => completed = code)),
      );
      await tester.enterText(find.byType(TextField), '123456');
      await tester.pump();
      expect(completed, '123456');
      for (final char in ['1', '2', '3', '4', '5', '6']) {
        expect(find.text(char), findsOneWidget);
      }
    });

    testWidgets('rejects non-digits and caps at length', (tester) async {
      String? completed;
      await tester.pumpWidget(
        host(GyfOtpField(length: 4, onCompleted: (code) => completed = code)),
      );
      await tester.enterText(find.byType(TextField), 'ab12cd345');
      await tester.pump();
      expect(completed, '1234');
    });

    testWidgets('shows error text', (tester) async {
      await tester.pumpWidget(host(const GyfOtpField()));
      await tester.pumpWidget(
        host(const GyfOtpField(errorText: 'Wrong code.')),
      );
      await tester.pumpAndSettle();
      expect(find.text('Wrong code.'), findsOneWidget);
    });
  });

  group('GyfSlider', () {
    testWidgets('renders label and formatted value', (tester) async {
      await tester.pumpWidget(
        host(
          GyfSlider(
            label: 'Budget per item',
            value: 150,
            min: 20,
            max: 500,
            valueLabel: (v) => '\$${v.round()}',
            onChanged: (_) {},
          ),
        ),
      );
      expect(find.text('Budget per item'), findsOneWidget);
      expect(find.text('\$150'), findsOneWidget);
    });
  });

  group('GyfSteppedProgress', () {
    testWidgets('exposes step position to assistive tech', (tester) async {
      await tester.pumpWidget(
        host(const GyfSteppedProgress(stepCount: 15, current: 3)),
      );
      expect(find.bySemanticsLabel('Step 4 of 15'), findsOneWidget);
    });
  });

  group('SessionState launch decision tree', () {
    test('first launch goes to onboarding', () {
      const s = SessionState(
        onboardingComplete: false,
        signedIn: false,
        restored: true,
      );
      expect(s.launchTarget, GyfLaunchTarget.onboarding);
    });

    test('onboarded but signed out goes to auth', () {
      const s = SessionState(
        onboardingComplete: true,
        signedIn: false,
        restored: true,
      );
      expect(s.launchTarget, GyfLaunchTarget.auth);
    });

    test('valid session goes home', () {
      const s = SessionState(
        onboardingComplete: true,
        signedIn: true,
        restored: true,
      );
      expect(s.launchTarget, GyfLaunchTarget.home);
    });
  });

  group('OnboardingController', () {
    test('advances, persists and resumes step across interruption', () async {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final controller = container.read(onboardingControllerProvider.notifier);
      controller.next();
      controller.next();
      // Persistence is fire-and-forget; let it flush.
      await Future<void>.delayed(Duration.zero);

      final resumed = ProviderContainer();
      addTearDown(resumed.dispose);
      resumed.read(onboardingControllerProvider);
      await Future<void>.delayed(Duration.zero);
      expect(
        resumed.read(onboardingControllerProvider).step,
        OnboardingStep.permissions,
      );
    });

    test('toggleAnswer selects and deselects options', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final controller = container.read(onboardingControllerProvider.notifier);
      controller.toggleAnswer('goals', 'Dress better daily');
      expect(controller.selections('goals'), ['Dress better daily']);
      controller.toggleAnswer('goals', 'Dress better daily');
      expect(controller.selections('goals'), isEmpty);
    });

    test('skipPhoto marks describe-instead path and advances', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final controller = container.read(onboardingControllerProvider.notifier);
      while (container.read(onboardingControllerProvider).step !=
          OnboardingStep.photoCapture) {
        controller.next();
      }
      controller.skipPhoto();
      final state = container.read(onboardingControllerProvider);
      expect(state.photoSkipped, isTrue);
      expect(state.step, OnboardingStep.aiAnalysis);
    });
  });

  group('AuthController validation (UX writing copy)', () {
    test('invalid email produces the canonical message', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final controller = container.read(authControllerProvider.notifier);
      expect(controller.validateCredentials('nope', 'longenough1'), isFalse);
      expect(
        container.read(authControllerProvider).emailError,
        'Enter a valid email address.',
      );
    });

    test('mismatched passwords produce the canonical message', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final controller = container.read(authControllerProvider.notifier);
      expect(
        controller.validateCredentials(
          'a@b.co',
          'longenough1',
          confirmPassword: 'different1',
        ),
        isFalse,
      );
      expect(
        container.read(authControllerProvider).passwordError,
        'Passwords don’t match.',
      );
    });

    test('wrong password login fails with recovery copy', () async {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final controller = container.read(authControllerProvider.notifier);
      final ok = await controller.logIn('a@b.co', 'wrongpass1');
      expect(ok, isFalse);
      expect(
        container.read(authControllerProvider).passwordError,
        'That password doesn’t look right. Try again.',
      );
    });

    test('otp 000000 fails, other codes verify', () async {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final controller = container.read(authControllerProvider.notifier);
      expect(await controller.verifyOtp('000000'), isFalse);
      expect(await controller.verifyOtp('123456'), isTrue);
    });
  });
}
