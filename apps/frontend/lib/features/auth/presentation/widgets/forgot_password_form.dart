import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../l10n/l10n.dart';
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
        _emailError = _emailError == null
            ? null
            : context.l10n.validEmailRequired;
        _formError = _emailError == null
            ? localizedApiErrorMessage(apiError, context.l10n)
            : null;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = AuthUiPalette.of(context);
    final l10n = context.l10n;

    if (_sent) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Icon(Icons.mark_email_read_outlined, color: colors.primary, size: 36),
          const SizedBox(height: AppSpacing.md),
          Text(
            l10n.forgotPasswordSuccess,
            style: TextStyle(
              color: colors.textSecondary,
              height: 1.5,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          AuthPrimaryButton(
            label: l10n.backToSignIn,
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
            label: l10n.email,
            hint: l10n.emailHint,
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
                return l10n.emailRequired;
              }
              if (!trimmed.contains('@')) {
                return l10n.validEmailRequired;
              }
              return null;
            },
          ),
          if (_formError != null) AppInlineError(message: _formError!),
          const SizedBox(height: AppSpacing.lg),
          AuthPrimaryButton(
            label: l10n.sendResetInstructions,
            isLoading: _isSubmitting,
            onPressed: _handleSubmit,
          ),
          const SizedBox(height: AppSpacing.sm),
          AuthOutlinedButton(
            label: l10n.backToSignIn,
            onPressed: _isSubmitting ? null : () => context.go(loginRoute),
          ),
        ],
      ),
    );
  }
}
