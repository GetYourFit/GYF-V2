import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gyf_app/app/theme/gyf_theme.dart';
import 'package:gyf_app/core/widgets/gyf_widgets.dart';

/// Golden tests (15_FRONTEND_MASTER_BLUEPRINT DoD: goldens per component).
/// Regenerate with: gyf-flutter test --update-goldens test/goldens_test.dart
Widget host(Widget child, ThemeData theme) => ProviderScope(
  child: MaterialApp(
    debugShowCheckedModeBanner: false,
    theme: theme,
    home: Scaffold(
      body: Center(
        child: Padding(padding: const EdgeInsets.all(16), child: child),
      ),
    ),
  ),
);

Widget sampler() => Column(
  mainAxisSize: MainAxisSize.min,
  crossAxisAlignment: CrossAxisAlignment.start,
  children: [
    GyfPrimaryButton(label: 'Primary', onPressed: () {}),
    const SizedBox(height: 12),
    GyfSecondaryButton(label: 'Secondary', onPressed: () {}),
    const SizedBox(height: 12),
    const GyfTextField(label: 'Email', hint: 'you@example.com'),
    const SizedBox(height: 12),
    const Wrap(
      spacing: 8,
      children: [
        GyfBadge(label: 'AI', variant: GyfBadgeVariant.ai),
        GyfConfidenceBadge(percent: 97),
      ],
    ),
    const SizedBox(height: 12),
    const GyfFilterChip(label: 'Minimal', selected: true),
    const SizedBox(height: 12),
    const GyfSteppedProgress(stepCount: 15, current: 4),
  ],
);

void main() {
  testWidgets('component sampler — light', (tester) async {
    await tester.pumpWidget(host(sampler(), GyfTheme.light()));
    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile('goldens/components_light.png'),
    );
  });

  testWidgets('component sampler — dark', (tester) async {
    await tester.pumpWidget(host(sampler(), GyfTheme.dark()));
    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile('goldens/components_dark.png'),
    );
  });
}
