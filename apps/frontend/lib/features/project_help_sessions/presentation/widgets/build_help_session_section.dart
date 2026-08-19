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
import '../../application/project_help_session_canonical_cache.dart';
import '../../application/project_help_sessions_providers.dart';
import '../../data/models/project_help_session_models.dart';
import '../l10n/project_help_sessions_l10n.dart';
import 'detail/help_session_status_copy.dart';
import 'help_session_request_flow.dart';
import 'help_session_status_utils.dart';

class BuildHelpSessionSection extends ConsumerStatefulWidget {
  const BuildHelpSessionSection({
    super.key,
    required this.buildRecord,
  });

  final ProjectBuild buildRecord;

  @override
  ConsumerState<BuildHelpSessionSection> createState() =>
      _BuildHelpSessionSectionState();
}

class _BuildHelpSessionSectionState extends ConsumerState<BuildHelpSessionSection> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) {
        return;
      }
      ref.invalidate(
        activeHelpSessionForBuildProvider(widget.buildRecord.id),
      );
    });
  }

  bool _isEligible(ProjectBuildStatus status) {
    return status == ProjectBuildStatus.inProgress ||
        status == ProjectBuildStatus.paused;
  }

  @override
  Widget build(BuildContext context) {
    if (!_isEligible(widget.buildRecord.status)) {
      return const SizedBox.shrink();
    }

    final availabilityAsync = ref.watch(
      projectHelpSessionAvailabilityProvider(widget.buildRecord.projectId),
    );
    final activeSessionAsync = ref.watch(
      activeHelpSessionForBuildProvider(widget.buildRecord.id),
    );

    return availabilityAsync.when(
      loading: () => const SizedBox.shrink(),
      error: (_, _) => const SizedBox.shrink(),
      data: (availability) {
        return activeSessionAsync.when(
          loading: () => const SizedBox.shrink(),
          error: (_, _) => const SizedBox.shrink(),
          data: (activeSession) {
            final session = resolveCanonicalActiveHelpSessionForBuild(
              ref,
              widget.buildRecord.id,
              activeSession,
            );
            if (session != null) {
              return _ActiveSessionCard(session: session);
            }
            if (!availability.available) {
              return _SubtleMessage(
                text: ProjectHelpSessionsL10n.availabilityMessage(
                  availability.reason,
                ).resolve(context),
              );
            }
            return _RequestCard(
              availability: availability,
              onRequest: () => showProjectHelpSessionRequestFlow(
                context: context,
                ref: ref,
                build: widget.buildRecord,
                availability: availability,
              ),
            );
          },
        );
      },
    );
  }
}

class _RequestCard extends StatelessWidget {
  const _RequestCard({
    required this.availability,
    required this.onRequest,
  });

