import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/router/navigation_extensions.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../shared/widgets/app_dialog_footer.dart';
import '../../../../shared/widgets/app_dialog_shell.dart';
import '../../application/help_session_mutation_feedback.dart';
import '../../application/project_help_session_canonical_cache.dart';
import '../../application/project_help_session_mutation.dart';
import '../../application/project_help_session_private_zoom_action.dart';
import '../../application/project_help_session_zoom_launcher.dart';
import '../../application/project_help_sessions_providers.dart';
import '../../data/models/project_help_session_models.dart';
import '../l10n/project_help_sessions_l10n.dart';
import '../widgets/author_alternative_propose_flow.dart';
import '../widgets/detail/help_session_action_panel.dart';
import '../widgets/detail/help_session_detail_shell.dart';
import '../widgets/detail/help_session_hero_header.dart';
import '../widgets/detail/help_session_problem_section.dart';
import '../widgets/detail/help_session_proposed_times_section.dart';
import '../widgets/detail/help_session_selected_time_card.dart';
import '../widgets/detail/help_session_status_copy.dart';
import '../widgets/detail/help_session_terminal_state_card.dart';
import '../widgets/detail/help_session_timeline_section.dart';
import '../widgets/help_session_boundary_refresh.dart';
import '../widgets/help_session_live_refresh.dart';
import '../widgets/help_session_cancel_dialog.dart';
import '../widgets/help_session_request_flow.dart';
import '../widgets/help_session_status_utils.dart';

class CreatorHelpSessionDetailPage extends ConsumerStatefulWidget {
  const CreatorHelpSessionDetailPage({super.key, required this.sessionId});

  final String sessionId;

  @override
  ConsumerState<CreatorHelpSessionDetailPage> createState() =>
      _CreatorHelpSessionDetailPageState();
}

