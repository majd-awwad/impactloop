import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/widgets/app_close_button.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';

/// Result of the driver delivery verification dialog.
sealed class CompleteDeliveryChoice {
  const CompleteDeliveryChoice();
}

class CompleteDeliveryManualCode extends CompleteDeliveryChoice {
  const CompleteDeliveryManualCode(this.code);
  final String code;
}

class CompleteDeliveryScanQr extends CompleteDeliveryChoice {
  const CompleteDeliveryScanQr();
}

class CompleteDeliveryDialog extends StatefulWidget {
  const CompleteDeliveryDialog({
    super.key,
    this.allowScan = true,
  });

  /// When false, only the manual confirmation-code path is shown.
  final bool allowScan;

  static Future<CompleteDeliveryChoice?> show(
    BuildContext context, {
    bool allowScan = true,
  }) {
    return showDialog<CompleteDeliveryChoice>(
      context: context,
      builder: (context) => CompleteDeliveryDialog(allowScan: allowScan),
    );
  }

  @override
  State<CompleteDeliveryDialog> createState() => _CompleteDeliveryDialogState();
}

class _CompleteDeliveryDialogState extends State<CompleteDeliveryDialog> {
  final _codeController = TextEditingController();
  String? _errorText;

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  void _submit() {
    final code = _codeController.text.trim();
    if (!RegExp(r'^\d{6}$').hasMatch(code)) {
      setState(() {
        _errorText = context.l10n.supplierPickupConfirmationCodeError;
      });
      return;
    }

    Navigator.of(context).pop(CompleteDeliveryManualCode(code));
  }

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final actionStyle = AppStatusStyle.of(context, AppStatusTone.success);
    final compact = MediaQuery.sizeOf(context).width < 480;
    final dialogWidth = compact ? MediaQuery.sizeOf(context).width - 32 : 420.0;

    return Dialog(
      backgroundColor: palette.cardSurface,
      insetPadding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.lg,
      ),
      shape: RoundedRectangleBorder(
        borderRadius: AppRadius.lgAll,
        side: BorderSide(color: actionStyle.border),
      ),
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: dialogWidth),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.lg,
            AppSpacing.lg,
            AppSpacing.lg,
            AppSpacing.md,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      context.l10n.completeDeliveryDialogTitle,
                      style: AppTextStyles.title(context).copyWith(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: palette.textPrimary,
                      ),
                    ),
                  ),
                  AppCloseButton(onPressed: () => Navigator.of(context).pop()),
                ],
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                context.l10n.driverLearnerDeliveryCodeMessage,
                style: AppTextStyles.body(context).copyWith(
                  color: palette.textSecondary,
                  fontSize: 14,
                ),
              ),
              if (widget.allowScan) ...[
                const SizedBox(height: AppSpacing.lg),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: () =>
                        Navigator.of(context).pop(const CompleteDeliveryScanQr()),
                    icon: const Icon(Icons.qr_code_scanner),
                    label: Text(context.l10n.completeDeliveryScanQr),
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                Row(
                  children: [
                    Expanded(child: Divider(color: palette.borderSubtle)),
                    Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.sm,
                      ),
                      child: Text(
                        context.l10n.supplierPickupVerificationOr,
                        style: AppTextStyles.body(context).copyWith(
                          color: palette.textSecondary,
                          fontSize: 13,
                        ),
                      ),
                    ),
                    Expanded(child: Divider(color: palette.borderSubtle)),
                  ],
                ),
              ],
              const SizedBox(height: AppSpacing.md),
              TextField(
                controller: _codeController,
                keyboardType: TextInputType.number,
                textAlign: TextAlign.center,
                maxLength: 6,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                decoration: InputDecoration(
                  labelText: context.l10n.completeDeliveryManualCode,
                  counterText: '',
                  errorText: _errorText,
                ),
                onChanged: (_) {
                  if (_errorText != null) {
                    setState(() => _errorText = null);
                  }
                },
                onSubmitted: (_) => _submit(),
              ),
              const SizedBox(height: AppSpacing.lg),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: _submit,
                  style: AppStatusButtonStyle.filled(
                    context,
                    AppStatusTone.success,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                  child: Text(context.l10n.driverMarkDelivered),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
