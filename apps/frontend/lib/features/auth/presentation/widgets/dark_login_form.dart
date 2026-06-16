import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../shared/widgets/app_feedback.dart';
import '../../../../shared/widgets/app_inline_error.dart';
import '../../application/auth_controller.dart';
import '../widgets/dark_auth_buttons.dart';
import '../widgets/dark_auth_password_field.dart';
import '../widgets/dark_auth_text_field.dart';

class DarkLoginForm extends ConsumerStatefulWidget {
  const DarkLoginForm({super.key});

  @override
  ConsumerState<DarkLoginForm> createState() => _DarkLoginFormState();
}

class _DarkLoginFormState extends ConsumerState<DarkLoginForm> {
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
      await ref.read(authControllerProvider.notifier).login(
        email: _emailController.text.trim(),
        password: _passwordController.text,
      );

      if (!mounted) {
        return;
      }

      context.go('/home');
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
          DarkAuthTextField(
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
          const DarkAuthFieldGap(),
          DarkAuthPasswordField(
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
          if (_formError != null) AppInlineError(message: _formError!),
          const SizedBox(height: AppSpacing.sm),
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton(
              onPressed: () {
                showInfoSnackBar(
                  context,
                  'Forgot password screen coming soon.',
                );
              },
              child: Text(
                'Forgot password?',
                style: AuthDarkTextStyles.link(context),
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          DarkAuthPrimaryButton(
            label: 'Sign in',
            isLoading: _isSubmitting,
            onPressed: _handleSubmit,
          ),
        ],
      ),
    );
  }
}
