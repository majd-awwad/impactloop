import 'package:flutter/material.dart';

import 'package:frontend/features/supplier_portal/presentation/theme/supplier_theme_extension.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../shared/widgets/app_close_button.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../auth/application/auth_controller.dart';
import '../../../../core/errors/api_exception.dart';
import 'supplier_dark_form_field.dart';
import 'supplier_feedback.dart';
import '../../../../l10n/l10n.dart';

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

      Navigator.of(context).pop();
      showSupplierInfoSnackBar(context, context.s.passwordUpdated);
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
        _formError = context.s.passwordUpdateFailed;
      });
    }
  }

  String? _required(String? value) {
    if (value == null || value.trim().isEmpty) {
      return context.s.fieldRequired;
    }
    return null;
  }

  String? _validateNewPassword(String? value) {
    final requiredError = _required(value);
    if (requiredError != null) {
      return requiredError;
    }

    if (value!.length < 8) {
      return context.s.passwordMinLength;
    }

    if (value == _currentPasswordController.text) {
      return context.s.passwordMustDiffer;
    }

    return null;
  }

  String? _validateConfirmPassword(String? value) {
    final requiredError = _required(value);
    if (requiredError != null) {
      return requiredError;
    }

    if (value != _newPasswordController.text) {
      return context.s.passwordsDoNotMatch;
    }

    return null;
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
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
        decoration: context.supplierDecorations.sideInsightCard.copyWith(
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
                        context.s.changePassword,
                        style: context.supplierTitle(),
                      ),
                    ),
                    AppCloseButton(
                      onPressed: _isSubmitting
                          ? null
                          : () => Navigator.of(context).pop(),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  context.s.changePasswordIntro,
                  style: context.supplierBody(),
                ),
                const SizedBox(height: AppSpacing.lg),
                SupplierDarkPasswordField(
                  controller: _currentPasswordController,
                  label: context.s.currentPassword,
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
                  label: context.s.newPassword,
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
                  label: context.s.confirmNewPassword,
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
                    style: context.supplierBody().copyWith(color: colors.error),
                  ),
                ],
                const SizedBox(height: AppSpacing.lg),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: _isSubmitting ? null : _submit,
                    style: AppStatusButtonStyle.filled(
                      context,
                      AppStatusTone.primary,
                      padding: const EdgeInsets.symmetric(
                        vertical: AppSpacing.md,
                      ),
                    ),
                    child: _isSubmitting
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : Text(context.s.updatePassword),
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
