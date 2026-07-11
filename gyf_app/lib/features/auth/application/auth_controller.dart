import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/mock_auth_repository.dart';

/// Auth form state (07 Part C). Validation copy per 11_UX_WRITING_GUIDE.
class AuthState {
  const AuthState({
    this.loading = false,
    this.emailError,
    this.passwordError,
    this.otpError,
    this.pendingEmail,
  });

  final bool loading;
  final String? emailError;
  final String? passwordError;
  final String? otpError;

  /// Email awaiting OTP verification.
  final String? pendingEmail;

  AuthState copyWith({
    bool? loading,
    String? emailError,
    String? passwordError,
    String? otpError,
    String? pendingEmail,
    bool clearErrors = false,
  }) {
    return AuthState(
      loading: loading ?? this.loading,
      // With clearErrors, explicitly passed values still win (a validation
      // pass both clears stale errors and sets fresh ones in one call).
      emailError: clearErrors ? emailError : emailError ?? this.emailError,
      passwordError:
          clearErrors ? passwordError : passwordError ?? this.passwordError,
      otpError: clearErrors ? otpError : otpError ?? this.otpError,
      pendingEmail: pendingEmail ?? this.pendingEmail,
    );
  }
}

class AuthController extends Notifier<AuthState> {
  static final _emailPattern = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');

  @override
  AuthState build() => const AuthState();

  AuthRepository get _repo => ref.read(authRepositoryProvider);

  /// Client-side validation shared by login and register.
  /// Returns true when the form may be submitted.
  bool validateCredentials(
    String email,
    String password, {
    String? confirmPassword,
  }) {
    String? emailError;
    String? passwordError;
    if (!_emailPattern.hasMatch(email.trim())) {
      emailError = 'Enter a valid email address.';
    }
    if (password.length < 8) {
      passwordError = 'Use at least 8 characters.';
    } else if (confirmPassword != null && confirmPassword != password) {
      passwordError = 'Passwords don’t match.';
    }
    state = state.copyWith(
      clearErrors: true,
      emailError: emailError,
      passwordError: passwordError,
    );
    return emailError == null && passwordError == null;
  }

  Future<bool> logIn(String email, String password) async {
    if (!validateCredentials(email, password)) return false;
    state = state.copyWith(loading: true, clearErrors: true);
    final result = await _repo.logIn(email.trim(), password);
    state = state.copyWith(
      loading: false,
      passwordError: result.ok ? null : result.message,
    );
    return result.ok;
  }

  Future<bool> register(
    String email,
    String password,
    String confirmPassword,
  ) async {
    if (!validateCredentials(
      email,
      password,
      confirmPassword: confirmPassword,
    )) {
      return false;
    }
    state = state.copyWith(loading: true, clearErrors: true);
    final result = await _repo.register(email.trim(), password);
    state = state.copyWith(
      loading: false,
      emailError: result.ok ? null : result.message,
      pendingEmail: result.ok ? email.trim() : null,
    );
    return result.ok;
  }

  Future<bool> verifyOtp(String code) async {
    state = state.copyWith(loading: true, clearErrors: true);
    final result = await _repo.verifyOtp(code);
    state = state.copyWith(
      loading: false,
      otpError: result.ok ? null : result.message,
    );
    return result.ok;
  }

  Future<bool> requestPasswordReset(String email) async {
    if (!_emailPattern.hasMatch(email.trim())) {
      state = state.copyWith(
        clearErrors: true,
        emailError: 'Enter a valid email address.',
      );
      return false;
    }
    state = state.copyWith(loading: true, clearErrors: true);
    await _repo.requestPasswordReset(email.trim());
    state = state.copyWith(loading: false, pendingEmail: email.trim());
    return true;
  }
}

final authControllerProvider = NotifierProvider<AuthController, AuthState>(
  AuthController.new,
);
