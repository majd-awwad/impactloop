import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../shared/widgets/app_inline_error.dart';
import '../../application/registration_draft_notifier.dart';
import '../models/registration_intent.dart';
import 'auth_buttons.dart';
import 'auth_form_fields.dart';
import 'auth_password_field.dart';
import 'auth_text_field.dart';
import 'auth_ui_palette.dart';

class UnifiedRegisterForm extends ConsumerStatefulWidget {
  const UnifiedRegisterForm({super.key});

  @override
  ConsumerState<UnifiedRegisterForm> createState() =>
      _UnifiedRegisterFormState();
}

class _UnifiedRegisterFormState extends ConsumerState<UnifiedRegisterForm> {
  final _formKey = GlobalKey<FormState>();
  final _displayNameController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  RegistrationIntent? _intent;
  bool _isSubmitting = false;
  String? _intentError;
  String? _formError;

  static const _intentOptions = [
    (RegistrationIntent.learner, 'Find materials'),
    (RegistrationIntent.supplier, 'Share materials'),
    (RegistrationIntent.both, 'Do both'),
  ];

  @override
  void dispose() {
    _displayNameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  void _clearErrors({bool clearIntent = false}) {
    setState(() {
      if (clearIntent) {
        _intentError = null;
      }
      _formError = null;
    });
  }

  Future<void> _handleSubmit() async {
    if (_intent == null) {
      setState(() {
        _intentError = 'Please choose how you want to use ImpactLoop.';
        _formError = null;
      });
      return;
    }

    _clearErrors(clearIntent: true);

    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() => _isSubmitting = true);

    final phone = _phoneController.text.trim();
    final draftNotifier = ref.read(registrationDraftProvider.notifier);

    draftNotifier
      ..setBasicInfo(
        displayName: _displayNameController.text.trim(),
        email: _emailController.text.trim(),
        password: _passwordController.text,
        phone: phone.isEmpty ? null : phone,
      )
      ..setIntent(_intent!);

    if (!mounted) {
      return;
    }

    setState(() => _isSubmitting = false);
    context.go(_intent!.continueRoute);
  }

  @override
  Widget build(BuildContext context) {
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'How do you want to use ImpactLoop?',
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              height: 1.5,
              color: AuthUiPalette.of(context).textPrimary,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              for (final option in _intentOptions)
                AuthIntentChip(
                  label: option.$2,
                  isSelected: _intent == option.$1,
                  onTap: () {
                    _clearErrors(clearIntent: true);
                    setState(() => _intent = option.$1);
                  },
                ),
            ],
          ),
          if (_intentError != null) AppInlineError(message: _intentError!),
          const SizedBox(height: AppSpacing.lg),
          AuthTextField(
            controller: _displayNameController,
            label: 'Full name',
            hint: 'Your name',
            textInputAction: TextInputAction.next,
            autofillHints: const [AutofillHints.name],
            onChanged: (_) => _clearErrors(),
            validator: (value) {
              if (value == null || value.trim().isEmpty) {
                return 'Full name is required';
              }
              return null;
            },
          ),
          const AuthFieldGap(),
          AuthTextField(
            controller: _emailController,
            label: 'Email address',
            hint: 'you@example.com',
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.next,
            autofillHints: const [AutofillHints.email],
            onChanged: (_) => _clearErrors(),
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
          AuthTextField(
            controller: _phoneController,
            label: 'Phone number (optional)',
            hint: '+970 000 000 000',
            keyboardType: TextInputType.phone,
            textInputAction: TextInputAction.next,
            autofillHints: const [AutofillHints.telephoneNumber],
            onChanged: (_) => _clearErrors(),
          ),
          const AuthFieldGap(),
          AuthPasswordField(
            controller: _passwordController,
            label: 'Password',
            textInputAction: TextInputAction.next,
            autofillHints: const [AutofillHints.newPassword],
            onChanged: (_) => _clearErrors(),
            validator: (value) {
              if (value == null || value.isEmpty) {
                return 'Password is required';
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
            onChanged: (_) => _clearErrors(),
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
          if (_formError != null) ...[
            const SizedBox(height: AppSpacing.md),
            AppInlineError(message: _formError!),
          ],
          const SizedBox(height: AppSpacing.lg),
          AuthPrimaryButton(
            label: 'Create account',
            isLoading: _isSubmitting,
            onPressed: _handleSubmit,
          ),
        ],
      ),
    );
  }
}
