import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Onboarding steps S006–S020 (05 Part 2), in flow order.
enum OnboardingStep {
  welcome, // S006
  meetStylist, // S007
  permissions, // S008
  goals, // S009
  personality, // S010
  occasions, // S011
  colors, // S012
  brands, // S013
  budget, // S014
  bodyProfile, // S015
  photoCapture, // S016
  aiAnalysis, // S017
  styleDnaReveal, // S018
  dashboardPreview, // S019
  homeTransition, // S020
}

class OnboardingState {
  const OnboardingState({
    required this.step,
    required this.answers,
    this.photoSkipped = false,
  });

  final OnboardingStep step;

  /// Selections keyed by step name; values are the chosen option labels
  /// (or a number for budget). Mocked repository payload, UI-owned.
  final Map<String, Object> answers;

  /// Photo denied/skipped → "describe instead" path (05 Part 2 edge case).
  final bool photoSkipped;

  int get stepIndex => step.index;
  static int get stepCount => OnboardingStep.values.length;

  OnboardingState copyWith({
    OnboardingStep? step,
    Map<String, Object>? answers,
    bool? photoSkipped,
  }) {
    return OnboardingState(
      step: step ?? this.step,
      answers: answers ?? this.answers,
      photoSkipped: photoSkipped ?? this.photoSkipped,
    );
  }
}

/// Drives the S006–S020 flow. Progress is persisted so an interrupted
/// onboarding resumes at the same step (05 Part 2 contract).
class OnboardingController extends Notifier<OnboardingState> {
  static const _stepKey = 'gyf.onboarding_step';

  @override
  OnboardingState build() {
    _restore();
    return const OnboardingState(step: OnboardingStep.welcome, answers: {});
  }

  Future<void> _restore() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getInt(_stepKey);
    if (saved != null && saved > 0 && saved < OnboardingState.stepCount) {
      state = state.copyWith(step: OnboardingStep.values[saved]);
    }
  }

  Future<void> _persistStep() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_stepKey, state.step.index);
  }

  void next() {
    if (state.step.index < OnboardingState.stepCount - 1) {
      state = state.copyWith(step: OnboardingStep.values[state.step.index + 1]);
      _persistStep();
    }
  }

  void back() {
    if (state.step.index > 0) {
      state = state.copyWith(step: OnboardingStep.values[state.step.index - 1]);
      _persistStep();
    }
  }

  void setAnswer(String key, Object value) {
    state = state.copyWith(answers: {...state.answers, key: value});
  }

  void toggleAnswer(String key, String option) {
    final current = (state.answers[key] as List<String>?) ?? const [];
    final updated = current.contains(option)
        ? current.where((o) => o != option).toList()
        : [...current, option];
    setAnswer(key, updated);
  }

  List<String> selections(String key) =>
      (state.answers[key] as List<String>?) ?? const [];

  void skipPhoto() {
    state = state.copyWith(photoSkipped: true);
    next();
  }

  Future<void> reset() async {
    state = const OnboardingState(step: OnboardingStep.welcome, answers: {});
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_stepKey);
  }
}

final onboardingControllerProvider =
    NotifierProvider<OnboardingController, OnboardingState>(
  OnboardingController.new,
);
