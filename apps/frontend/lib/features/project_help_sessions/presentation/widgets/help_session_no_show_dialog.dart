import 'package:flutter/material.dart';

import '../../../../app/theme/app_theme_colors.dart';
import '../../../../shared/widgets/app_dialog_footer.dart';
import '../../../../shared/widgets/app_dialog_shell.dart';
import '../l10n/project_help_sessions_l10n.dart';

Future<bool> showHelpSessionNoShowDialog(BuildContext context) async {
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (dialogContext) {
      final colors = AppThemeColors.of(dialogContext);
      return AppDialogShell(
        title: Text(
          ProjectHelpSessionsL10n.noShowConfirmTitle.resolve(dialogContext),
        ),
        content: Text(
          ProjectHelpSessionsL10n.noShowConfirmBody.resolve(dialogContext),
        ),
        footer: AppDialogFooter.decision(
          secondaryAction: TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: Text(
              MaterialLocalizations.of(dialogContext).cancelButtonLabel,
            ),
          ),
          primaryAction: FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: colors.warning,
              foregroundColor: colors.textOnPrimary,
            ),
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: Text(
              ProjectHelpSessionsL10n.noShowConfirmAction.resolve(
                dialogContext,
              ),
            ),
          ),
        ),
      );
    },
  );
  return confirmed == true;
}
