import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/design_tokens/design_tokens.dart';
import '../../../../app/router/gyf_router.dart';
import '../../../../core/services/haptic_service.dart';
import '../../../../core/services/session_manager.dart';
import '../../../../core/widgets/gyf_widgets.dart';
import '../../application/auth_controller.dart';

/// Authentication screens (07 Part C + 05 Part 1, 16 §6.3):
/// Welcome, Login, Register, OTP Verification, Forgot Password,
/// New Password, Auth Success. Back always preserves form input —
/// controllers live in the flow-scoped [_authFormsProvider].

/// Text controllers shared across the auth flow so navigating back never
/// loses what the user typed (07 Part C contract).
final _authFormsProvider = Provider.autoDispose<_AuthForms>((ref) {
  final forms = _AuthForms();
  ref.onDispose(forms.dispose);
  return forms;
});

class _AuthForms {
  final email = TextEditingController();
  final password = TextEditingController();
  final confirmPassword = TextEditingController();
  final newPassword = TextEditingController();

  void dispose() {
    email.dispose();
    password.dispose();
    confirmPassword.dispose();
    newPassword.dispose();
  }
}

class _AuthScaffold extends StatelessWidget {
  const _AuthScaffold({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<GyfColorScheme>()!;
    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(backgroundColor: colors.background),
      body: SafeArea(
        child: SingleChildScrollView(
          padding:
              const EdgeInsets.symmetric(horizontal: GyfSpacing.marginStandard),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: GyfSpacing.s8),
              Text(title, style: GyfTypography.displayM),
              const SizedBox(height: GyfSpacing.s24),
              child,
            ],
          ),
        ),
      ),
    );
  }
}

/// Welcome — hero, primary CTA = Sign up, secondary = Log in,
/// tertiary = explore as guest, privacy notice.
class AuthWelcomeScreen extends ConsumerWidget {
  const AuthWelcomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = Theme.of(context).extension<GyfColorScheme>()!;
    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        child: Padding(
          padding:
              const EdgeInsets.symmetric(horizontal: GyfSpacing.marginStandard),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      Icons.checkroom,
                      size: GyfSpacing.s96,
                      color: colors.primary,
                    ),
                    const SizedBox(height: GyfSpacing.s24),
                    Text(
                      'Your stylist is ready.',
                      style: GyfTypography.displayM,
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: GyfSpacing.s8),
                    Text(
                      'Create an account to keep your StyleDNA, wardrobe '
                      'and wishlist everywhere.',
                      style: GyfTypography.body
                          .copyWith(color: colors.textSecondary),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
              GyfPrimaryButton(
                label: 'Sign up',
                fullWidth: true,
                onPressed: () => context.go(GyfRoutes.authRegister),
              ),
              const SizedBox(height: GyfSpacing.s8),
              GyfSecondaryButton(
                label: 'Log in',
                fullWidth: true,
                onPressed: () => context.go(GyfRoutes.authLogin),
              ),
              GyfGhostButton(
                label: 'Explore as guest',
                onPressed: () async {
                  await ref.read(sessionManagerProvider.notifier).signIn();
                  if (context.mounted) context.go(GyfRoutes.home);
                },
              ),
              const SizedBox(height: GyfSpacing.s8),
              Text(
                'By continuing you agree to our Terms and Privacy Policy.',
                style:
                    GyfTypography.caption.copyWith(color: colors.textTertiary),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: GyfSpacing.s16),
            ],
          ),
        ),
      ),
    );
  }
}

