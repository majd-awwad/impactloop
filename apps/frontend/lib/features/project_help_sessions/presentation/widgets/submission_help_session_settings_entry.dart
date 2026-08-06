import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/navigation_extensions.dart';
import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../learning_hub/domain/models/learning_project_submission.dart';
import '../../application/project_help_sessions_providers.dart';
import '../l10n/project_help_sessions_l10n.dart';

class SubmissionHelpSessionSettingsEntry extends ConsumerWidget {
  const SubmissionHelpSessionSettingsEntry({
    super.key,
    required this.submission,
  });

  final LearningProjectSubmission submission;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (submission.status != LearningProjectSubmissionStatus.published ||
        submission.id.trim().isEmpty) {
      return const SizedBox.shrink();
    }

    final settingsAsync = ref.watch(
      projectHelpSessionSettingsProvider(submission.id),
    );

    return settingsAsync.when(
      loading: () => const SizedBox.shrink(),
      error: (_, _) => const SizedBox.shrink(),
      data: (settings) {
        final statusLabel = settings.isEnabled
            ? ProjectHelpSessionsL10n.settingsAvailable
            : ProjectHelpSessionsL10n.settingsPaused;
        return Padding(
          padding: const EdgeInsetsDirectional.only(top: AppSpacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: () => context.push(
                    creatorProjectHelpSessionSettingsRoute(submission.id),
                  ),
                  borderRadius: AppRadius.mdAll,
                  child: Container(
                    padding: const EdgeInsetsDirectional.all(AppSpacing.md),
                    decoration: BoxDecoration(
                      borderRadius: AppRadius.mdAll,
                      border: Border.all(
                        color: Theme.of(context)
                            .dividerColor
                            .withValues(alpha: 0.4),
                      ),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.support_agent_outlined),
                        const SizedBox(width: AppSpacing.md),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                ProjectHelpSessionsL10n.submissionSettingsLink
                                    .resolve(context),
                                style: AppTextStyles.label(context),
                              ),
                              const SizedBox(height: AppSpacing.xs),
                              AppStatusBadge(
                                label: statusLabel.resolve(context),
                                tone: settings.isEnabled
                                    ? AppStatusTone.success
                                    : AppStatusTone.neutral,
                              ),
                            ],
                          ),
                        ),
                        Icon(
                          Directionality.of(context) == TextDirection.rtl
                              ? Icons.chevron_left
                              : Icons.chevron_right,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              Align(
                alignment: AlignmentDirectional.centerStart,
                child: TextButton.icon(
                  onPressed: () => context.push(
                    '$creatorHelpSessionsRoute?projectId=${Uri.encodeComponent(submission.id)}',
                  ),
                  icon: const Icon(Icons.forum_outlined),
                  label: Text(
                    ProjectHelpSessionsL10n.viewHelpRequestsAction.resolve(
                      context,
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
