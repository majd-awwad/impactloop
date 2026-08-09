import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/router/navigation_extensions.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/widgets/app_feedback.dart';
import '../../../../shared/widgets/app_inline_error.dart';
import '../../../../shared/widgets/app_password_field.dart';
import '../../../../shared/widgets/app_primary_button.dart';
import '../../../../shared/widgets/app_text_field.dart';
import '../../../auth/application/auth_controller.dart';
import '../../../auth/application/auth_route_helpers.dart';
import '../l10n/account_settings_l10n.dart';
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
    final l10n = AccountSettingsL10n.of(context);

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

      showInfoSnackBar(context, l10n.passwordUpdated);
      context.popOrGo(accountSettingsRoute);
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _isSubmitting = false;
        _formError = localizedApiErrorMessage(error, context.l10n);
      });
    } catch (_) {
      if (!mounted) {
        return;
      }

      setState(() {
        _isSubmitting = false;
        _formError = l10n.updatePasswordFailed;
      });
    }
  }

  String? _required(String? value) {
    if (value == null || value.trim().isEmpty) {
      return AccountSettingsL10n.of(context).fieldRequired;
    }
    return null;
  }

  String? _validateNewPassword(String? value) {
    final requiredError = _required(value);
    if (requiredError != null) {
      return requiredError;
    }

    if (value!.length < 8) {
      return AccountSettingsL10n.of(context).passwordTooShort;
    }

    if (value == _currentPasswordController.text) {
      return AccountSettingsL10n.of(context).passwordMustDiffer;
    }

    return null;
  }

  String? _validateConfirmPassword(String? value) {
    final requiredError = _required(value);
    if (requiredError != null) {
      return requiredError;
    }

    if (value != _newPasswordController.text) {
      return AccountSettingsL10n.of(context).passwordsDoNotMatch;
    }

    return null;
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AccountSettingsL10n.of(context);
    return ProfileSubpageScaffold(
      title: l10n.security,
      backFallbackRoute: accountSettingsRoute,
      child: ProfileEditCard(
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(l10n.changePasswordIntro),
              const SizedBox(height: AppSpacing.lg),
              AppPasswordField(
                controller: _currentPasswordController,
                label: l10n.currentPassword,
                showPasswordLabel: l10n.showPassword,
                hidePasswordLabel: l10n.hidePassword,
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
                label: l10n.newPassword,
                showPasswordLabel: l10n.showPassword,
                hidePasswordLabel: l10n.hidePassword,
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
                label: l10n.confirmNewPassword,
                showPasswordLabel: l10n.showPassword,
                hidePasswordLabel: l10n.hidePassword,
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
                label: _isSubmitting ? l10n.updating : l10n.updatePassword,
                onPressed: _isSubmitting ? null : _submit,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
