import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/router/navigation_extensions.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../shared/widgets/app_feedback.dart';
import '../../../../shared/widgets/app_inline_error.dart';
import '../../../../shared/widgets/app_password_field.dart';
import '../../../../shared/widgets/app_primary_button.dart';
import '../../../../shared/widgets/app_text_field.dart';
import '../../../auth/application/auth_controller.dart';
import '../widgets/profile_image_picker.dart';

class ProfileSecurityPage extends ConsumerStatefulWidget {
  const ProfileSecurityPage({super.key});

  @override
  ConsumerState<ProfileSecurityPage> createState() =>
      _ProfileSecurityPageState();
}

class _ProfileSecurityPageState extends ConsumerState<ProfileSecurityPage> {
  final _formKey = GlobalKey<FormState>();
  final _currentPasswordController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  bool _isSubmitting = false;
  String? _formError;
  bool _obscureCurrentPassword = true;
  bool _obscureNewPasswords = true;

  @override
  void dispose() {
    _currentPasswordController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_isSubmitting || !(_formKey.currentState?.validate() ?? false)) {
      return;
    }

    setState(() {
      _isSubmitting = true;
      _formError = null;
    });

    try {
      await ref
          .read(authControllerProvider.notifier)
          .changePassword(
            currentPassword: _currentPasswordController.text,
            newPassword: _newPasswordController.text,
            confirmNewPassword: _confirmPasswordController.text,
          );

      if (!mounted) {
        return;
      }

      _currentPasswordController.clear();
      _newPasswordController.clear();
      _confirmPasswordController.clear();

      showInfoSnackBar(context, 'Password updated successfully.');
      context.popOrGo('/profile');
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _isSubmitting = false;
        _formError = error.displayMessage;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }

      setState(() {
        _isSubmitting = false;
        _formError = 'Could not update your password. Please try again.';
      });
    }
  }

  String? _required(String? value) {
    if (value == null || value.trim().isEmpty) {
      return 'This field is required';
    }
    return null;
  }

  String? _validateNewPassword(String? value) {
    final requiredError = _required(value);
    if (requiredError != null) {
      return requiredError;
    }

    if (value!.length < 8) {
      return 'Password must be at least 8 characters';
    }

    if (value == _currentPasswordController.text) {
      return 'New password must be different from your current password';
    }

    return null;
  }

  String? _validateConfirmPassword(String? value) {
    final requiredError = _required(value);
    if (requiredError != null) {
      return requiredError;
    }

    if (value != _newPasswordController.text) {
      return 'Passwords do not match';
    }

    return null;
  }

  @override
  Widget build(BuildContext context) {
    return ProfileSubpageScaffold(
      title: 'Security',
      child: ProfileEditCard(
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text('Change your password using your current password.'),
              const SizedBox(height: AppSpacing.lg),
              AppPasswordField(
                controller: _currentPasswordController,
                label: 'Current password',
                textInputAction: TextInputAction.next,
                autofillHints: const [AutofillHints.password],
                validator: _required,
                obscureOverride: _obscureCurrentPassword,
                onToggleVisibility: () => setState(
                  () => _obscureCurrentPassword = !_obscureCurrentPassword,
                ),
                onChanged: (_) {
                  if (_formError != null) {
                    setState(() => _formError = null);
                  }
                },
              ),
              const AppFieldGap(),
              AppPasswordField(
                controller: _newPasswordController,
                label: 'New password',
                textInputAction: TextInputAction.next,
                autofillHints: const [AutofillHints.newPassword],
                validator: _validateNewPassword,
                obscureOverride: _obscureNewPasswords,
                onToggleVisibility: () => setState(
                  () => _obscureNewPasswords = !_obscureNewPasswords,
                ),
                onChanged: (_) {
                  if (_formError != null) {
                    setState(() => _formError = null);
                  }
                },
              ),
              const AppFieldGap(),
              AppPasswordField(
                controller: _confirmPasswordController,
                label: 'Confirm new password',
                textInputAction: TextInputAction.done,
                autofillHints: const [AutofillHints.newPassword],
                validator: _validateConfirmPassword,
                obscureOverride: _obscureNewPasswords,
                onToggleVisibility: () => setState(
                  () => _obscureNewPasswords = !_obscureNewPasswords,
                ),
                onFieldSubmitted: (_) => _submit(),
                onChanged: (_) {
                  if (_formError != null) {
                    setState(() => _formError = null);
                  }
                },
              ),
              if (_formError != null) ...[
                const SizedBox(height: AppSpacing.md),
                AppInlineError(message: _formError!),
              ],
              const SizedBox(height: AppSpacing.lg),
              AppPrimaryButton(
                label: _isSubmitting ? 'Updating...' : 'Update password',
                onPressed: _isSubmitting ? null : _submit,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
