import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../l10n/l10n.dart';
import '../../application/auth_controller.dart';
import '../../application/auth_navigation.dart';
import '../../application/auth_providers.dart';
import '../widgets/auth_entry_branding_panel.dart';
import '../widgets/auth_buttons.dart';
import '../widgets/auth_header.dart';
import '../widgets/auth_shell.dart';

enum _VerifyEmailState {
  loading,
  success,
  invalid,
  expired,
  used,
  failure,
}

class VerifyEmailView extends ConsumerStatefulWidget {
  const VerifyEmailView({super.key, required this.token});

  final String? token;

  @override
  ConsumerState<VerifyEmailView> createState() => _VerifyEmailViewState();
}

class _VerifyEmailViewState extends ConsumerState<VerifyEmailView> {
  _VerifyEmailState _state = _VerifyEmailState.loading;

  bool get _hasToken =>
      widget.token != null && widget.token!.trim().isNotEmpty;

  @override
  void initState() {
    super.initState();
    if (_hasToken) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _confirm());
    } else {
      _state = _VerifyEmailState.invalid;
    }
  }

  Future<void> _confirm() async {
    setState(() => _state = _VerifyEmailState.loading);

    try {
      await ref
          .read(authRepositoryProvider)
          .confirmEmailVerification(token: widget.token!.trim());

      try {
        await ref.read(authControllerProvider.notifier).refreshCurrentUser();
      } catch (_) {
        // Public confirmation may succeed without an active session.
      }

      if (!mounted) {
        return;
      }

      setState(() => _state = _VerifyEmailState.success);
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _state = switch (error.code) {
          'EMAIL_VERIFICATION_TOKEN_EXPIRED' => _VerifyEmailState.expired,
          'EMAIL_VERIFICATION_TOKEN_USED' => _VerifyEmailState.used,
          'EMAIL_VERIFICATION_TOKEN_INVALID' => _VerifyEmailState.invalid,
          _ => _VerifyEmailState.failure,
        };
      });
    } catch (_) {
      if (!mounted) {
        return;
      }

      setState(() => _state = _VerifyEmailState.failure);
    }
  }

  String _message(BuildContext context) {
    final l10n = context.l10n;

    return switch (_state) {
      _VerifyEmailState.loading => l10n.emailVerificationConfirming,
      _VerifyEmailState.success => l10n.emailVerificationSuccessBody,
      _VerifyEmailState.invalid => l10n.emailVerificationInvalidToken,
      _VerifyEmailState.expired => l10n.emailVerificationExpiredToken,
      _VerifyEmailState.used => l10n.emailVerificationUsedToken,
      _VerifyEmailState.failure => l10n.emailVerificationGenericFailure,
    };
  }

  String _title(BuildContext context) {
    final l10n = context.l10n;

    return switch (_state) {
      _VerifyEmailState.success => l10n.emailVerificationSuccessTitle,
      _ => l10n.emailVerificationTitle,
    };
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isLoading = _state == _VerifyEmailState.loading;

    return AuthShell(
      brandingVariant: AuthEntryBrandingVariant.login,
      showSignIn: false,
      showCreateAccount: false,
      formContent: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AuthHeader(title: _title(context), subtitle: _message(context)),
          const SizedBox(height: AppSpacing.lg),
          if (isLoading)
            const Center(child: CircularProgressIndicator())
          else
            AuthPrimaryButton(
              label: _state == _VerifyEmailState.success
                  ? l10n.emailVerificationContinue
                  : l10n.backToSignIn,
              onPressed: () {
                final user = ref.read(authControllerProvider).user;
                final destination = _state == _VerifyEmailState.success
                    ? (user != null
                          ? postAuthRouteForUser(user)
                          : homeRoute)
                    : loginRoute;
                context.go(destination);
              },
            ),
        ],
      ),
    );
  }
}
