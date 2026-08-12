import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/navigation_extensions.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../application/help_session_mutation_feedback.dart';
import '../../application/project_help_session_canonical_cache.dart';
import '../../application/project_help_session_mutation.dart';
import '../../application/project_help_session_private_zoom_action.dart';
import '../../application/project_help_session_zoom_launcher.dart';
import '../../application/project_help_sessions_providers.dart';
import '../../data/models/project_help_session_models.dart';
import '../l10n/project_help_sessions_l10n.dart';
import '../widgets/detail/help_session_action_panel.dart';
import '../widgets/detail/help_session_detail_shell.dart';
import '../widgets/detail/help_session_hero_header.dart';
import '../widgets/detail/help_session_problem_section.dart';
import '../widgets/detail/help_session_proposed_times_section.dart';
import '../widgets/detail/help_session_selected_time_card.dart';
import '../widgets/detail/help_session_status_copy.dart';
import '../widgets/detail/help_session_terminal_state_card.dart';
import '../widgets/detail/help_session_timeline_section.dart';
import '../widgets/help_session_cancel_dialog.dart';
import '../widgets/help_session_live_refresh.dart';
import '../widgets/help_session_request_flow.dart';
import '../../../../shared/widgets/app_dialog_footer.dart';
import '../../../../shared/widgets/app_dialog_shell.dart';

class LearnerHelpSessionDetailPage extends ConsumerStatefulWidget {
  const LearnerHelpSessionDetailPage({super.key, required this.sessionId});

  final String sessionId;

  @override
  ConsumerState<LearnerHelpSessionDetailPage> createState() =>
      _LearnerHelpSessionDetailPageState();
}

