import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Launch/session state driving the splash decision tree
/// (05 Part 1): first launch → Onboarding; no session → Welcome/Auth;
/// session valid → Home. Frontend-only: "session" is a persisted flag
/// set by the mocked auth flow, never a real token.
enum GyfLaunchTarget { onboarding, auth, home }

class SessionState {
  const SessionState({
    required this.onboardingComplete,
    required this.signedIn,
    required this.restored,
  });

  final bool onboardingComplete;
  final bool signedIn;

  /// False until prefs have been read; splash waits on this.
  final bool restored;

  GyfLaunchTarget get launchTarget => !onboardingComplete
      ? GyfLaunchTarget.onboarding
      : signedIn
          ? GyfLaunchTarget.home
          : GyfLaunchTarget.auth;

  SessionState copyWith({
    bool? onboardingComplete,
    bool? signedIn,
    bool? restored,
  }) {
    return SessionState(
      onboardingComplete: onboardingComplete ?? this.onboardingComplete,
      signedIn: signedIn ?? this.signedIn,
      restored: restored ?? this.restored,
    );
  }
}

class SessionManager extends Notifier<SessionState> {
  static const _onboardingKey = 'gyf.onboarding_complete';
  static const _signedInKey = 'gyf.signed_in';

  @override
  SessionState build() {
    _restore();
    return const SessionState(
      onboardingComplete: false,
      signedIn: false,
      restored: false,
    );
  }

  Future<void> _restore() async {
    final prefs = await SharedPreferences.getInstance();
    state = SessionState(
      onboardingComplete: prefs.getBool(_onboardingKey) ?? false,
      signedIn: prefs.getBool(_signedInKey) ?? false,
      restored: true,
    );
  }

  Future<void> completeOnboarding() async {
    state = state.copyWith(onboardingComplete: true);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_onboardingKey, true);
  }

  Future<void> signIn() async {
    state = state.copyWith(signedIn: true);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_signedInKey, true);
  }

  Future<void> signOut() async {
    state = state.copyWith(signedIn: false);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_signedInKey, false);
  }
}

final sessionManagerProvider =
    NotifierProvider<SessionManager, SessionState>(SessionManager.new);
