import 'package:flutter/material.dart';

import '../../../../../app/theme/app_spacing.dart';
import '../../../../../app/theme/app_text_styles.dart';
import '../../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../data/models/project_help_session_models.dart';
import '../help_session_status_utils.dart';
import 'help_session_detail_primitives.dart';

class HelpSessionProblemSection extends StatelessWidget {
  const HelpSessionProblemSection({super.key, required this.session});

  final ProjectHelpSession session;

  @override
  Widget build(BuildContext context) {
    final isArabic = Localizations.localeOf(context).languageCode == 'ar';
    final palette = MaterialsUiPalette.of(context);

    return HelpSessionDetailCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          HelpSessionDetailSectionTitle(
            isArabic ? 'المشكلة' : 'Problem',
          ),
          if (session.projectStep != null) ...[
            const SizedBox(height: AppSpacing.sm),
            Container(
              padding: const EdgeInsetsDirectional.symmetric(
                horizontal: AppSpacing.sm,
                vertical: 4,
              ),
              decoration: BoxDecoration(
                color: palette.inputSurface,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                '${isArabic ? 'الخطوة' : 'Step'} #${session.projectStep!.stepNumber} · ${session.projectStep!.title}',
                style: AppTextStyles.label(context),
              ),
            ),
          ],
          const SizedBox(height: AppSpacing.sm),
          Container(
            width: double.infinity,
            padding: const EdgeInsetsDirectional.all(AppSpacing.sm),
            decoration: BoxDecoration(
              color: palette.inputSurface,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              session.problemDescription,
              style: AppTextStyles.body(context).copyWith(height: 1.45),
              softWrap: true,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            '${isArabic ? 'تاريخ الطلب' : 'Requested'}: ${formatHelpSessionDateTime(context, session.createdAt, session.learnerTimeZone)}',
            style: AppTextStyles.label(context).copyWith(
              color: palette.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}
