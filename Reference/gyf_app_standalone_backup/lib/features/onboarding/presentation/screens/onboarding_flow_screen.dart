import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/design_tokens/design_tokens.dart';
import '../../../../app/router/gyf_router.dart';
import '../../../../core/services/haptic_service.dart';
import '../../../../core/services/session_manager.dart';
import '../../../../core/widgets/gyf_widgets.dart';
import '../../application/onboarding_controller.dart';

/// Onboarding & StyleDNA creation S006–S020 (05 Part 2, 16 §6.2).
/// One flow screen; steps slide horizontally with a persistent stepped
/// progress indicator. Step complete = selection haptic; StyleDNA reveal
/// = heavy success haptic (flagship moment); finish = medium impact.
class OnboardingFlowScreen extends ConsumerWidget {
  const OnboardingFlowScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(onboardingControllerProvider);
    final controller = ref.read(onboardingControllerProvider.notifier);
    final colors = Theme.of(context).extension<GyfColorScheme>()!;

    final showChrome = state.step != OnboardingStep.welcome &&
        state.step != OnboardingStep.homeTransition;

    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        child: Column(
          children: [
            if (showChrome)
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  GyfSpacing.marginStandard,
                  GyfSpacing.s8,
                  GyfSpacing.marginStandard,
                  GyfSpacing.s16,
                ),
                child: Row(
                  children: [
                    GyfIconButton(
                      icon: Icons.arrow_back,
                      semanticLabel: 'Back',
                      onPressed: controller.back,
                    ),
                    const SizedBox(width: GyfSpacing.s12),
                    Expanded(
                      child: GyfSteppedProgress(
                        stepCount: OnboardingState.stepCount,
                        current: state.stepIndex,
                      ),
                    ),
                    const SizedBox(width: GyfSpacing.s12),
                    if (_isSkippable(state.step))
                      GyfGhostButton(label: 'Skip', onPressed: controller.next)
                    else
                      const SizedBox(width: GyfSpacing.s48),
                  ],
                ),
              ),
            Expanded(
              // Horizontal slide between steps (fade+slide, interruptible).
              child: AnimatedSwitcher(
                duration: GyfMotion.medium,
                switchInCurve: GyfCurve.enter,
                switchOutCurve: GyfCurve.exit,
                transitionBuilder: (child, animation) => FadeTransition(
                  opacity: animation,
                  child: SlideTransition(
                    position: Tween(
                      begin: const Offset(0.08, 0),
                      end: Offset.zero,
                    ).animate(animation),
                    child: child,
                  ),
                ),
                child: KeyedSubtree(
                  key: ValueKey(state.step),
                  child: _stepBody(state.step),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  bool _isSkippable(OnboardingStep step) => switch (step) {
        OnboardingStep.permissions ||
        OnboardingStep.goals ||
        OnboardingStep.personality ||
        OnboardingStep.occasions ||
        OnboardingStep.colors ||
        OnboardingStep.brands ||
        OnboardingStep.bodyProfile =>
          true,
        _ => false,
      };

  Widget _stepBody(OnboardingStep step) => switch (step) {
        OnboardingStep.welcome => const _WelcomeStep(),
        OnboardingStep.meetStylist => const _MeetStylistStep(),
        OnboardingStep.permissions => const _PermissionsStep(),
        OnboardingStep.goals => const _MultiSelectStep(
            answerKey: 'goals',
            headline: 'What brings you to GYF?',
            description: 'Pick as many as you like — your stylist adapts.',
            options: [
              'Dress better daily',
              'Refresh my wardrobe',
              'Find my style',
              'Shop smarter',
              'Special occasion',
              'Keep up with trends',
            ],
          ),
        OnboardingStep.personality => const _MultiSelectStep(
            answerKey: 'personality',
            headline: 'Which styles feel like you?',
            description: 'Choose the looks you gravitate toward.',
            options: [
              'Minimal',
              'Classic',
              'Streetwear',
              'Bold',
              'Romantic',
              'Sporty',
              'Vintage',
              'Editorial',
            ],
          ),
        OnboardingStep.occasions => const _MultiSelectStep(
            answerKey: 'occasions',
            headline: 'What do you dress for most?',
            description: 'We’ll prioritize outfits for these.',
            options: [
              'Work',
              'Casual days',
              'Evenings out',
              'Events',
              'Travel',
              'Working out',
            ],
          ),
        OnboardingStep.colors => const _MultiSelectStep(
            answerKey: 'colors',
            headline: 'Colors you love wearing?',
            description: 'Your palette shapes every recommendation.',
            options: [
              'Neutrals',
              'Earth tones',
              'Pastels',
              'Jewel tones',
              'Monochrome',
              'Brights',
            ],
          ),
        OnboardingStep.brands => const _MultiSelectStep(
            answerKey: 'brands',
            headline: 'Any brands you reach for?',
            description: 'Optional — helps us match your taste and fit.',
            options: [
              'Zara',
              'Uniqlo',
              'COS',
              'Nike',
              'Levi’s',
              'Massimo Dutti',
              'H&M',
              'Adidas',
            ],
          ),
        OnboardingStep.budget => const _BudgetStep(),
        OnboardingStep.bodyProfile => const _MultiSelectStep(
            answerKey: 'bodyProfile',
            headline: 'How do you like clothes to fit?',
            description: 'Fit preference guides every size and cut we pick.',
            options: [
              'Fitted',
              'Regular',
              'Relaxed',
              'Oversized',
            ],
          ),
        OnboardingStep.photoCapture => const _PhotoCaptureStep(),
        OnboardingStep.aiAnalysis => const _AiAnalysisStep(),
        OnboardingStep.styleDnaReveal => const _StyleDnaRevealStep(),
        OnboardingStep.dashboardPreview => const _DashboardPreviewStep(),
        OnboardingStep.homeTransition => const _HomeTransitionStep(),
      };
}

/// Shared step layout: headline, description, content, sticky CTA.
class _StepScaffold extends ConsumerWidget {
  const _StepScaffold({
    required this.headline,
    required this.child,
    this.description,
    this.ctaLabel = 'Continue',
    this.onCta,
    this.ctaEnabled = true,
    this.secondary,
  });

  final String headline;
  final String? description;
  final Widget child;
  final String ctaLabel;
  final VoidCallback? onCta;
  final bool ctaEnabled;
  final Widget? secondary;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = Theme.of(context).extension<GyfColorScheme>()!;
    return Padding(
      padding:
          const EdgeInsets.symmetric(horizontal: GyfSpacing.marginStandard),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: GyfSpacing.s16),
          Text(headline, style: GyfTypography.displayM),
          if (description != null) ...[
            const SizedBox(height: GyfSpacing.s8),
            Text(
              description!,
              style: GyfTypography.body.copyWith(color: colors.textSecondary),
            ),
          ],
          const SizedBox(height: GyfSpacing.s24),
          Expanded(child: child),
          const SizedBox(height: GyfSpacing.s16),
          GyfPrimaryButton(
            label: ctaLabel,
            fullWidth: true,
            onPressed: ctaEnabled && onCta != null
                ? () {
                    ref.read(hapticServiceProvider).emit(GyfHaptic.selection);
                    onCta!();
                  }
                : null,
          ),
          if (secondary != null) ...[
            const SizedBox(height: GyfSpacing.s8),
            Center(child: secondary),
          ],
          const SizedBox(height: GyfSpacing.s16),
        ],
      ),
    );
  }
}

