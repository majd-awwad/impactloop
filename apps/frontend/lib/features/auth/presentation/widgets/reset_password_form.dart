import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../shared/widgets/app_inline_error.dart';
import '../../application/auth_navigation.dart';
import '../../application/auth_providers.dart';
import 'auth_buttons.dart';
import 'auth_password_field.dart';
import 'auth_text_field.dart';
import 'auth_ui_palette.dart';

class ResetPasswordForm extends ConsumerStatefulWidget {
  const ResetPasswordForm({super.key, required this.token});

  final String? token;

  @override
  ConsumerState<ResetPasswordForm> createState() => _ResetPasswordFormState();
}

class _ResetPasswordFormState extends ConsumerState<ResetPasswordForm> {
  final _formKey = GlobalKey<FormState>();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  bool _isSubmitting = false;
  bool _resetComplete = false;
  String? _passwordError;
  String? _formError;

  bool get _hasToken => widget.token != null && widget.token!.trim().isNotEmpty;

  @override
  void dispose() {
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  void _clearErrors() {
    setState(() {
      _passwordError = null;
      _formError = null;
    });
  }

  Future<void> _handleSubmit() async {
    _clearErrors();

    if (!_hasToken || !_formKey.currentState!.validate()) {
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      await ref
          .read(authRepositoryProvider)
          .resetPassword(
            token: widget.token!.trim(),
            newPassword: _passwordController.text,
          );

      if (!mounted) {
        return;
      }

      setState(() {
        _isSubmitting = false;
        _resetComplete = true;
      });
    } catch (error) {
      if (!mounted) {
        return;
      }

      final apiError = normalizeApiException(error);
      setState(() {
        _isSubmitting = false;
        _passwordError = firstFieldError(apiError, const ['newPassword']);
        _formError = _passwordError == null ? apiError.displayMessage : null;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = AuthUiPalette.of(context);

    if (!_hasToken) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AppInlineError(message: 'Reset link is missing or invalid.'),
          const SizedBox(height: AppSpacing.lg),
          AuthPrimaryButton(
            label: 'Back to sign in',
            onPressed: () => context.go(loginRoute),
          ),
        ],
      );
    }

    if (_resetComplete) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Icon(Icons.lock_reset_rounded, color: colors.primary, size: 38),
          const SizedBox(height: AppSpacing.md),
          Text(
            'Your password has been updated. Sign in with your new password.',
            style: TextStyle(
              color: colors.textSecondary,
              height: 1.5,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          AuthPrimaryButton(
            label: 'Go to sign in',
            onPressed: () => context.go(loginRoute),
          ),
        ],
      );
    }

    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AuthPasswordField(
            controller: _passwordController,
            label: 'New password',
            textInputAction: TextInputAction.next,
            autofillHints: const [AutofillHints.newPassword],
            errorText: _passwordError,
            onChanged: (_) {
              if (_passwordError != null || _formError != null) {
                _clearErrors();
              }
            },
            validator: (value) {
              if (value == null || value.isEmpty) {
                return 'New password is required';
              }
              if (value.length < 8) {
                return 'Password must be at least 8 characters';
              }
              return null;
            },
          ),
          const AuthFieldGap(),
          AuthPasswordField(
            controller: _confirmPasswordController,
            label: 'Confirm password',
            textInputAction: TextInputAction.done,
            autofillHints: const [AutofillHints.newPassword],
            onFieldSubmitted: (_) => _handleSubmit(),
            onChanged: (_) {
              if (_formError != null) {
                _clearErrors();
              }
            },
            validator: (value) {
              if (value == null || value.isEmpty) {
                return 'Confirm your new password';
              }
              if (value != _passwordController.text) {
                return 'Passwords do not match';
              }
              return null;
            },
          ),
          if (_formError != null) AppInlineError(message: _formError!),
          const SizedBox(height: AppSpacing.lg),
          AuthPrimaryButton(
            label: 'Reset password',
            isLoading: _isSubmitting,
            onPressed: _handleSubmit,
          ),
        ],
      ),
    );
  }
}