class _CreatorHelpSessionDetailPageState
    extends ConsumerState<CreatorHelpSessionDetailPage> {
  String? _selectedOptionId;
  bool _joinInFlight = false;
  bool _completeInFlight = false;

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
        authorView: true,
      );
    });
  }

  void _ensureDefaultOptionSelection(ProjectHelpSession session) {
    final actions = effectiveAuthorAllowedActions(session);
    if (session.status != ProjectHelpSessionStatus.pending ||
        !actions.canAcceptOption ||
        _selectedOptionId != null) {
      return;
    }
    final options = session.timeOptions
        .where(
          (item) =>
              item.type == ProjectHelpSessionTimeOptionType.learnerProposed,
        )
        .toList();
    if (options.isEmpty) {
      return;
    }
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || _selectedOptionId != null) {
        return;
      }
      setState(() => _selectedOptionId = options.first.id);
    });
  }

  Future<void> _refresh() async {
    ref.invalidate(authorHelpSessionDetailProvider(widget.sessionId));
    await ref.read(authorHelpSessionDetailProvider(widget.sessionId).future);
  }

  Future<void> _runAuthorSessionMutation({
    required ProjectHelpSession session,
    required Future<ProjectHelpSession?> Function() mutate,
    required bool Function(ProjectHelpSession session) recoveryMatches,
  }) async {
    try {
      await runProjectHelpSessionMutationWithRecovery(
        ref: ref,
        sessionId: session.id,
        authorView: true,
        mutate: mutate,
        recoveryMatches: recoveryMatches,
      );
    } catch (error) {
      if (mounted) {
        await handleHelpSessionRequestError(context, error);
      }
    }
  }

  Future<void> _accept(ProjectHelpSession session) async {
    final optionId = _selectedOptionId;
    final actions = effectiveAuthorAllowedActions(session);
    if (optionId == null || !actions.canAcceptOption) {
      return;
    }
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AppDialogShell(
        title: Text(
          ProjectHelpSessionsL10n.acceptConfirmTitle.resolve(context),
        ),
        content: Text(
          ProjectHelpSessionsL10n.acceptConfirmBody.resolve(context),
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
            child: Text(
              ProjectHelpSessionsL10n.acceptConfirmPrimary.resolve(context),
            ),
          ),
        ),
      ),
    );
    if (confirmed != true || !mounted) {
      return;
    }
    await _runAuthorSessionMutation(
      session: session,
      mutate: () => ref
          .read(projectHelpSessionActionControllerProvider.notifier)
          .acceptOption(sessionId: session.id, timeOptionId: optionId),
      recoveryMatches: helpSessionRecoveryAccepted,
    );
  }

  Future<void> _proposeAlternative(ProjectHelpSession session) async {
    if (!effectiveAuthorAllowedActions(session).canProposeAlternative) {
      return;
    }
    final utc = await showAuthorAlternativeProposeFlow(
      context: context,
      session: session,
    );
    if (utc == null || !mounted) {
      return;
    }
    await _runAuthorSessionMutation(
      session: session,
      mutate: () => ref
          .read(projectHelpSessionActionControllerProvider.notifier)
          .proposeAlternative(sessionId: session.id, startsAtUtc: utc),
      recoveryMatches: helpSessionRecoveryAlternativeProposed,
    );
  }

  Future<void> _decline(ProjectHelpSession session) async {
    if (!effectiveAuthorAllowedActions(session).canDecline) {
      return;
    }
    final reasonController = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AppDialogShell(
        title: Text(ProjectHelpSessionsL10n.declineTitle.resolve(context)),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(ProjectHelpSessionsL10n.declineBody.resolve(context)),
              const SizedBox(height: AppSpacing.sm),
              TextField(
                controller: reasonController,
                maxLength: 300,
                decoration: InputDecoration(
                  labelText: ProjectHelpSessionsL10n.cancelReasonLabel
                      .resolve(context),
                ),
              ),
            ],
          ),
        ),
        footer: AppDialogFooter.decision(
          secondaryAction: TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(
              Localizations.localeOf(context).languageCode == 'ar'
                  ? 'رجوع'
                  : 'Back',
            ),
          ),
          primaryAction: FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: Theme.of(context).colorScheme.error,
            ),
            onPressed: () => Navigator.of(context).pop(true),
            child: Text(ProjectHelpSessionsL10n.declinePrimary.resolve(context)),
          ),
        ),
      ),
    );
    if (confirmed != true || !mounted) {
      reasonController.dispose();
      return;
    }
    final reason = reasonController.text.trim();
    reasonController.dispose();
    await _runAuthorSessionMutation(
      session: session,
      mutate: () => ref
          .read(projectHelpSessionActionControllerProvider.notifier)
          .declineSession(
            sessionId: session.id,
            reason: reason.isEmpty ? null : reason,
          ),
      recoveryMatches: helpSessionRecoveryDeclined,
    );
  }

  Future<void> _retryZoom(ProjectHelpSession session) async {
    if (!effectiveAuthorAllowedActions(session).canRetryZoom) {
      return;
    }
    await _runAuthorSessionMutation(
      session: session,
      mutate: () => ref
          .read(projectHelpSessionActionControllerProvider.notifier)
          .retryZoom(session.id),
      recoveryMatches: helpSessionRecoveryZoomRetried,
    );
  }

  Future<void> _joinZoom(ProjectHelpSession session) async {
    if (_joinInFlight || !effectiveAuthorAllowedActions(session).canJoin) {
      return;
    }
    final authSnapshot = captureProjectHelpSessionAuthSnapshot(ref);
    if (authSnapshot == null) {
      return;
    }
    setState(() => _joinInFlight = true);
    try {
      final result = await ref
          .read(projectHelpSessionsApiProvider)
          .joinAuthorZoom(session.id);
      if (!mounted ||
          !projectHelpSessionAuthSnapshotIsCurrent(ref, authSnapshot)) {
        return;
      }
      final launched = await ref.read(
        projectHelpSessionZoomJoinLauncherProvider,
      )(result.joinUrl);
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

  Future<void> _complete(ProjectHelpSession session) async {
    if (_completeInFlight || !effectiveAuthorAllowedActions(session).canComplete) {
      return;
    }
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AppDialogShell(
        title: Text(
          ProjectHelpSessionsL10n.completionConfirmTitle.resolve(context),
        ),
        content: SingleChildScrollView(
          child: Text(
            ProjectHelpSessionsL10n.completionConfirmBody.resolve(context),
          ),
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
            child: Text(
              ProjectHelpSessionsL10n.completionConfirmPrimary.resolve(context),
            ),
          ),
        ),
      ),
    );
    if (confirmed != true || !mounted) {
      return;
    }
    setState(() => _completeInFlight = true);
    try {
      await _runAuthorSessionMutation(
        session: session,
        mutate: () => ref
            .read(projectHelpSessionActionControllerProvider.notifier)
            .completeSession(session.id),
        recoveryMatches: helpSessionRecoveryCompleted,
      );
    } finally {
      if (mounted) {
        setState(() => _completeInFlight = false);
      }
    }
  }

  Future<void> _cancel(ProjectHelpSession session) async {
    if (!effectiveAuthorAllowedActions(session).canCancel) {
      return;
    }
    final requiresReason = session.status != ProjectHelpSessionStatus.pending;
    await showHelpSessionCancelDialog(
      context: context,
      requiresReason: requiresReason,
      showConfirmedWarning: requiresReason,
      onSubmit: (reason) async {
        await completeAuthorHelpSessionCancel(
          ref: ref,
          sessionId: session.id,
          mutate: () => ref
              .read(projectHelpSessionActionControllerProvider.notifier)
              .cancelAuthorSession(
                sessionId: session.id,
                reason: reason,
              ),
        );
      },
    );
  }

  HelpSessionActionPanel _buildActionPanel(ProjectHelpSession session) {
    final actions = effectiveAuthorAllowedActions(session);
    HelpSessionActionSpec? primary;
    final secondary = <HelpSessionActionSpec>[];
    final management = <HelpSessionActionSpec>[];

    if (session.status == ProjectHelpSessionStatus.pending) {
      primary = HelpSessionActionSpec(
        label: ProjectHelpSessionsL10n.acceptSelectedTime.resolve(context),
        onPressed: actions.canAcceptOption && _selectedOptionId != null
            ? () => _accept(session)
            : null,
        disabledHint: _selectedOptionId == null
            ? ProjectHelpSessionsL10n.acceptSelectedTimeHint.resolve(context)
            : null,
      );
      secondary.add(
        HelpSessionActionSpec(
          label: ProjectHelpSessionsL10n.proposeAlternative.resolve(context),
          onPressed:
              actions.canProposeAlternative ? () => _proposeAlternative(session) : null,
        ),
      );
      secondary.add(
        HelpSessionActionSpec(
          label: ProjectHelpSessionsL10n.declineRequest.resolve(context),
          onPressed: actions.canDecline ? () => _decline(session) : null,
          destructive: true,
        ),
      );
    }

    if (session.status == ProjectHelpSessionStatus.schedulingFailed &&
        actions.canRetryZoom) {
      primary = HelpSessionActionSpec(
        label: ProjectHelpSessionsL10n.zoomRetryAction.resolve(context),
        onPressed: () => _retryZoom(session),
      );
    }

    if (session.status == ProjectHelpSessionStatus.scheduled ||
        session.status == ProjectHelpSessionStatus.zoomPending) {
      primary = HelpSessionActionSpec(
        label: ProjectHelpSessionsL10n.joinZoom.resolve(context),
        onPressed: actions.canJoin && !_joinInFlight
            ? () => _joinZoom(session)
            : null,
        inFlight: _joinInFlight,
        disabledHint: !actions.canJoin
            ? ProjectHelpSessionsL10n.joinOpensLater.resolve(context)
            : null,
        semanticLabel: actions.canJoin
            ? ProjectHelpSessionsL10n.joinZoom.resolve(context)
            : ProjectHelpSessionsL10n.joinOpensLater.resolve(context),
      );
    }
    if (session.status == ProjectHelpSessionStatus.scheduled) {
      secondary.add(
        HelpSessionActionSpec(
          label: ProjectHelpSessionsL10n.markSessionCompleted.resolve(context),
          onPressed: actions.canComplete && !_completeInFlight
              ? () => _complete(session)
              : null,
          inFlight: _completeInFlight,
          disabledHint: !actions.canComplete
              ? (session.completionAvailableAt != null
                  ? '${ProjectHelpSessionsL10n.completionAvailableAt.resolve(context)}: ${formatHelpSessionDateTime(context, session.completionAvailableAt!, session.learnerTimeZone)}'
                  : ProjectHelpSessionsL10n.sessionNotCompletableYet.resolve(context))
              : null,
        ),
      );
    }

    if (actions.canCancel) {
      management.add(
        HelpSessionActionSpec(
          label: ProjectHelpSessionsL10n.cancelRequest.resolve(context),
          onPressed: () => _cancel(session),
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
        role: HelpSessionDetailRole.author,
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
        if (session.status == ProjectHelpSessionStatus.pending)
          HelpSessionProposedTimesSection(
            session: session,
            selectable: effectiveAuthorAllowedActions(session).canAcceptOption,
            selectedOptionId: _selectedOptionId,
            onSelect: (id) => setState(() => _selectedOptionId = id),
          ),
        if (session.status == ProjectHelpSessionStatus.alternativeProposed)
          HelpSessionProposedTimesSection(
            session: session,
            highlightAlternative: true,
          ),
        if (session.selectedStartsAt != null &&
            session.status != ProjectHelpSessionStatus.pending)
          ...[
            const SizedBox(height: AppSpacing.md),
            HelpSessionSelectedTimeCard(
              session: session,
              emphasize: session.status == ProjectHelpSessionStatus.scheduled,
              availabilityNote: session.status == ProjectHelpSessionStatus.schedulingFailed
                  ? ProjectHelpSessionsL10n.zoomRetryBody.resolve(context)
                  : null,
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
        ref.watch(authorHelpSessionDetailProvider(widget.sessionId));

    return sessionAsync.when(
      loading: () => HelpSessionDetailShell(
        homeRoute: creatorHelpSessionsRoute,
        listTitle: ProjectHelpSessionsL10n.authorListTitle.resolve(context),
        backRoute: creatorHelpSessionsRoute,
        isLoading: true,
        isError: false,
        onRetry: _refresh,
      ),
      error: (_, _) => HelpSessionDetailShell(
        homeRoute: creatorHelpSessionsRoute,
        listTitle: ProjectHelpSessionsL10n.authorListTitle.resolve(context),
        backRoute: creatorHelpSessionsRoute,
        isLoading: false,
        isError: true,
        onRetry: _refresh,
      ),
      data: (fetched) {
        final session = resolveCanonicalHelpSession(
          ref,
          widget.sessionId,
          fetched,
          authorView: true,
        );
        _ensureDefaultOptionSelection(session);
        final isTerminal = session.status == ProjectHelpSessionStatus.declined ||
            session.status == ProjectHelpSessionStatus.cancelled ||
            session.status == ProjectHelpSessionStatus.completed;

        return HelpSessionLiveRefresh(
          sessionId: widget.sessionId,
          authorView: true,
          status: session.status,
          child: HelpSessionBoundaryRefresh(
          boundaryAt: session.completionAvailableAt,
          isBoundaryReached: effectiveAuthorAllowedActions(session).canComplete,
          onBoundary: () => ref.invalidate(
            authorHelpSessionDetailProvider(widget.sessionId),
          ),
          child: HelpSessionDetailShell(
            homeRoute: creatorHelpSessionsRoute,
            listTitle: ProjectHelpSessionsL10n.authorListTitle.resolve(context),
            backRoute: creatorHelpSessionsRoute,
            isLoading: false,
            isError: false,
            onRetry: _refresh,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                HelpSessionHeroHeader(
                  session: session,
                  role: HelpSessionDetailRole.author,
                ),
                const SizedBox(height: AppSpacing.md),
                if (isTerminal)
                  HelpSessionTerminalStateCard(
                    session: session,
                    viewerIsLearner: false,
                  )
                else
                  HelpSessionDetailLayout(
                    main: _buildMainContent(session),
                    sidebar: _buildActionPanel(session),
                  ),
              ],
            ),
          ),
        ),
        );
      },
    );
  }
}