class _WelcomeStep extends ConsumerWidget {
  const _WelcomeStep();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final controller = ref.read(onboardingControllerProvider.notifier);
    return _StepScaffold(
      headline: 'Dress like the best version of you.',
      description:
          'GYF learns your style, your fit, and your budget — then puts '
          'outfits together like a personal stylist would.',
      ctaLabel: 'Get started',
      onCta: controller.next,
      child: Center(
        child: Icon(
          Icons.checkroom,
          size: GyfSpacing.s128,
          color: Theme.of(context).extension<GyfColorScheme>()!.primary,
        ),
      ),
    );
  }
}

class _MeetStylistStep extends ConsumerWidget {
  const _MeetStylistStep();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final controller = ref.read(onboardingControllerProvider.notifier);
    return _StepScaffold(
      headline: 'Meet your AI stylist.',
      description:
          'Ask for outfits, get honest feedback, and understand why every '
          'piece works for you — not just what to buy.',
      onCta: controller.next,
      child: const Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          GyfChatBubble(
            role: GyfChatRole.assistant,
            text: 'Hi! I’m your stylist. Tell me about your day and I’ll put '
                'together something that feels like you.',
          ),
          SizedBox(height: GyfSpacing.s12),
          GyfChatBubble(
            role: GyfChatRole.user,
            text: 'Dinner with friends, smart casual, nothing too loud.',
          ),
        ],
      ),
    );
  }
}

