import 'package:flutter/material.dart';

import '../../../../../app/theme/app_spacing.dart';
import '../../../../../app/theme/app_text_styles.dart';
import '../../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../data/models/project_help_session_models.dart';
import '../../l10n/project_help_sessions_l10n.dart';
import '../help_session_status_utils.dart';
import 'help_session_detail_primitives.dart';

class HelpSessionTerminalStateCard extends StatelessWidget {
  const HelpSessionTerminalStateCard({
    super.key,
    required this.session,
    required this.viewerIsLearner,
    this.onBackToBuild,
    this.onRequestAgain,
  });

  final ProjectHelpSession session;
  final bool viewerIsLearner;
  final VoidCallback? onBackToBuild;
  final VoidCallback? onRequestAgain;

  @override
  Widget build(BuildContext context) {
    final isArabic = Localizations.localeOf(context).languageCode == 'ar';
    final palette = MaterialsUiPalette.of(context);

    return switch (session.status) {
      ProjectHelpSessionStatus.declined => HelpSessionDetailCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              HelpSessionDetailSectionTitle(
                ProjectHelpSessionsL10n.declinedTitle.resolve(context),
              ),
              const SizedBox(height: AppSpacing.sm),
              if (session.declinedReason != null &&
                  session.declinedReason!.trim().isNotEmpty)
                Text(session.declinedReason!.trim())
              else
                HelpSessionDetailMutedText(
                  isArabic
                      ? 'لم يقدّم صاحب المشروع سببًا.'
                      : 'No reason was provided.',
                ),
              if (onBackToBuild != null || onRequestAgain != null) ...[
                const SizedBox(height: AppSpacing.md),
                Wrap(
                  spacing: AppSpacing.sm,
                  runSpacing: AppSpacing.sm,
                  children: [
                    if (onBackToBuild != null)
                      FilledButton(
                        onPressed: onBackToBuild,
                        child: Text(
                          isArabic ? 'العودة إلى المشروع' : 'Back to project',
                        ),
                      ),
                    if (onRequestAgain != null)
                      OutlinedButton(
                        onPressed: onRequestAgain,
                        child: Text(
                          ProjectHelpSessionsL10n.sendRequest.resolve(context),
                        ),
                      ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ProjectHelpSessionStatus.cancelled => HelpSessionDetailCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              HelpSessionDetailSectionTitle(
                ProjectHelpSessionsL10n.sessionCancelledOverview.resolve(context),
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                localizedCancellationActorLabel(
                  context: context,
                  session: session,
                  viewerIsLearner: viewerIsLearner,
                ),
                style: AppTextStyles.label(context).copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
              if (session.cancelledAt != null) ...[
                const SizedBox(height: AppSpacing.xs),
                Text(
                  formatHelpSessionDateTime(
                    context,
                    session.cancelledAt!,
                    session.learnerTimeZone,
                  ),
                  style: AppTextStyles.label(context).copyWith(
                    color: palette.textSecondary,
                  ),
                ),
              ],
              if (session.cancellationReason != null &&
                  readableCancellationReason(session.cancellationReason)
                      .isNotEmpty) ...[
                const SizedBox(height: AppSpacing.sm),
                Text(readableCancellationReason(session.cancellationReason)),
              ],
            ],
          ),
        ),
      ProjectHelpSessionStatus.completed => HelpSessionDetailCard(
          accentBorder: true,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              HelpSessionDetailSectionTitle(
                ProjectHelpSessionsL10n.completedTitle.resolve(context),
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(ProjectHelpSessionsL10n.completedLearnerBody.resolve(context)),
              if (session.completedAt != null) ...[
                const SizedBox(height: AppSpacing.sm),
                Text(
                  '${isArabic ? 'اكتملت في' : 'Completed at'}: ${formatHelpSessionDateTime(context, session.completedAt!, session.learnerTimeZone)}',
                  style: AppTextStyles.label(context),
                ),
              ],
              if (session.selectedStartsAt != null) ...[
                const SizedBox(height: AppSpacing.xs),
                Text(
                  formatHelpSessionDateTime(
                    context,
                    session.selectedStartsAt!,
                    session.learnerTimeZone,
                  ),
                ),
                Text(
                  ProjectHelpSessionsL10n.durationLabel(session.durationMinutes)
                      .resolve(context),
                ),
              ],
            ],
          ),
        ),
      _ => const SizedBox.shrink(),
    };
  }
}