class LoginScreen extends ConsumerWidget {
  const LoginScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authControllerProvider);
    final forms = ref.watch(_authFormsProvider);

    Future<void> submit() async {
      // Login tap: soft impact → success haptic on success; error
      // notification + input shake on failure (handled by GyfTextField).
      ref.read(hapticServiceProvider).emit(GyfHaptic.light);
      final ok = await ref
          .read(authControllerProvider.notifier)
          .logIn(forms.email.text, forms.password.text);
      if (ok && context.mounted) {
        ref.read(hapticServiceProvider).emit(GyfHaptic.success);
        context.go(GyfRoutes.authSuccess);
      }
    }

    return _AuthScaffold(
      title: 'Welcome back.',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          GyfTextField(
            label: 'Email',
            controller: forms.email,
            hint: 'you@example.com',
            keyboardType: TextInputType.emailAddress,
            errorText: auth.emailError,
          ),
          const SizedBox(height: GyfSpacing.s16),
          GyfTextField(
            label: 'Password',
            controller: forms.password,
            obscureText: true,
            errorText: auth.passwordError,
            onSubmitted: (_) => submit(),
          ),
          Align(
            alignment: Alignment.centerRight,
            child: GyfGhostButton(
              label: 'Forgot password?',
              onPressed: () => context.go(GyfRoutes.authForgotPassword),
            ),
          ),
          const SizedBox(height: GyfSpacing.s8),
          GyfPrimaryButton(
            label: 'Log in',
            fullWidth: true,
            loading: auth.loading,
            onPressed: auth.loading ? null : submit,
          ),
          GyfGhostButton(
            label: 'New here? Sign up',
            onPressed: () => context.go(GyfRoutes.authRegister),
          ),
        ],
      ),
    );
  }
}

class RegisterScreen extends ConsumerWidget {
  const RegisterScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authControllerProvider);
    final forms = ref.watch(_authFormsProvider);

    Future<void> submit() async {
      ref.read(hapticServiceProvider).emit(GyfHaptic.light);
      final ok = await ref.read(authControllerProvider.notifier).register(
            forms.email.text,
            forms.password.text,
            forms.confirmPassword.text,
          );
      if (ok && context.mounted) context.go(GyfRoutes.authOtp);
    }

    return _AuthScaffold(
      title: 'Create your account.',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          GyfTextField(
            label: 'Email',
            controller: forms.email,
            hint: 'you@example.com',
            keyboardType: TextInputType.emailAddress,
            errorText: auth.emailError,
          ),
          const SizedBox(height: GyfSpacing.s16),
          GyfTextField(
            label: 'Password',
            controller: forms.password,
            obscureText: true,
            helperText: 'At least 8 characters.',
            errorText: auth.passwordError,
          ),
          const SizedBox(height: GyfSpacing.s16),
          GyfTextField(
            label: 'Confirm password',
            controller: forms.confirmPassword,
            obscureText: true,
            onSubmitted: (_) => submit(),
          ),
          const SizedBox(height: GyfSpacing.s24),
          GyfPrimaryButton(
            label: 'Sign up',
            fullWidth: true,
            loading: auth.loading,
            onPressed: auth.loading ? null : submit,
          ),
          GyfGhostButton(
            label: 'Already have an account? Log in',
            onPressed: () => context.go(GyfRoutes.authLogin),
          ),
        ],
      ),
    );
  }
}

/// OTP verification with countdown + resend.
class OtpScreen extends ConsumerStatefulWidget {
  const OtpScreen({super.key});

