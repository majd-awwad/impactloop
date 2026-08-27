import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../core/errors/common_api_error_codes.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/widgets/app_inline_error.dart';
import '../../application/auth_controller.dart';
import '../../application/auth_navigation.dart';
import 'auth_buttons.dart';
import 'auth_password_field.dart';
import 'auth_text_field.dart';
import 'auth_ui_palette.dart';

class LoginForm extends ConsumerStatefulWidget {
  const LoginForm({super.key});

  @override
  ConsumerState<LoginForm> createState() => _LoginFormState();
}

class _LoginFormState extends ConsumerState<LoginForm> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isSubmitting = false;
  String? _emailError;
  String? _passwordError;
  String? _formError;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _clearServerErrors({bool clearForm = true}) {
    setState(() {
      _emailError = null;
      _passwordError = null;
      if (clearForm) {
        _formError = null;
      }
    });
  }

  void _applyLoginError(ApiException error) {
    final emailIssue = firstFieldError(error, const ['email']);
    final passwordIssue = firstFieldError(error, const ['password']);
    final l10n = context.l10n;

    setState(() {
      _emailError = emailIssue == null ? null : l10n.validEmailRequired;
      _passwordError = passwordIssue == null ? null : l10n.passwordRequired;
      _formError = null;

      if (error.code == CommonApiErrorCodes.unauthenticated) {
        _passwordError = l10n.invalidCredentials;
        return;
      }

      if (_emailError == null &&
          _passwordError == null &&
          error.code == CommonApiErrorCodes.validationError) {
        _formError = l10n.validationError;
        return;
      }

      if (_emailError == null && _passwordError == null) {
        _formError = localizedApiErrorMessage(error, l10n);
      }
    });
  }

  Future<void> _handleSubmit() async {
    _clearServerErrors();

    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      await ref
          .read(authControllerProvider.notifier)
          .login(
            email: _emailController.text.trim(),
            password: _passwordController.text,
          );

      // Auth state changes refresh GoRouter synchronously. Let the router's
      // redirect validate `from` against the newly authenticated account and
      // perform the single navigation. Calling context.go here races that
      // redirect while the login page is being unmounted.
      return;
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() => _isSubmitting = false);
      _applyLoginError(error);
    } catch (_) {
      if (!mounted) {
        return;
      }

      setState(() => _isSubmitting = false);
      setState(() {
        _formError = context.l10n.somethingWentWrong;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
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
            textInputAction: TextInputAction.next,
            autofillHints: const [AutofillHints.email],
            errorText: _emailError,
            onChanged: (_) {
              if (_emailError != null || _formError != null) {
                _clearServerErrors();
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
          const AuthFieldGap(),
          AuthPasswordField(
            controller: _passwordController,
            label: l10n.password,
            textInputAction: TextInputAction.done,
            autofillHints: const [AutofillHints.password],
            onFieldSubmitted: (_) => _handleSubmit(),
            errorText: _passwordError,
            onChanged: (_) {
              if (_passwordError != null || _formError != null) {
                _clearServerErrors();
              }
            },
            validator: (value) {
              if (value == null || value.isEmpty) {
                return l10n.passwordRequired;
              }
              return null;
            },
          ),
          if (_formError != null) ...[
            const SizedBox(height: AppSpacing.sm),
            AppInlineError(message: _formError!),
          ],
          const SizedBox(height: AppSpacing.xs),
          Align(
            alignment: AlignmentDirectional.centerEnd,
            child: TextButton(
              style: TextButton.styleFrom(
                minimumSize: Size.zero,
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.xs,
                  vertical: AppSpacing.xs,
                ),
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                visualDensity: VisualDensity.compact,
              ),
              onPressed: () {
                final email = _emailController.text.trim();
                final target = email.isEmpty
                    ? forgotPasswordRoute
                    : '$forgotPasswordRoute?email=${Uri.encodeQueryComponent(email)}';
                context.go(target);
              },
              child: Text(
                l10n.forgotPasswordQuestion,
                style: TextStyle(
                  color: AuthUiPalette.of(context).primary,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          AuthPrimaryButton(
            label: l10n.signIn,
            isLoading: _isSubmitting,
            onPressed: _handleSubmit,
          ),
        ],
      ),
    );
  }
}
