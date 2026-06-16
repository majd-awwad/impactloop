import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_colors.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';
import '../../../../app/theme/supplier_decorations.dart';
import '../../../auth/application/auth_providers.dart';
import '../../../../core/errors/api_exception.dart';
import 'supplier_dark_form_field.dart';
import 'supplier_feedback.dart';

Future<void> showChangePasswordDialog(BuildContext context) {
  final isCompact = MediaQuery.sizeOf(context).width < 600;

  if (isCompact) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => const Padding(
        padding: EdgeInsets.only(top: AppSpacing.lg),
        child: ChangePasswordSheet(),
      ),
    );
  }

  return showDialog<void>(
    context: context,
    builder: (context) => const Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: EdgeInsets.all(AppSpacing.xl),
      child: ChangePasswordSheet(),
    ),
  );
}

class ChangePasswordSheet extends ConsumerStatefulWidget {
  const ChangePasswordSheet({super.key});

  @override
  ConsumerState<ChangePasswordSheet> createState() =>
      _ChangePasswordSheetState();
}

class _ChangePasswordSheetState extends ConsumerState<ChangePasswordSheet> {
  final _formKey = GlobalKey<FormState>();
  final _currentPasswordController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  bool _isSubmitting = false;
  String? _formError;

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
      await ref.read(authRepositoryProvider).changePassword(
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

      Navigator.of(context).pop();
      showSupplierInfoSnackBar(
        context,
        'Password updated successfully.',
      );
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _isSubmitting = false;
        _formError = error.message;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }

      setState(() {
        _isSubmitting = false;
        _formError = 'Password could not be updated. Please try again.';
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
      return 'Password must be at least 8 characters.';
    }

    if (value == _currentPasswordController.text) {
      return 'New password must be different from your current password.';
    }

    return null;
  }

  String? _validateConfirmPassword(String? value) {
    final requiredError = _required(value);
    if (requiredError != null) {
      return requiredError;
    }

    if (value != _newPasswordController.text) {
      return 'Passwords do not match.';
    }

    return null;
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;

    return Material(
      color: Colors.transparent,
      child: Container(
        width: double.infinity,
        constraints: const BoxConstraints(maxWidth: 480),
        padding: EdgeInsets.fromLTRB(
          AppSpacing.lg,
          AppSpacing.lg,
          AppSpacing.lg,
          AppSpacing.lg + bottomInset,
        ),
        decoration: SupplierDecorations.sideInsightCard.copyWith(
          borderRadius: AppRadius.lgAll,
        ),
        child: SingleChildScrollView(
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Change password',
                        style: AuthDarkTextStyles.title(context),
                      ),
                    ),
                    IconButton(
                      onPressed: _isSubmitting
                          ? null
                          : () => Navigator.of(context).pop(),
                      icon: const Icon(Icons.close, color: AuthDarkColors.textMuted),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  'Enter your current password, then choose a new one.',
                  style: AuthDarkTextStyles.body(context),
                ),
                const SizedBox(height: AppSpacing.lg),
                SupplierDarkPasswordField(
                  controller: _currentPasswordController,
                  label: 'Current password',
                  textInputAction: TextInputAction.next,
                  autofillHints: const [AutofillHints.password],
                  validator: _required,
                  onChanged: (_) {
                    if (_formError != null) {
                      setState(() => _formError = null);
                    }
                  },
                ),
                const SupplierFieldGap(),
                SupplierDarkPasswordField(
                  controller: _newPasswordController,
                  label: 'New password',
                  textInputAction: TextInputAction.next,
                  autofillHints: const [AutofillHints.newPassword],
                  validator: _validateNewPassword,
                  onChanged: (_) {
                    if (_formError != null) {
                      setState(() => _formError = null);
                    }
                  },
                ),
                const SupplierFieldGap(),
                SupplierDarkPasswordField(
                  controller: _confirmPasswordController,
                  label: 'Confirm new password',
                  textInputAction: TextInputAction.done,
                  autofillHints: const [AutofillHints.newPassword],
                  validator: _validateConfirmPassword,
                  onFieldSubmitted: (_) => _submit(),
                  onChanged: (_) {
                    if (_formError != null) {
                      setState(() => _formError = null);
                    }
                  },
                ),
                if (_formError != null) ...[
                  const SizedBox(height: AppSpacing.md),
                  Text(
                    _formError!,
                    style: AuthDarkTextStyles.body(context).copyWith(
                      color: AuthDarkColors.error,
                    ),
                  ),
                ],
                const SizedBox(height: AppSpacing.lg),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: _isSubmitting ? null : _submit,
                    style: FilledButton.styleFrom(
                      backgroundColor: AuthDarkColors.accent,
                      foregroundColor: AuthDarkColors.background,
                      padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
                    ),
                    child: _isSubmitting
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('Update password'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
