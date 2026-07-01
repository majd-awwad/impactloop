import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/errors/api_exception.dart';
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

    setState(() {
      _emailError = emailIssue;
      _passwordError = passwordIssue;
      _formError = null;

      if (error.code == 'UNAUTHENTICATED') {
        _passwordError = _loginErrorMessage(error);
        return;
      }

      if (_emailError == null &&
          _passwordError == null &&
          error.code == 'VALIDATION_ERROR') {
        _formError = error.displayMessage;
        return;
      }

      if (_emailError == null && _passwordError == null) {
        _formError = error.displayMessage;
      }
    });
  }

  String _loginErrorMessage(ApiException error) {
    if (error.code == 'UNAUTHENTICATED') {
      final message = error.message.trim();
      if (message.isNotEmpty) {
        return message;
      }

      return 'Invalid email or password.';
    }

    return error.displayMessage;
  }

  Future<void> _handleSubmit() async {
    _clearServerErrors();

    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      final user = await ref
          .read(authControllerProvider.notifier)
          .login(
            email: _emailController.text.trim(),
            password: _passwordController.text,
          );

      if (!mounted) {
        return;
      }

      final from = GoRouterState.of(context).uri.queryParameters['from'];
      context.go(
        sanitizeRedirectTarget(from, fallback: postAuthRouteForUser(user)),
      );
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
        _formError = 'Something went wrong. Please try again.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
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
                return 'Email is required';
              }
              if (!trimmed.contains('@')) {
                return 'Enter a valid email address';
              }
              return null;
            },
          ),
          const AuthFieldGap(),
          AuthPasswordField(
            controller: _passwordController,
            label: 'Password',
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
                return 'Password is required';
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
            alignment: Alignment.centerRight,
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
                'Forgot password?',
                style: TextStyle(
                  color: AuthUiPalette.of(context).primary,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          AuthPrimaryButton(
            label: 'Sign in',
            isLoading: _isSubmitting,
            onPressed: _handleSubmit,
          ),
        ],
      ),
    );
  }
}
