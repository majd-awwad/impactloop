import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../shared/widgets/app_dialog_footer.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import 'package:frontend/features/supplier_portal/presentation/theme/supplier_theme_extension.dart';
import 'supplier_dark_form_field.dart';

enum DeclineIncomingRequestResult { cancelled, declined }

class DeclineIncomingRequestDialog extends StatefulWidget {
  const DeclineIncomingRequestDialog({
    super.key,
    required this.materialTitle,
    required this.learnerName,
  });

  final String materialTitle;
  final String learnerName;

  static Future<({DeclineIncomingRequestResult result, String? reason})?> show(
    BuildContext context, {
    required String materialTitle,
    required String learnerName,
  }) {
    return showDialog<({DeclineIncomingRequestResult result, String? reason})>(
      context: context,
      builder: (context) => DeclineIncomingRequestDialog(
        materialTitle: materialTitle,
        learnerName: learnerName,
      ),
    );
  }

  @override
  State<DeclineIncomingRequestDialog> createState() =>
      _DeclineIncomingRequestDialogState();
}

class _DeclineIncomingRequestDialogState
    extends State<DeclineIncomingRequestDialog> {
  final _reasonController = TextEditingController();

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    final actionStyle = AppStatusStyle.of(context, AppStatusTone.danger);
    final compact = MediaQuery.sizeOf(context).width < 480;
    final dialogWidth = compact ? MediaQuery.sizeOf(context).width - 32 : 420.0;

    return Dialog(
      backgroundColor: colors.surfaceSolid,
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
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  context.s.declineRequest,
                  style: context.supplierTitle().copyWith(fontSize: 20),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  context.s.declineRequestSubtitle,
                  style: context.supplierBody().copyWith(
                    color: colors.textPrimary,
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(AppSpacing.sm),
                  decoration: BoxDecoration(
                    color: colors.chipUnselected.withValues(alpha: 0.5),
                    borderRadius: AppRadius.mdAll,
                  ),
                  child: Text(
                    '${widget.materialTitle} · ${widget.learnerName}',
                    style: context.supplierLabel().copyWith(
                      color: colors.textPrimary,
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.lg),
                SupplierDarkTextArea(
                  controller: _reasonController,
                  label: context.s.reasonOptional,
                  hint: context.s.declineReasonHint,
                  maxLines: 3,
                ),
                const SizedBox(height: AppSpacing.lg),
                AppDialogFooter.decision(
                  secondaryAction: OutlinedButton(
                    onPressed: () => Navigator.of(context).pop(),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: colors.textSecondary,
                      side: BorderSide(
                        color: colors.border.withValues(alpha: 0.45),
                      ),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                    child: Text(context.s.cancel),
                  ),
                  primaryAction: FilledButton(
                    onPressed: () {
                      final reason = _reasonController.text.trim();
                      Navigator.of(context).pop((
                        result: DeclineIncomingRequestResult.declined,
                        reason: reason.isEmpty ? null : reason,
                      ));
                    },
                    style: AppStatusButtonStyle.filled(
                      context,
                      AppStatusTone.danger,
                    ),
                    child: Text(context.s.declineRequest),
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