class _PermissionsStep extends ConsumerWidget {
  const _PermissionsStep();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final controller = ref.read(onboardingControllerProvider.notifier);
    final colors = Theme.of(context).extension<GyfColorScheme>()!;
    return _StepScaffold(
      headline: 'A couple of permissions.',
      description: 'Both are optional — you stay in control.',
      onCta: controller.next,
      child: Column(
        children: [
          _PermissionRow(
            icon: Icons.photo_camera_outlined,
            title: 'Camera',
            rationale: 'Snap your clothes to build your digital wardrobe '
                'and get outfit checks.',
            colors: colors,
          ),
          const SizedBox(height: GyfSpacing.s16),
          _PermissionRow(
            icon: Icons.notifications_outlined,
            title: 'Notifications',
            rationale: 'Morning outfit suggestions and price drops on '
                'wishlist items. Never spam.',
            colors: colors,
          ),
        ],
      ),
    );
  }
}

class _PermissionRow extends StatelessWidget {
  const _PermissionRow({
    required this.icon,
    required this.title,
    required this.rationale,
    required this.colors,
  });

  final IconData icon;
  final String title;
  final String rationale;
  final GyfColorScheme colors;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(GyfSpacing.s16),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(GyfRadius.xl),
        border: Border.all(color: colors.borderLight),
      ),
      child: Row(
        children: [
          Icon(icon, color: colors.primary),
          const SizedBox(width: GyfSpacing.s16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: GyfTypography.title),
                const SizedBox(height: GyfSpacing.s4),
                Text(
                  rationale,
                  style: GyfTypography.bodySmall
                      .copyWith(color: colors.textSecondary),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Shared multi-select step (goals / personality / occasions / colors /
/// brands / body profile) — one widget, parameterized, per the
/// empty-state precedent of "one shared widget, parameterized per feature".
class _MultiSelectStep extends ConsumerWidget {
  const _MultiSelectStep({
    required this.answerKey,
    required this.headline,
    required this.description,
    required this.options,
  });

  final String answerKey;
  final String headline;
  final String description;
  final List<String> options;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final controller = ref.read(onboardingControllerProvider.notifier);
    ref.watch(onboardingControllerProvider); // rebuild on selection
    final selected = controller.selections(answerKey);
    return _StepScaffold(
      headline: headline,
      description: description,
      ctaEnabled: selected.isNotEmpty,
      onCta: controller.next,
      child: SingleChildScrollView(
        child: Wrap(
          spacing: GyfSpacing.s8,
          runSpacing: GyfSpacing.s8,
          children: [
            for (final option in options)
              GyfFilterChip(
                label: option,
                selected: selected.contains(option),
                onSelected: (_) => controller.toggleAnswer(answerKey, option),
              ),
          ],
        ),
      ),
    );
  }
}

class _BudgetStep extends ConsumerWidget {
  const _BudgetStep();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final controller = ref.read(onboardingControllerProvider.notifier);
    final state = ref.watch(onboardingControllerProvider);
    final value = (state.answers['budget'] as double?) ?? 150;
    return _StepScaffold(
      headline: 'What’s a comfortable spend?',
      description: 'Per item, roughly. We’ll respect it in every suggestion.',
      onCta: controller.next,
      child: Center(
        child: GyfSlider(
          label: 'Budget per item',
          value: value,
          min: 20,
          max: 500,
          divisions: 24,
          valueLabel: (v) => v >= 500 ? '\$500+' : '\$${v.round()}',
          onChanged: (v) => controller.setAnswer('budget', v),
        ),
      ),
    );
  }
}

class _PhotoCaptureStep extends ConsumerWidget {
  const _PhotoCaptureStep();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final controller = ref.read(onboardingControllerProvider.notifier);
    final colors = Theme.of(context).extension<GyfColorScheme>()!;
    return _StepScaffold(
      headline: 'Add a photo for better matches.',
      description: 'Helps your stylist judge color and fit against you — not a '
          'generic model. You can always do this later.',
      ctaLabel: 'Take a photo',
      onCta: controller.next,
      secondary: GyfGhostButton(
        label: 'Describe myself instead',
        onPressed: controller.skipPhoto,
      ),
      child: Center(
        child: Container(
          width: GyfSpacing.s128 + GyfSpacing.s32,
          height: GyfSpacing.s128 + GyfSpacing.s32,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: colors.borderDefault),
            color: colors.surfaceVariant,
          ),
          child: Icon(
            Icons.photo_camera_outlined,
            size: GyfSpacing.s48,
            color: colors.textTertiary,
          ),
        ),
      ),
    );
  }
}