class _LearnerHelpSessionDetailPageState
    extends ConsumerState<LearnerHelpSessionDetailPage> {
  bool _joinInFlight = false;
  bool _notebookInFlight = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) {
        return;
      }
      prepareHelpSessionDetailNavigation(
        ref,
        sessionId: widget.sessionId,
        authorView: false,
      );
    });
  }

  Future<void> _refresh() async {
    ref.invalidate(learnerHelpSessionDetailProvider(widget.sessionId));
    await ref.read(learnerHelpSessionDetailProvider(widget.sessionId).future);
  }

  Future<void> _runLearnerSessionMutation({
    required ProjectHelpSession session,
    required Future<ProjectHelpSession?> Function() mutate,
    required bool Function(ProjectHelpSession session) recoveryMatches,
  }) async {
    try {
      await runProjectHelpSessionMutationWithRecovery(
        ref: ref,
        sessionId: session.id,
        authorView: false,
        mutate: mutate,
        recoveryMatches: recoveryMatches,
      );
    } catch (error) {
      if (mounted) {
        await handleHelpSessionRequestError(context, error);
      }
    }
  }

  Future<void> _acceptAlternative(ProjectHelpSession session) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AppDialogShell(
        title: Text(
          ProjectHelpSessionsL10n.acceptAlternativeTitle.resolve(context),
        ),
        content: Text(
          ProjectHelpSessionsL10n.acceptAlternativeBody.resolve(context),
        ),
        footer: AppDialogFooter.decision(
          secondaryAction: TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(
              Localizations.localeOf(context).languageCode == 'ar'
                  ? 'إلغاء'
                  : 'Cancel',
            ),
          ),
          primaryAction: FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: Text(ProjectHelpSessionsL10n.confirmTime.resolve(context)),
          ),
        ),
      ),
    );
    if (confirmed != true || !mounted) {
      return;
    }
    await _runLearnerSessionMutation(
      session: session,
      mutate: () => ref
          .read(projectHelpSessionActionControllerProvider.notifier)
          .acceptAlternative(session.id),
      recoveryMatches: helpSessionRecoveryAccepted,
    );
  }

  Future<void> _rejectAlternative(ProjectHelpSession session) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AppDialogShell(
        title: Text(
          ProjectHelpSessionsL10n.rejectAlternativeTitle.resolve(context),
        ),
        content: Text(
          ProjectHelpSessionsL10n.rejectAlternativeBody.resolve(context),
        ),
        footer: AppDialogFooter.decision(
          secondaryAction: TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(
              Localizations.localeOf(context).languageCode == 'ar'
                  ? 'إلغاء'
                  : 'Cancel',
            ),
          ),
          primaryAction: FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: Text(ProjectHelpSessionsL10n.rejectTime.resolve(context)),
          ),
        ),
      ),
    );
    if (confirmed != true || !mounted) {
      return;
    }
    await _runLearnerSessionMutation(
      session: session,
      mutate: () => ref
          .read(projectHelpSessionActionControllerProvider.notifier)
          .rejectAlternative(session.id),
      recoveryMatches: helpSessionRecoveryCancelled,
    );
  }

  Future<void> _cancelSession(ProjectHelpSession session) async {
    if (!session.allowedActions.canCancel) {
      return;
    }
    final requiresReason = session.status != ProjectHelpSessionStatus.pending;
    await showHelpSessionCancelDialog(
      context: context,
      requiresReason: requiresReason,
      showConfirmedWarning: requiresReason,
      onSubmit: (reason) async {
        await completeLearnerHelpSessionCancel(
          ref: ref,
          sessionId: session.id,
          mutate: () => ref
              .read(projectHelpSessionActionControllerProvider.notifier)
              .cancelSession(sessionId: session.id, reason: reason),
        );
      },
    );
  }

  Future<void> _join(ProjectHelpSession session) async {
    final actions = effectiveLearnerAllowedActions(session);
    if (_joinInFlight || !actions.canJoin) {
      return;
    }
    final authSnapshot = captureProjectHelpSessionAuthSnapshot(ref);
    if (authSnapshot == null) {
      return;
    }
    setState(() => _joinInFlight = true);
    try {
      final joinUrl =
          (await ref.read(projectHelpSessionsApiProvider).joinZoom(session.id))
              .joinUrl;
      if (!mounted ||
          !projectHelpSessionAuthSnapshotIsCurrent(ref, authSnapshot)) {
        return;
      }
      final launched = await ref.read(
        projectHelpSessionZoomJoinLauncherProvider,
      )(joinUrl);
      if (!launched && mounted) {
        showHelpSessionZoomLaunchFailure(context);
      }
    } catch (error) {
      if (mounted) {
        await handleHelpSessionRequestError(context, error);
      }
    } finally {
      if (mounted) {
        setState(() => _joinInFlight = false);
      }
    }
  }

  Future<void> _openNotebookNotes(ProjectHelpSession session) async {
    if (_notebookInFlight ||
        session.status != ProjectHelpSessionStatus.completed) {
      return;
    }
    setState(() => _notebookInFlight = true);
    Object? mutationError;
    ProjectHelpSessionNotebookHandoff? handoff;
    try {
      final locale = Localizations.localeOf(context).languageCode;
      handoff = await runProjectHelpSessionMutation(
        () => ref
            .read(projectHelpSessionActionControllerProvider.notifier)
            .ensureNotebookNotes(sessionId: session.id, localeCode: locale),
      );
    } on ProjectHelpSessionMutationFailure catch (failure) {
      mutationError = failure.error;
    } finally {
      if (mounted) {
        setState(() => _notebookInFlight = false);
      }
    }
    if (!mounted) {
      return;
    }
    if (mutationError != null) {
      await handleHelpSessionRequestError(context, mutationError);
      return;
    }
    if (handoff == null) {
      return;
    }
    try {
      context.go(
        learnerBuildNotebookRoute(
          handoff.buildId,
          pageId: handoff.pageId,
        ),
      );
    } catch (error, stackTrace) {
      if (kDebugMode) {
        debugPrint('help-session notebook navigation failed: $error\n$stackTrace');
      }
    }
  }

  void _openNotebook(ProjectHelpSession session) {
    context.go(learnerBuildNotebookRoute(session.build.id));
  }

  HelpSessionActionPanel _buildActionPanel(ProjectHelpSession session) {
    final actions = effectiveLearnerAllowedActions(session);

    if (session.status == ProjectHelpSessionStatus.completed) {
      return HelpSessionActionPanel(
        title: ProjectHelpSessionsL10n.nextStep.resolve(context),
        primary: HelpSessionActionSpec(
          label: ProjectHelpSessionsL10n.addSessionNotesToNotebook.resolve(
            context,
          ),
          onPressed: _notebookInFlight ? null : () => _openNotebookNotes(session),
          inFlight: _notebookInFlight,
        ),
        secondary: [
          HelpSessionActionSpec(
            label: ProjectHelpSessionsL10n.openProjectNotebook.resolve(context),
            onPressed: () => _openNotebook(session),
          ),
        ],
      );
    }

    HelpSessionActionSpec? primary;
    final secondary = <HelpSessionActionSpec>[];
    final management = <HelpSessionActionSpec>[];

    if (actions.canJoin) {
      primary = HelpSessionActionSpec(
        label: ProjectHelpSessionsL10n.joinZoom.resolve(context),
        onPressed: _joinInFlight ? null : () => _join(session),
        inFlight: _joinInFlight,
      );
    } else if (session.status == ProjectHelpSessionStatus.scheduled) {
      primary = HelpSessionActionSpec(
        label: ProjectHelpSessionsL10n.joinZoom.resolve(context),
        onPressed: null,
        disabledHint: ProjectHelpSessionsL10n.joinOpensLater.resolve(context),
      );
    }

    if (actions.canAcceptAlternative) {
      primary = HelpSessionActionSpec(
        label: ProjectHelpSessionsL10n.confirmTime.resolve(context),
        onPressed: () => _acceptAlternative(session),
      );
      secondary.add(
        HelpSessionActionSpec(
          label: ProjectHelpSessionsL10n.rejectTime.resolve(context),
          onPressed: actions.canRejectAlternative
              ? () => _rejectAlternative(session)
              : null,
          destructive: true,
        ),
      );
    }

    if (actions.canCancel &&
        !actions.canRejectAlternative &&
        session.status != ProjectHelpSessionStatus.alternativeProposed) {
      management.add(
        HelpSessionActionSpec(
          label: ProjectHelpSessionsL10n.cancelRequest.resolve(context),
          onPressed: () => _cancelSession(session),
        ),
      );
    } else if (actions.canCancel &&
        session.status == ProjectHelpSessionStatus.alternativeProposed) {
      management.add(
        HelpSessionActionSpec(
          label: ProjectHelpSessionsL10n.cancelRequest.resolve(context),
          onPressed: () => _cancelSession(session),
        ),
      );
    } else if (actions.canCancel) {
      management.add(
        HelpSessionActionSpec(
          label: ProjectHelpSessionsL10n.cancelRequest.resolve(context),
          onPressed: () => _cancelSession(session),
        ),
      );
    }

    Widget? progressChild;
    if (session.status == ProjectHelpSessionStatus.zoomPending) {
      progressChild = ClipRRect(
        borderRadius: BorderRadius.circular(4),
        child: LinearProgressIndicator(
          minHeight: 4,
          value: 0.35,
          backgroundColor: Theme.of(context).dividerColor,
        ),
      );
    }

    return HelpSessionActionPanel(
      title: session.status.isActive
          ? ProjectHelpSessionsL10n.nextStep.resolve(context)
          : null,
      overview: HelpSessionStatusCopy.overview(
        context: context,
        session: session,
        role: HelpSessionDetailRole.learner,
      ),
      primary: primary,
      secondary: secondary,
      management: management,
      managementTitle: management.isNotEmpty
          ? ProjectHelpSessionsL10n.sessionManagement.resolve(context)
          : null,
      progressChild: progressChild,
    );
  }

  Widget _buildMainContent(ProjectHelpSession session) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        HelpSessionProblemSection(session: session),
        const SizedBox(height: AppSpacing.md),
        if (session.status == ProjectHelpSessionStatus.pending ||
            session.status == ProjectHelpSessionStatus.alternativeProposed)
          HelpSessionProposedTimesSection(
            session: session,
            highlightAlternative:
                session.status == ProjectHelpSessionStatus.alternativeProposed,
          ),
        if (session.selectedStartsAt != null &&
            session.status != ProjectHelpSessionStatus.pending)
          ...[
            const SizedBox(height: AppSpacing.md),
            HelpSessionSelectedTimeCard(
              session: session,
              joinAvailableAt: session.joinAvailableAt,
              joinClosesAt: session.joinClosesAt,
              availabilityNote: session.status == ProjectHelpSessionStatus.scheduled &&
                      !session.allowedActions.canJoin
                  ? ProjectHelpSessionsL10n.joinOpensLater.resolve(context)
                  : session.status == ProjectHelpSessionStatus.schedulingFailed
                      ? ProjectHelpSessionsL10n.zoomDelayedBody.resolve(context)
                      : null,
              emphasize: session.status == ProjectHelpSessionStatus.scheduled,
            ),
          ],
        const SizedBox(height: AppSpacing.md),
        HelpSessionTimelineSection(session: session),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final sessionAsync =
        ref.watch(learnerHelpSessionDetailProvider(widget.sessionId));

    return sessionAsync.when(
      loading: () => HelpSessionDetailShell(
        homeRoute: learnerHelpSessionsRoute,
        listTitle: ProjectHelpSessionsL10n.listTitle.resolve(context),
        backRoute: learnerHelpSessionsRoute,
        isLoading: true,
        isError: false,
        onRetry: _refresh,
      ),
      error: (_, _) => HelpSessionDetailShell(
        homeRoute: learnerHelpSessionsRoute,
        listTitle: ProjectHelpSessionsL10n.listTitle.resolve(context),
        backRoute: learnerHelpSessionsRoute,
        isLoading: false,
        isError: true,
        onRetry: _refresh,
      ),
      data: (fetched) {
        final session = resolveCanonicalHelpSession(
          ref,
          widget.sessionId,
          fetched,
          authorView: false,
        );
        final buildRoute = '/learning/${session.project.id}/build';
        final isTerminal = session.status == ProjectHelpSessionStatus.declined ||
            session.status == ProjectHelpSessionStatus.cancelled ||
            session.status == ProjectHelpSessionStatus.completed;

        return HelpSessionLiveRefresh(
          sessionId: widget.sessionId,
          authorView: false,
          status: session.status,
          child: HelpSessionDetailShell(
          homeRoute: learnerHelpSessionsRoute,
          listTitle: ProjectHelpSessionsL10n.listTitle.resolve(context),
          backRoute: learnerHelpSessionsRoute,
          buildRoute: buildRoute,
          buildRouteLabel: ProjectHelpSessionsL10n.backToProject.resolve(context),
          isLoading: false,
          isError: false,
          onRetry: _refresh,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              HelpSessionHeroHeader(
                session: session,
                role: HelpSessionDetailRole.learner,
              ),
              const SizedBox(height: AppSpacing.md),
              if (isTerminal)
                HelpSessionTerminalStateCard(
                  session: session,
                  viewerIsLearner: true,
                  onBackToBuild: session.status == ProjectHelpSessionStatus.declined
                      ? () => context.go(buildRoute)
                      : null,
                )
              else
                HelpSessionDetailLayout(
                  main: _buildMainContent(session),
                  sidebar: _buildActionPanel(session),
                ),
              if (isTerminal &&
                  session.status == ProjectHelpSessionStatus.completed) ...[
                const SizedBox(height: AppSpacing.md),
                _buildActionPanel(session),
              ],
            ],
          ),
        ),
        );
      },
    );
  }
}
