import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/navigation_extensions.dart';
import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../learning_hub/domain/models/project_build.dart';
import '../../application/project_help_sessions_providers.dart';
import '../../data/models/project_help_session_models.dart';
import '../l10n/project_help_sessions_l10n.dart';
import 'help_session_request_flow.dart';
import 'help_session_status_utils.dart';

class BuildHelpSessionSection extends ConsumerWidget {
  const BuildHelpSessionSection({
    super.key,
    required this.buildRecord,
  });

  final ProjectBuild buildRecord;

  bool _isEligible(ProjectBuildStatus status) {
    return status == ProjectBuildStatus.inProgress ||
        status == ProjectBuildStatus.paused;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!_isEligible(buildRecord.status)) {
      return const SizedBox.shrink();
    }

    final availabilityAsync =
        ref.watch(projectHelpSessionAvailabilityProvider(buildRecord.projectId));
    final activeSessionAsync =
        ref.watch(activeHelpSessionForBuildProvider(buildRecord.id));

    return availabilityAsync.when(
      loading: () => const SizedBox.shrink(),
      error: (_, _) => const SizedBox.shrink(),
      data: (availability) {
        return activeSessionAsync.when(
          loading: () => const SizedBox.shrink(),
          error: (_, _) => const SizedBox.shrink(),
          data: (activeSession) {
            if (activeSession != null) {
              return _ActiveSessionCard(session: activeSession);
            }
            if (!availability.available) {
              final copy = availability.reason == 'DISABLED'
                  ? ProjectHelpSessionsL10n.disabledCopy
                  : ProjectHelpSessionsL10n.unavailableCopy;
              return _SubtleMessage(
                text: copy.resolve(context),
              );
            }
            return _RequestCard(
              onRequest: () async {
                final session = await showProjectHelpSessionRequestFlow(
                  context: context,
                  ref: ref,
                  build: buildRecord,
                  availability: availability,
                );
                if (session != null && context.mounted) {
                  context.push(learnerHelpSessionDetailRoute(session.id));
                }
              },
            );
          },
        );
      },
    );
  }
}

class _RequestCard extends StatelessWidget {
  const _RequestCard({required this.onRequest});

  final VoidCallback onRequest;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: palette.panelSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            ProjectHelpSessionsL10n.requestCta.resolve(context),
            style: AppTextStyles.title(context).copyWith(
              color: palette.textPrimary,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            ProjectHelpSessionsL10n.requestSupporting.resolve(context),
            style: AppTextStyles.body(context).copyWith(
              color: palette.textSecondary,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          FilledButton(
            onPressed: onRequest,
            child: Text(ProjectHelpSessionsL10n.sendRequest.resolve(context)),
          ),
        ],
      ),
    );
  }
}

class _ActiveSessionCard extends StatelessWidget {
  const _ActiveSessionCard({required this.session});

  final ProjectHelpSession session;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: palette.panelSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              AppStatusBadge(
                label: ProjectHelpSessionsL10n.statusLabel(session.status)
                    .resolve(context),
                tone: helpSessionStatusTone(session.status),
              ),
              const Spacer(),
              if (session.selectedStartsAt != null)
                Text(
                  formatHelpSessionDateTime(
                    context,
                    session.selectedStartsAt!,
                    session.learnerTimeZone,
                  ),
                  style: AppTextStyles.label(context).copyWith(
                    color: palette.textSecondary,
                  ),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          OutlinedButton(
            onPressed: () =>
                context.push(learnerHelpSessionDetailRoute(session.id)),
            child: Text(ProjectHelpSessionsL10n.viewSession.resolve(context)),
          ),
        ],
      ),
    );
  }
}

class _SubtleMessage extends StatelessWidget {
  const _SubtleMessage({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    return Text(
      text,
      style: AppTextStyles.label(context).copyWith(color: palette.textMuted),
    );
  }
}