  final ProjectHelpSessionAvailability availability;
  final VoidCallback onRequest;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final isCompact = MediaQuery.sizeOf(context).width < 720;
    final durations = availability.allowedDurations;

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: const Color(0xFFE8F5E9),
              borderRadius: AppRadius.mdAll,
            ),
            child: const Icon(
              Icons.support_agent_outlined,
              color: Color(0xFF2E7D32),
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  ProjectHelpSessionsL10n.requestCta.resolve(context),
                  style: AppTextStyles.label(context).copyWith(
                    color: palette.textPrimary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  ProjectHelpSessionsL10n.requestSupporting.resolve(context),
                  style: AppTextStyles.body(context).copyWith(
                    color: palette.textSecondary,
                    fontSize: 13,
                  ),
                ),
                if (durations.isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.sm),
                  Wrap(
                    spacing: AppSpacing.xs,
                    runSpacing: AppSpacing.xs,
                    children: durations
                        .map(
                          (duration) => Chip(
                            label: Text(
                              ProjectHelpSessionsL10n.durationLabel(duration)
                                  .resolve(context),
                              style: AppTextStyles.label(context).copyWith(
                                fontSize: 12,
                              ),
                            ),
                            visualDensity: VisualDensity.compact,
                            materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                            padding: const EdgeInsets.symmetric(horizontal: 4),
                          ),
                        )
                        .toList(),
                  ),
                ],
                const SizedBox(height: AppSpacing.xs),
                Text(
                  ProjectHelpSessionsL10n.privateSessionNote.resolve(context),
                  style: AppTextStyles.label(context).copyWith(
                    color: palette.textMuted,
                    fontSize: 12,
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: SizedBox(
                    width: isCompact ? double.infinity : null,
                    child: FilledButton(
                      onPressed: onRequest,
                      style: isCompact
                          ? null
                          : FilledButton.styleFrom(
                              minimumSize: const Size(0, 48),
                              padding: const EdgeInsets.symmetric(
                                horizontal: AppSpacing.lg,
                              ),
                            ),
                      child: Text(
                        ProjectHelpSessionsL10n.sendRequest.resolve(context),
                      ),
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

class _ActiveSessionCard extends StatelessWidget {
  const _ActiveSessionCard({required this.session});

  final ProjectHelpSession session;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final isCompact = MediaQuery.sizeOf(context).width < 720;
    final summary = HelpSessionStatusCopy.activeCardSummary(
      context: context,
      session: session,
    );
    final learnerOptions = session.timeOptions
        .where(
          (item) =>
              item.type == ProjectHelpSessionTimeOptionType.learnerProposed,
        )
        .length;
    final timeSummary = session.selectedStartsAt != null
        ? formatHelpSessionDateTime(
            context,
            session.selectedStartsAt!,
            session.learnerTimeZone,
          )
        : (learnerOptions > 0
            ? (Localizations.localeOf(context).languageCode == 'ar'
                ? '$learnerOptions مواعيد مقترحة'
                : '$learnerOptions proposed times')
            : null);

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: isCompact
          ? Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _ActiveSessionCardHeader(session: session, summary: summary),
                if (timeSummary != null) ...[
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    timeSummary,
                    style: AppTextStyles.label(context).copyWith(
                      color: palette.textSecondary,
                    ),
                  ),
                ],
                const SizedBox(height: AppSpacing.md),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton(
                    onPressed: () =>
                        context.push(learnerHelpSessionDetailRoute(session.id)),
                    child: Text(
                      ProjectHelpSessionsL10n.viewSession.resolve(context),
                    ),
                  ),
                ),
              ],
            )
          : Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: const Color(0xFFE8F5E9),
                    borderRadius: AppRadius.mdAll,
                  ),
                  child: const Icon(
                    Icons.support_agent_outlined,
                    color: Color(0xFF2E7D32),
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: _ActiveSessionCardHeader(
                    session: session,
                    summary: summary,
                    timeSummary: timeSummary,
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                OutlinedButton(
                  onPressed: () =>
                      context.push(learnerHelpSessionDetailRoute(session.id)),
                  child: Text(
                    ProjectHelpSessionsL10n.viewSession.resolve(context),
                  ),
                ),
              ],
            ),
    );
  }
}

class _ActiveSessionCardHeader extends StatelessWidget {
  const _ActiveSessionCardHeader({
    required this.session,
    required this.summary,
    this.timeSummary,
  });

  final ProjectHelpSession session;
  final String summary;
  final String? timeSummary;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.xs,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            Text(
              ProjectHelpSessionsL10n.activeSessionTitle.resolve(context),
              style: AppTextStyles.label(context).copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
            AppStatusBadge(
              label: ProjectHelpSessionsL10n.statusLabel(session.status)
                  .resolve(context),
              tone: helpSessionStatusTone(session.status),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          ProjectHelpSessionsL10n.projectCreatorLabel(session.author.displayName)
              .resolve(context),
          style: AppTextStyles.label(context).copyWith(
            color: palette.textSecondary,
            fontSize: 12,
          ),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          ProjectHelpSessionsL10n.durationLabel(session.durationMinutes)
              .resolve(context),
          style: AppTextStyles.label(context).copyWith(fontSize: 12),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          summary,
          style: AppTextStyles.body(context).copyWith(
            color: palette.textSecondary,
            fontSize: 13,
          ),
        ),
        if (timeSummary != null) ...[
          const SizedBox(height: AppSpacing.xs),
          Text(
            timeSummary!,
            style: AppTextStyles.label(context).copyWith(
              color: palette.textSecondary,
            ),
          ),
        ],
      ],
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
