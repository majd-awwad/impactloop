import 'package:flutter/material.dart';

import '../../../../../app/theme/app_spacing.dart';
import '../../../data/models/project_help_session_models.dart';
import '../../l10n/project_help_sessions_l10n.dart';
import 'help_session_detail_primitives.dart';
import 'help_session_time_card.dart';

class HelpSessionProposedTimesSection extends StatelessWidget {
  const HelpSessionProposedTimesSection({
    super.key,
    required this.session,
    this.selectable = false,
    this.selectedOptionId,
    this.onSelect,
    this.highlightAlternative = false,
  });

  final ProjectHelpSession session;
  final bool selectable;
  final String? selectedOptionId;
  final ValueChanged<String>? onSelect;
  final bool highlightAlternative;

  @override
  Widget build(BuildContext context) {
    final isArabic = Localizations.localeOf(context).languageCode == 'ar';
    final learnerOptions = session.timeOptions
        .where(
          (item) =>
              item.type == ProjectHelpSessionTimeOptionType.learnerProposed,
        )
        .toList();
    final alternativeOptions = session.timeOptions
        .where(
          (item) =>
              item.type == ProjectHelpSessionTimeOptionType.authorAlternative,
        )
        .toList();

    if (learnerOptions.isEmpty && alternativeOptions.isEmpty) {
      return const SizedBox.shrink();
    }

    return HelpSessionDetailCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          HelpSessionDetailSectionTitle(
            highlightAlternative
                ? (isArabic ? 'الموعد البديل' : 'Alternative time')
                : (isArabic ? 'المواعيد المقترحة' : 'Proposed times'),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            ProjectHelpSessionsL10n.timezoneDisplay(session.learnerTimeZone)
                .resolve(context),
            style: Theme.of(context).textTheme.labelSmall,
          ),
          const SizedBox(height: AppSpacing.sm),
          if (learnerOptions.isNotEmpty &&
              session.status == ProjectHelpSessionStatus.alternativeProposed) ...[
            Text(
              isArabic ? 'خياراتك الأصلية' : 'Your original options',
              style: Theme.of(context).textTheme.labelMedium,
            ),
            const SizedBox(height: AppSpacing.xs),
            for (final option in learnerOptions)
              HelpSessionTimeCard(
                startsAt: option.startsAt,
                timezone: session.learnerTimeZone,
              ),
            const SizedBox(height: AppSpacing.sm),
          ],
          if (highlightAlternative && alternativeOptions.isNotEmpty) ...[
            Text(
              isArabic
                  ? 'اقتراح صاحب المشروع'
                  : 'Project creator suggestion',
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
            ),
            const SizedBox(height: AppSpacing.xs),
            for (final option in alternativeOptions)
              HelpSessionTimeCard(
                startsAt: option.startsAt,
                timezone: session.learnerTimeZone,
                highlighted: true,
              ),
          ] else if (session.status == ProjectHelpSessionStatus.pending ||
              (learnerOptions.isNotEmpty &&
                  session.status != ProjectHelpSessionStatus.alternativeProposed))
            for (final option in learnerOptions)
              HelpSessionTimeCard(
                startsAt: option.startsAt,
                timezone: session.learnerTimeZone,
                selectable: selectable,
                selected: selectedOptionId == option.id,
                onTap: selectable && onSelect != null
                    ? () => onSelect!(option.id)
                    : null,
              )
          else if (alternativeOptions.isNotEmpty)
            for (final option in alternativeOptions)
              HelpSessionTimeCard(
                startsAt: option.startsAt,
                timezone: session.learnerTimeZone,
                highlighted: highlightAlternative,
              ),
        ],
      ),
    );
  }
}