  @override
  ConsumerState<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends ConsumerState<OtpScreen> {
  static const _resendWindow = 30;

  Timer? _timer;
  int _secondsLeft = _resendWindow;

  @override
  void initState() {
    super.initState();
    _startCountdown();
  }

  void _startCountdown() {
    _timer?.cancel();
    setState(() => _secondsLeft = _resendWindow);
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (_secondsLeft <= 1) {
        t.cancel();
      }
      setState(() => _secondsLeft = _secondsLeft > 0 ? _secondsLeft - 1 : 0);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);
    final colors = Theme.of(context).extension<GyfColorScheme>()!;

    return _AuthScaffold(
      title: 'Check your email.',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'We sent a 6-digit code to '
            '${auth.pendingEmail ?? 'your email'}.',
            style: GyfTypography.body.copyWith(color: colors.textSecondary),
          ),
          const SizedBox(height: GyfSpacing.s24),
          GyfOtpField(
            errorText: auth.otpError,
            onCompleted: (code) async {
              final ok = await ref
                  .read(authControllerProvider.notifier)
                  .verifyOtp(code);
              if (ok && context.mounted) {
                ref.read(hapticServiceProvider).emit(GyfHaptic.success);
                context.go(GyfRoutes.authSuccess);
              }
            },
          ),
          const SizedBox(height: GyfSpacing.s24),
          Center(
            child: _secondsLeft > 0
                ? Text(
                    'Resend code in ${_secondsLeft}s',
                    style: GyfTypography.bodySmall
                        .copyWith(color: colors.textTertiary),
                  )
                : GyfGhostButton(
                    label: 'Resend code',
                    onPressed: _startCountdown,
                  ),
          ),
        ],
      ),
    );
  }
}

class ForgotPasswordScreen extends ConsumerWidget {
  const ForgotPasswordScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authControllerProvider);
    final forms = ref.watch(_authFormsProvider);

    return _AuthScaffold(
      title: 'Reset your password.',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          GyfTextField(
            label: 'Email',
            controller: forms.email,
            hint: 'you@example.com',
            keyboardType: TextInputType.emailAddress,
            errorText: auth.emailError,
          ),
          const SizedBox(height: GyfSpacing.s24),
          GyfPrimaryButton(
            label: 'Send reset link',
            fullWidth: true,
            loading: auth.loading,
            onPressed: auth.loading
                ? null
                : () async {
                    final ok = await ref
                        .read(authControllerProvider.notifier)
                        .requestPasswordReset(forms.email.text);
                    if (ok && context.mounted) {
                      context.go(GyfRoutes.authNewPassword);
                    }
                  },
          ),
        ],
      ),
    );
  }
}

class NewPasswordScreen extends ConsumerWidget {
  const NewPasswordScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authControllerProvider);
    final forms = ref.watch(_authFormsProvider);

    return _AuthScaffold(
      title: 'Choose a new password.',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          GyfTextField(
            label: 'New password',
            controller: forms.newPassword,
            obscureText: true,
            helperText: 'At least 8 characters.',
            errorText: auth.passwordError,
          ),
          const SizedBox(height: GyfSpacing.s24),
          GyfPrimaryButton(
            label: 'Save password',
            fullWidth: true,
            onPressed: () {
              final ok = ref
                  .read(authControllerProvider.notifier)
                  .validateCredentials('ok@gyf.app', forms.newPassword.text);
              if (ok) {
                ref.read(hapticServiceProvider).emit(GyfHaptic.success);
                context.go(GyfRoutes.authSuccess);
              }
            },
          ),
        ],
      ),
    );
  }
}

/// Auth success — celebration beat, then into the app.
class AuthSuccessScreen extends ConsumerStatefulWidget {
  const AuthSuccessScreen({super.key});

  @override
  ConsumerState<AuthSuccessScreen> createState() => _AuthSuccessScreenState();
}

class _AuthSuccessScreenState extends ConsumerState<AuthSuccessScreen> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      await ref.read(sessionManagerProvider.notifier).signIn();
    });
    _timer = Timer(const Duration(milliseconds: 1400), () {
      if (mounted) context.go(GyfRoutes.home);
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
    return Scaffold(
      backgroundColor: colors.background,
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.check_circle_outline,
              size: GyfSpacing.s64,
              color: colors.success,
            ),
            const SizedBox(height: GyfSpacing.s16),
            Text('You’re in.', style: GyfTypography.displayM),
            const SizedBox(height: GyfSpacing.s8),
            Text(
              'Taking you to your looks…',
              style: GyfTypography.body.copyWith(color: colors.textSecondary),
            ),
          ],
        ),
      ),
    );
  }
}
