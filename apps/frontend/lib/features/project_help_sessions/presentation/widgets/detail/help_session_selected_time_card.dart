import 'package:flutter/material.dart';

import '../../../../../app/theme/app_spacing.dart';
import '../../../../../app/theme/app_text_styles.dart';
import '../../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../data/models/project_help_session_models.dart';
import '../../l10n/project_help_sessions_l10n.dart';
import '../help_session_status_utils.dart';
import 'help_session_detail_primitives.dart';

class HelpSessionSelectedTimeCard extends StatelessWidget {
  const HelpSessionSelectedTimeCard({
    super.key,
    required this.session,
    this.joinAvailableAt,
    this.joinClosesAt,
    this.availabilityNote,
    this.emphasize = true,
  });

  final ProjectHelpSession session;
  final DateTime? joinAvailableAt;
  final DateTime? joinClosesAt;
  final String? availabilityNote;
  final bool emphasize;

  @override
  Widget build(BuildContext context) {
    final startsAt = session.selectedStartsAt;
    if (startsAt == null) {
      return const SizedBox.shrink();
    }

    final isArabic = Localizations.localeOf(context).languageCode == 'ar';
    final palette = MaterialsUiPalette.of(context);
    final formatted =
        formatHelpSessionDateTime(context, startsAt, session.learnerTimeZone);

    return HelpSessionDetailCard(
      accentBorder: emphasize,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          HelpSessionDetailSectionTitle(
            isArabic ? 'الموعد المؤكد' : 'Confirmed session time',
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            formatted,
            style: AppTextStyles.title(context).copyWith(fontSize: 20),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            ProjectHelpSessionsL10n.durationLabel(session.durationMinutes)
                .resolve(context),
            style: AppTextStyles.label(context),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            ProjectHelpSessionsL10n.timezoneDisplay(session.learnerTimeZone)
                .resolve(context),
            style: AppTextStyles.label(context).copyWith(
              color: palette.textSecondary,
            ),
          ),
          if (joinAvailableAt != null) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              '${isArabic ? 'يفتح الانضمام' : 'Join opens'}: ${formatHelpSessionDateTime(context, joinAvailableAt!, session.learnerTimeZone)}',
              style: AppTextStyles.label(context),
            ),
          ],
          if (joinClosesAt != null) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              '${isArabic ? 'ينتهي الانضمام' : 'Join closes'}: ${formatHelpSessionDateTime(context, joinClosesAt!, session.learnerTimeZone)}',
              style: AppTextStyles.label(context),
            ),
          ],
          if (availabilityNote != null) ...[
            const SizedBox(height: AppSpacing.sm),
            HelpSessionDetailMutedText(availabilityNote!),
          ],
        ],
      ),
    );
  }
}
