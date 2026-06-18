import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_colors.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';
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
    final compact = MediaQuery.sizeOf(context).width < 480;
    final dialogWidth = compact
        ? MediaQuery.sizeOf(context).width - 32
        : 420.0;

    return Dialog(
      backgroundColor: AuthDarkColors.surfaceSolid,
      insetPadding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.lg,
      ),
      shape: RoundedRectangleBorder(
        borderRadius: AppRadius.lgAll,
        side: BorderSide(color: AuthDarkColors.border.withValues(alpha: 0.4)),
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
                  'Decline request',
                  style: AuthDarkTextStyles.title(context).copyWith(
                    fontSize: 20,
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  'You can add an optional reason for the learner.',
                  style: AuthDarkTextStyles.body(context).copyWith(
                    color: AuthDarkColors.textPrimary,
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(AppSpacing.sm),
                  decoration: BoxDecoration(
                    color: AuthDarkColors.chipUnselected.withValues(alpha: 0.5),
                    borderRadius: AppRadius.mdAll,
                  ),
                  child: Text(
                    '${widget.materialTitle} · ${widget.learnerName}',
                    style: AuthDarkTextStyles.label(context).copyWith(
                      color: AuthDarkColors.textPrimary,
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.lg),
                SupplierDarkTextArea(
                  controller: _reasonController,
                  label: 'Reason (optional)',
                  hint: 'Already reserved for another learner.',
                  maxLines: 3,
                ),
                const SizedBox(height: AppSpacing.lg),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => Navigator.of(context).pop(),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AuthDarkColors.textSecondary,
                          side: BorderSide(
                            color: AuthDarkColors.border.withValues(alpha: 0.45),
                          ),
                          padding: const EdgeInsets.symmetric(vertical: 12),
                        ),
                        child: const Text('Cancel'),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: FilledButton(
                        onPressed: () {
                          final reason = _reasonController.text.trim();
                          Navigator.of(context).pop((
                            result: DeclineIncomingRequestResult.declined,
                            reason: reason.isEmpty ? null : reason,
                          ));
                        },
                        style: FilledButton.styleFrom(
                          backgroundColor:
                              AuthDarkColors.error.withValues(alpha: 0.88),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 12),
                        ),
                        child: const Text('Decline request'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
