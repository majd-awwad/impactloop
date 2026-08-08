import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../l10n/l10n.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../shared/models/localized_text.dart';
import '../../../../shared/widgets/app_dialog_footer.dart';
import '../../../../shared/widgets/app_dialog_shell.dart';
import '../../../../shared/widgets/app_feedback.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../auth/application/auth_controller.dart';
import '../../../materials/data/material_reports_api.dart';

class MaterialDetailsReportSection extends ConsumerWidget {
  const MaterialDetailsReportSection({required this.materialId});

  final String materialId;

  static const _reasons = <String, String>{
    'MISLEADING_INFORMATION': 'Misleading information',
    'WRONG_CATEGORY': 'Wrong category',
    'WRONG_PRICE': 'Wrong price',
    'INAPPROPRIATE': 'Inappropriate material',
    'ITEM_NOT_AVAILABLE': 'Item not available',
    'SUSPICIOUS_SUPPLIER': 'Suspicious supplier',
    'OTHER': 'Other',
  };

  Future<void> _openReportDialog(BuildContext context, WidgetRef ref) async {
    final auth = ref.read(authControllerProvider);
    if (!auth.isAuthenticated) {
      showInfoSnackBar(
        context,
        const LocalizedText(
          en: 'Please sign in to report this material.',
          ar: 'يرجى تسجيل الدخول للإبلاغ عن هذه المادة.',
        ).resolve(context),
      );
      return;
    }

    var selectedReason = _reasons.keys.first;
    final noteController = TextEditingController();
    final submitted = await showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (context, setState) {
            return AppDialogShell(
              title: Text(
                const LocalizedText(
                  en: 'Report material',
                  ar: 'الإبلاغ عن المادة',
                ).resolve(context),
              ),
              maxWidth: 420,
              onClose: () => Navigator.of(dialogContext).pop(false),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  DropdownButtonFormField<String>(
                    initialValue: selectedReason,
                    decoration: const InputDecoration(labelText: 'Reason'),
                    items: _reasons.entries
                        .map(
                          (entry) => DropdownMenuItem(
                            value: entry.key,
                            child: Text(entry.value),
                          ),
                        )
                        .toList(),
                    onChanged: (value) {
                      if (value == null) return;
                      setState(() => selectedReason = value);
                    },
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: noteController,
                    maxLines: 4,
                    decoration: InputDecoration(
                      labelText: selectedReason == 'OTHER'
                          ? 'Describe the issue (required)'
                          : 'Additional note (optional)',
                    ),
                  ),
                ],
              ),
              footer: AppDialogFooter.form(
                primaryAction: FilledButton(
                  onPressed: () {
                    if (selectedReason == 'OTHER' &&
                        noteController.text.trim().isEmpty) {
                      return;
                    }
                    Navigator.of(dialogContext).pop(true);
                  },
                  style: AppStatusButtonStyle.filled(
                    context,
                    AppStatusTone.danger,
                  ),
                  child: const Text('Submit report'),
                ),
              ),
            );
          },
        );
      },
    );

    if (submitted != true) {
      noteController.dispose();
      return;
    }

    try {
      final message = await ref
          .read(materialReportsApiProvider)
          .submitReport(
            materialId: materialId,
            reason: selectedReason,
            note: noteController.text.trim(),
          );
      noteController.dispose();
      if (!context.mounted) return;
      showInfoSnackBar(context, message);
    } on ApiException catch (error) {
      noteController.dispose();
      if (!context.mounted) return;
      showErrorSnackBar(
        context,
        localizedApiErrorMessage(error, context.l10n),
      );
    } catch (_) {
      noteController.dispose();
      if (!context.mounted) return;
      showErrorSnackBar(
        context,
        const LocalizedText(
          en: 'Could not submit report right now.',
          ar: 'تعذر إرسال البلاغ حالياً.',
        ).resolve(context),
      );
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Align(
      alignment: AlignmentDirectional.centerStart,
      child: TextButton.icon(
        onPressed: () => _openReportDialog(context, ref),
        style: AppStatusButtonStyle.text(context, AppStatusTone.danger),
        icon: const Icon(Icons.flag_outlined, size: 18),
        label: Text(
          const LocalizedText(
            en: 'Report material',
            ar: 'الإبلاغ عن المادة',
          ).resolve(context),
          style: AppTextStyles.label(context),
        ),
      ),
    );
  }
}

