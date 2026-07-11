import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Result of a mocked auth call: [ok] or a user-facing [message]
/// (copy per 11_UX_WRITING_GUIDE).
class AuthResult {
  const AuthResult.ok() : ok = true, message = null;
  const AuthResult.failure(this.message) : ok = false;

  final bool ok;
  final String? message;
}

/// Frontend-phase auth data source (16 §2: all data access mocked behind
/// repositories so the UI never depends on backend implementation).
/// Deterministic behaviors so flows are demonstrable:
/// - password "wrongpass1" fails login; anything else succeeds
/// - OTP "000000" fails; any other 6-digit code succeeds
class AuthRepository {
  static const _latency = Duration(milliseconds: 600);

  Future<AuthResult> logIn(String email, String password) async {
    await Future<void>.delayed(_latency);
    if (password == 'wrongpass1') {
      return const AuthResult.failure(
        'That password doesn’t look right. Try again.',
      );
    }
    return const AuthResult.ok();
  }

  Future<AuthResult> register(String email, String password) async {
    await Future<void>.delayed(_latency);
    return const AuthResult.ok();
  }

  Future<AuthResult> verifyOtp(String code) async {
    await Future<void>.delayed(_latency);
    if (code == '000000') {
      return const AuthResult.failure(
        'That code didn’t match. Check and try again.',
      );
    }
    return const AuthResult.ok();
  }

  Future<void> requestPasswordReset(String email) =>
      Future<void>.delayed(_latency);
}

final authRepositoryProvider = Provider<AuthRepository>(
  (_) => AuthRepository(),
);