/// S017 — AI thinking experience. No haptics during analysis (16 §6.2);
/// auto-advances when the mocked analysis completes.
class _AiAnalysisStep extends ConsumerStatefulWidget {
  const _AiAnalysisStep();

  @override
  ConsumerState<_AiAnalysisStep> createState() => _AiAnalysisStepState();
}

class _AiAnalysisStepState extends ConsumerState<_AiAnalysisStep> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    // Mocked analysis latency; real repo call slots in here later.
    _timer = Timer(const Duration(milliseconds: 2200), () {
      if (mounted) {
        ref.read(onboardingControllerProvider.notifier).next();
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<GyfColorScheme>()!;
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const GyfChatBubble(role: GyfChatRole.assistant, loading: true),
          const SizedBox(height: GyfSpacing.s24),
          Text('Reading your style…', style: GyfTypography.title),
          const SizedBox(height: GyfSpacing.s8),
          Text(
            'Matching your picks against thousands of looks.',
            style: GyfTypography.body.copyWith(color: colors.textSecondary),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

/// S018 — StyleDNA reveal: the flagship moment. Heavy success haptic.
class _StyleDnaRevealStep extends ConsumerStatefulWidget {
  const _StyleDnaRevealStep();

  @override
  ConsumerState<_StyleDnaRevealStep> createState() =>
      _StyleDnaRevealStepState();
}

class _StyleDnaRevealStepState extends ConsumerState<_StyleDnaRevealStep> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(hapticServiceProvider).emit(GyfHaptic.heavy);
    });
  }

  @override
  Widget build(BuildContext context) {
    final controller = ref.read(onboardingControllerProvider.notifier);
    final state = ref.watch(onboardingControllerProvider);
    final personality =
        (state.answers['personality'] as List<String>?) ?? const [];
    final colors = Theme.of(context).extension<GyfColorScheme>()!;
    return _StepScaffold(
      headline: 'Your StyleDNA is ready.',
      ctaLabel: 'Show my dashboard',
      onCta: controller.next,
      child: Center(
        child: Container(
          padding: const EdgeInsets.all(GyfSpacing.s24),
          decoration: BoxDecoration(
            gradient: colors.aiGradient,
            borderRadius: BorderRadius.circular(GyfRadius.xl),
            boxShadow: GyfShadows.lg,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.auto_awesome,
                color: colors.textInverse,
                size: GyfSpacing.s40,
              ),
              const SizedBox(height: GyfSpacing.s12),
              Text(
                personality.isEmpty
                    ? 'Modern Explorer'
                    : personality.take(2).join(' · '),
                style:
                    GyfTypography.displayM.copyWith(color: colors.textInverse),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: GyfSpacing.s8),
              Text(
                'Your stylist will build every look around this.',
                style:
                    GyfTypography.bodySmall.copyWith(color: colors.textInverse),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DashboardPreviewStep extends ConsumerWidget {
  const _DashboardPreviewStep();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final controller = ref.read(onboardingControllerProvider.notifier);
    final colors = Theme.of(context).extension<GyfColorScheme>()!;
    return _StepScaffold(
      headline: 'Here’s what you get.',
      description: 'Daily outfits, a smart wardrobe, and a stylist on call.',
      ctaLabel: 'Let’s go',
      onCta: controller.next,
      child: Column(
        children: [
          for (final (icon, title) in [
            (Icons.wb_sunny_outlined, 'A fresh outfit every morning'),
            (Icons.checkroom_outlined, 'Your wardrobe, digitized'),
            (Icons.chat_bubble_outline, 'Ask your stylist anything'),
          ]) ...[
            Row(
              children: [
                Icon(icon, color: colors.primary),
                const SizedBox(width: GyfSpacing.s16),
                Text(title, style: GyfTypography.body),
              ],
            ),
            const SizedBox(height: GyfSpacing.s16),
          ],
        ],
      ),
    );
  }
}

/// S020 — hands off to auth (finish = medium impact, 16 §6.2).
class _HomeTransitionStep extends ConsumerStatefulWidget {
  const _HomeTransitionStep();

  @override
  ConsumerState<_HomeTransitionStep> createState() =>
      _HomeTransitionStepState();
}

class _HomeTransitionStepState extends ConsumerState<_HomeTransitionStep> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      ref.read(hapticServiceProvider).emit(GyfHaptic.medium);
      await ref.read(sessionManagerProvider.notifier).completeOnboarding();
      if (mounted) context.go(GyfRoutes.authWelcome);
    });
  }

  @override
  Widget build(BuildContext context) {
    return const Center(child: GyfSkeleton(width: 120, height: 120));
  }
}
