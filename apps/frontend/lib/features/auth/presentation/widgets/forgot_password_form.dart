import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../shared/widgets/app_inline_error.dart';
import '../../application/auth_navigation.dart';
import '../../application/auth_providers.dart';
import 'auth_buttons.dart';
import 'auth_text_field.dart';
import 'auth_ui_palette.dart';

const forgotPasswordGenericSuccessMessage =
    'If an account exists for this email, reset instructions have been sent.';

class ForgotPasswordForm extends ConsumerStatefulWidget {
  const ForgotPasswordForm({super.key, this.initialEmail});

  final String? initialEmail;

  @override
  ConsumerState<ForgotPasswordForm> createState() => _ForgotPasswordFormState();
}

class _ForgotPasswordFormState extends ConsumerState<ForgotPasswordForm> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _emailController;
  bool _isSubmitting = false;
  bool _sent = false;
  String? _emailError;
  String? _formError;

  @override
  void initState() {
    super.initState();
    _emailController = TextEditingController(text: widget.initialEmail ?? '');
  }

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  void _clearErrors() {
    setState(() {
      _emailError = null;
      _formError = null;
    });
  }

  Future<void> _handleSubmit() async {
    _clearErrors();

    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      await ref
          .read(authRepositoryProvider)
          .forgotPassword(email: _emailController.text.trim());

      if (!mounted) {
        return;
      }

      setState(() {
        _isSubmitting = false;
        _sent = true;
      });
    } catch (error) {
      if (!mounted) {
        return;
      }

      final apiError = normalizeApiException(error);
      setState(() {
        _isSubmitting = false;
        _emailError = firstFieldError(apiError, const ['email']);
        _formError = _emailError == null ? apiError.displayMessage : null;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = AuthUiPalette.of(context);

    if (_sent) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Icon(Icons.mark_email_read_outlined, color: colors.primary, size: 36),
          const SizedBox(height: AppSpacing.md),
          Text(
            forgotPasswordGenericSuccessMessage,
            style: TextStyle(
              color: colors.textSecondary,
              height: 1.5,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          AuthPrimaryButton(
            label: 'Back to sign in',
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
          AuthTextField(
            controller: _emailController,
            label: 'Email',
            hint: 'you@example.com',
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.done,
            autofillHints: const [AutofillHints.email],
            errorText: _emailError,
            onFieldSubmitted: (_) => _handleSubmit(),
            onChanged: (_) {
              if (_emailError != null || _formError != null) {
                _clearErrors();
              }
            },
            validator: (value) {
              final trimmed = value?.trim() ?? '';
              if (trimmed.isEmpty) {
                return 'Email is required';
              }
              if (!trimmed.contains('@')) {
                return 'Enter a valid email address';
              }
              return null;
            },
          ),
          if (_formError != null) AppInlineError(message: _formError!),
          const SizedBox(height: AppSpacing.lg),
          AuthPrimaryButton(
            label: 'Send reset instructions',
            isLoading: _isSubmitting,
            onPressed: _handleSubmit,
          ),
          const SizedBox(height: AppSpacing.sm),
          AuthOutlinedButton(
            label: 'Back to sign in',
            onPressed: _isSubmitting ? null : () => context.go(loginRoute),
          ),
        ],
      ),
    );
  }
}
