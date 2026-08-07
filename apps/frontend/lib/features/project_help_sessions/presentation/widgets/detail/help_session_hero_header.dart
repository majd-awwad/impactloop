import 'package:flutter/material.dart';

import '../../../../../app/theme/app_spacing.dart';
import '../../../../../app/theme/app_text_styles.dart';
import '../../../../../shared/widgets/app_status_badge.dart';
import '../../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../data/models/project_help_session_models.dart';
import '../../l10n/project_help_sessions_l10n.dart';
import '../help_session_status_utils.dart';
import 'help_session_detail_primitives.dart';
import 'help_session_metadata_row.dart';
import 'help_session_participant_summary.dart';
import 'help_session_status_copy.dart';

class HelpSessionHeroHeader extends StatelessWidget {
  const HelpSessionHeroHeader({
    super.key,
    required this.session,
    required this.role,
  });

  final ProjectHelpSession session;
  final HelpSessionDetailRole role;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final isCompact = MediaQuery.sizeOf(context).width < 768;
    final participant = role == HelpSessionDetailRole.learner
        ? session.author
        : session.learner;
    final participantLabel = role == HelpSessionDetailRole.learner
        ? ProjectHelpSessionsL10n.projectCreatorLabel(participant.displayName)
            .resolve(context)
        : ProjectHelpSessionsL10n.learnerLabel(participant.displayName)
            .resolve(context);

    final statusOverview = HelpSessionStatusCopy.overview(
      context: context,
      session: session,
      role: role,
    );

    final metadata = HelpSessionMetadataRow(session: session);

    final statusBadge = AppStatusBadge(
      label: (role == HelpSessionDetailRole.author
              ? ProjectHelpSessionsL10n.authorStatusLabel(session.status)
              : ProjectHelpSessionsL10n.statusLabel(session.status))
          .resolve(context),
      tone: helpSessionStatusTone(session.status),
    );

    if (isCompact) {
      return HelpSessionDetailCard(
        accentBorder: true,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Text(
                    session.project.title,
                    style: AppTextStyles.title(context),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                statusBadge,
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            HelpSessionParticipantSummary(
              displayName: participant.displayName,
              profileImageUrl: participant.profileImageUrl,
              subtitle: participantLabel,
            ),
            const SizedBox(height: AppSpacing.sm),
            HelpSessionDetailMutedText(statusOverview),
            const SizedBox(height: AppSpacing.sm),
            metadata,
          ],
        ),
      );
    }

    return HelpSessionDetailCard(
      accentBorder: true,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            flex: 3,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  session.project.title,
                  style: AppTextStyles.title(context).copyWith(fontSize: 22),
                ),
                const SizedBox(height: AppSpacing.sm),
                HelpSessionParticipantSummary(
                  displayName: participant.displayName,
                  profileImageUrl: participant.profileImageUrl,
                  subtitle: participantLabel,
                ),
                const SizedBox(height: AppSpacing.sm),
                metadata,
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.lg),
          Expanded(
            flex: 2,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Align(
                  alignment: AlignmentDirectional.centerEnd,
                  child: statusBadge,
                ),
                const SizedBox(height: AppSpacing.sm),
                Container(
                  padding: const EdgeInsetsDirectional.all(AppSpacing.sm),
                  decoration: BoxDecoration(
                    color: palette.inputSurface,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    statusOverview,
                    style: AppTextStyles.body(context).copyWith(
                      color: palette.textSecondary,
                      height: 1.4,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
