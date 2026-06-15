import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../shared/widgets/app_primary_button.dart';
import '../../../../shared/widgets/app_text_field.dart';
import '../../application/registration_draft_notifier.dart';

class RegisterForm extends ConsumerStatefulWidget {
  const RegisterForm({super.key});

  @override
  ConsumerState<RegisterForm> createState() => _RegisterFormState();
}

class _RegisterFormState extends ConsumerState<RegisterForm> {
  final _formKey = GlobalKey<FormState>();
  final _displayNameController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  bool _isSubmitting = false;

  @override
  void dispose() {
    _displayNameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() => _isSubmitting = true);

    final phone = _phoneController.text.trim();

    ref.read(registrationDraftProvider.notifier).setBasicInfo(
      displayName: _displayNameController.text.trim(),
      email: _emailController.text.trim(),
      password: _passwordController.text,
      phone: phone.isEmpty ? null : phone,
    );

    if (!mounted) {
      return;
    }

    setState(() => _isSubmitting = false);
    context.go('/choose-role');
  }

  @override
  Widget build(BuildContext context) {
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AppTextField(
            controller: _displayNameController,
            label: 'Display name',
            hint: 'Your name',
            textInputAction: TextInputAction.next,
            autofillHints: const [AutofillHints.name],
            validator: (value) {
              if (value == null || value.trim().isEmpty) {
                return 'Display name is required';
              }
              return null;
            },
          ),
          const AppFieldGap(),
          AppTextField(
            controller: _emailController,
            label: 'Email',
            hint: 'you@example.com',
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.next,
            autofillHints: const [AutofillHints.email],
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
          const AppFieldGap(),
          AppTextField(
            controller: _phoneController,
            label: 'Phone (optional)',
            hint: '+1 555 000 0000',
            keyboardType: TextInputType.phone,
            textInputAction: TextInputAction.next,
            autofillHints: const [AutofillHints.telephoneNumber],
          ),
          const AppFieldGap(),
          AppTextField(
            controller: _passwordController,
            label: 'Password',
            obscureText: true,
            textInputAction: TextInputAction.next,
            autofillHints: const [AutofillHints.newPassword],
            validator: (value) {
              if (value == null || value.isEmpty) {
                return 'Password is required';
              }
              return null;
            },
          ),
          const AppFieldGap(),
          AppTextField(
            controller: _confirmPasswordController,
            label: 'Confirm password',
            obscureText: true,
            textInputAction: TextInputAction.done,
            autofillHints: const [AutofillHints.newPassword],
            onFieldSubmitted: (_) => _handleSubmit(),
            validator: (value) {
              if (value == null || value.isEmpty) {
                return 'Confirm password is required';
              }
              if (value != _passwordController.text) {
                return 'Passwords do not match';
              }
              return null;
            },
          ),
          const SizedBox(height: AppSpacing.lg),
          AppPrimaryButton(
            label: 'Create account',
            isLoading: _isSubmitting,
            onPressed: _handleSubmit,
          ),
        ],
      ),
    );
  }
}
