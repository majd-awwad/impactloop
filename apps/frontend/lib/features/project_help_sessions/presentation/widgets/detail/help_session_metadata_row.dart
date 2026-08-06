import 'package:flutter/material.dart';

import '../../../../../app/theme/app_spacing.dart';
import '../../../../../app/theme/app_text_styles.dart';
import '../../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../data/models/project_help_session_models.dart';
import '../../l10n/project_help_sessions_l10n.dart';
import '../help_session_status_utils.dart';

class HelpSessionMetadataRow extends StatelessWidget {
  const HelpSessionMetadataRow({super.key, required this.session});

  final ProjectHelpSession session;

  @override
  Widget build(BuildContext context) {
    final isArabic = Localizations.localeOf(context).languageCode == 'ar';
    final items = <Widget>[
      _chip(
        context,
        isArabic
            ? 'محاولة #${session.build.attemptNumber}'
            : 'Attempt #${session.build.attemptNumber}',
      ),
      _chip(
        context,
        ProjectHelpSessionsL10n.durationLabel(session.durationMinutes)
            .resolve(context),
      ),
      _chip(
        context,
        session.learnerTimeZone,
      ),
      if (session.projectStep != null)
        _chip(
          context,
          '#${session.projectStep!.stepNumber} ${session.projectStep!.title}',
        ),
      _chip(
        context,
        '${isArabic ? 'تاريخ الطلب' : 'Requested'}: ${formatHelpSessionDateTime(context, session.createdAt, session.learnerTimeZone)}',
      ),
    ];

    return Wrap(
      spacing: AppSpacing.xs,
      runSpacing: AppSpacing.xs,
      children: items,
    );
  }

  Widget _chip(BuildContext context, String label) {
    final palette = MaterialsUiPalette.of(context);
    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.sm,
        vertical: 4,
      ),
      decoration: BoxDecoration(
        color: palette.inputSurface,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Text(
        label,
        style: AppTextStyles.label(context).copyWith(fontSize: 12),
      ),
    );
  }
}
