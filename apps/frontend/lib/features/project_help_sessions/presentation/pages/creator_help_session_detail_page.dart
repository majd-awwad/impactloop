import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/navigation_extensions.dart';
import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/widgets/entry_nav_bar.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../shared/widgets/app_dialog_footer.dart';
import '../../../../shared/widgets/app_dialog_shell.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../../shared/widgets/user_avatar.dart';
import '../../application/project_help_session_zoom_launcher.dart';
import '../../application/project_help_sessions_providers.dart';
import '../../data/models/project_help_session_models.dart';
import '../l10n/project_help_sessions_l10n.dart';
import '../widgets/author_alternative_propose_flow.dart';
import '../widgets/help_session_boundary_refresh.dart';
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
  bool _startInFlight = false;
  bool _completeInFlight = false;

  Future<void> _refresh() async {
    ref.invalidate(authorHelpSessionDetailProvider(widget.sessionId));
    await ref.read(authorHelpSessionDetailProvider(widget.sessionId).future);
  }

  Future<void> _accept(ProjectHelpSession session) async {
    final optionId = _selectedOptionId;
    if (optionId == null || !session.authorAllowedActions.canAcceptOption) {
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
    try {
      await ref.read(projectHelpSessionActionControllerProvider.notifier).acceptOption(
            sessionId: session.id,
            timeOptionId: optionId,
          );
      invalidateAuthorHelpSessionProviders(ref, sessionId: session.id);
      await _refresh();
    } catch (error) {
      if (mounted) {
        await handleHelpSessionRequestError(context, error);
        await _refresh();
      }
    }
  }

  Future<void> _proposeAlternative(ProjectHelpSession session) async {
    if (!session.authorAllowedActions.canProposeAlternative) {
      return;
    }
    final utc = await showAuthorAlternativeProposeFlow(
      context: context,
      session: session,
    );
    if (utc == null || !mounted) {
      return;
    }
    try {
      await ref
          .read(projectHelpSessionActionControllerProvider.notifier)
          .proposeAlternative(sessionId: session.id, startsAtUtc: utc);
      invalidateAuthorHelpSessionProviders(ref, sessionId: session.id);
      await _refresh();
    } catch (error) {
      if (mounted) {
        await handleHelpSessionRequestError(context, error);
      }
    }
  }

  Future<void> _decline(ProjectHelpSession session) async {
    if (!session.authorAllowedActions.canDecline) {
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
    try {
      await ref.read(projectHelpSessionActionControllerProvider.notifier).declineSession(
            sessionId: session.id,
            reason: reason.isEmpty ? null : reason,
          );
      invalidateAuthorHelpSessionProviders(ref, sessionId: session.id);
      await _refresh();
    } catch (error) {
      if (mounted) {
        await handleHelpSessionRequestError(context, error);
      }
    }
  }

  Future<void> _retryZoom(ProjectHelpSession session) async {
    if (!session.authorAllowedActions.canRetryZoom) {
      return;
    }
    try {
      await ref
          .read(projectHelpSessionActionControllerProvider.notifier)
          .retryZoom(session.id);
      invalidateAuthorHelpSessionProviders(ref, sessionId: session.id);
      await _refresh();
    } catch (error) {
      if (mounted) {
        await handleHelpSessionRequestError(context, error);
        await _refresh();
      }
    }
  }

  Future<void> _startZoom(ProjectHelpSession session) async {
    if (_startInFlight || !session.authorAllowedActions.canStart) {
      return;
    }
    setState(() => _startInFlight = true);
    try {
      final result = await ref
          .read(projectHelpSessionActionControllerProvider.notifier)
          .startZoom(session.id);
      if (result == null || !mounted) {
        return;
      }
      final startUrl = result.startUrl;
      final launched = await launchProjectHelpSessionZoomStartUrl(startUrl);
      if (!launched && mounted) {
        await handleHelpSessionRequestError(
          context,
          ApiException(
            message: ProjectHelpSessionsL10n.startLaunchFailed.resolve(context),
            code: 'START_LAUNCH_FAILED',
          ),
        );
      }
    } catch (error) {
      if (mounted) {
        await handleHelpSessionRequestError(context, error);
        await _refresh();
      }
    } finally {
      if (mounted) {
        setState(() => _startInFlight = false);
      }
    }
  }

  Future<void> _complete(ProjectHelpSession session) async {
    if (_completeInFlight || !session.authorAllowedActions.canComplete) {
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
      await ref
          .read(projectHelpSessionActionControllerProvider.notifier)
          .completeSession(session.id);
      invalidateAuthorHelpSessionProviders(ref, sessionId: session.id);
      await _refresh();
    } catch (error) {
      if (mounted) {
        await handleHelpSessionRequestError(context, error);
        await _refresh();
      }
    } finally {
      if (mounted) {
        setState(() => _completeInFlight = false);
      }
    }
  }

  Future<void> _cancel(ProjectHelpSession session) async {
    if (!session.authorAllowedActions.canCancel) {
      return;
    }
    final reasonController = TextEditingController();
    final requiresReason = session.status != ProjectHelpSessionStatus.pending;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AppDialogShell(
        title: Text(ProjectHelpSessionsL10n.cancelTitle.resolve(context)),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                Localizations.localeOf(context).languageCode == 'ar'
                    ? 'سيتم إلغاء الموعد واجتماع Zoom وإبلاغ المتعلم.'
                    : 'The scheduled time and Zoom meeting will be cancelled and the learner will be notified.',
              ),
              const SizedBox(height: AppSpacing.sm),
              TextField(
                controller: reasonController,
                maxLength: 300,
                decoration: InputDecoration(
                  labelText: requiresReason
                      ? ProjectHelpSessionsL10n.cancelReasonRequired
                          .resolve(context)
                      : ProjectHelpSessionsL10n.cancelReasonLabel
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
            child: Text(ProjectHelpSessionsL10n.confirmCancel.resolve(context)),
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
    if (requiresReason && reason.isEmpty) {
      return;
    }
    try {
      await ref
          .read(projectHelpSessionActionControllerProvider.notifier)
          .cancelAuthorSession(
            sessionId: session.id,
            reason: reason.isEmpty ? null : reason,
          );
      invalidateAuthorHelpSessionProviders(ref, sessionId: session.id);
      await _refresh();
    } catch (error) {
      if (mounted) {
        await handleHelpSessionRequestError(context, error);
        await _refresh();
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final sessionAsync =
        ref.watch(authorHelpSessionDetailProvider(widget.sessionId));
    final isArabic = Localizations.localeOf(context).languageCode == 'ar';

    return Scaffold(
      backgroundColor: palette.pageBackground,
      body: SafeArea(
        child: Column(
          children: [
            EntryNavBar(
              showSignIn: false,
              showCreateAccount: false,
              homeRoute: creatorHelpSessionsRoute,
              phoneTitle: ProjectHelpSessionsL10n.authorListTitle.resolve(context),
            ),
            Expanded(
              child: sessionAsync.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (_, _) => Center(
                  child: TextButton(
                    onPressed: _refresh,
                    child: Text(ProjectHelpSessionsL10n.retry.resolve(context)),
                  ),
                ),
                data: (session) => HelpSessionBoundaryRefresh(
                  boundaryAt: session.completionAvailableAt,
                  isBoundaryReached: session.authorAllowedActions.canComplete,
                  onBoundary: () => ref.invalidate(
                    authorHelpSessionDetailProvider(widget.sessionId),
                  ),
                  child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 920),
                    child: SingleChildScrollView(
                      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          TextButton.icon(
                            onPressed: () => context.go(creatorHelpSessionsRoute),
                            icon: const Icon(Icons.arrow_back_rounded),
                            label: Text(
                              ProjectHelpSessionsL10n.authorListTitle
                                  .resolve(context),
                            ),
                          ),
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  session.project.title,
                                  style: AppTextStyles.title(context),
                                ),
                              ),
                              AppStatusBadge(
                                label: ProjectHelpSessionsL10n
                                    .authorStatusLabel(session.status)
                                    .resolve(context),
                                tone: helpSessionStatusTone(session.status),
                              ),
                            ],
                          ),
                          const SizedBox(height: AppSpacing.sm),
                          Row(
                            children: [
                              UserAvatar(
                                profileImageUrl: session.learner.profileImageUrl,
                                displayName: session.learner.displayName,
                                radius: 20,
                              ),
                              const SizedBox(width: AppSpacing.sm),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(session.learner.displayName),
                                    Text(
                                      '${isArabic ? 'محاولة' : 'Attempt'} #${session.build.attemptNumber} · ${ProjectHelpSessionsL10n.durationLabel(session.durationMinutes).resolve(context)}',
                                      style: AppTextStyles.label(context)
                                          .copyWith(color: palette.textSecondary),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: AppSpacing.lg),
                          _DetailSection(
                            title: isArabic ? 'المشكلة' : 'Problem',
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                if (session.projectStep != null)
                                  Text(
                                    '#${session.projectStep!.stepNumber} ${session.projectStep!.title}',
                                    style: AppTextStyles.label(context),
                                  ),
                                const SizedBox(height: AppSpacing.sm),
                                Text(session.problemDescription),
                                const SizedBox(height: AppSpacing.sm),
                                Text(
                                  '${isArabic ? 'تاريخ الطلب' : 'Requested'}: ${formatHelpSessionDateTime(context, session.createdAt, session.learnerTimeZone)}',
                                  style: AppTextStyles.label(context)
                                      .copyWith(color: palette.textSecondary),
                                ),
                              ],
                            ),
                          ),
                          if (session.status == ProjectHelpSessionStatus.pending) ...[
                            const SizedBox(height: AppSpacing.md),
                            _DetailSection(
                              title: isArabic
                                  ? 'المواعيد المقترحة'
                                  : 'Proposed times',
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  Text(
                                    ProjectHelpSessionsL10n.timezoneDisplay(
                                      session.learnerTimeZone,
                                    ).resolve(context),
                                    style: AppTextStyles.label(context)
                                        .copyWith(color: palette.textSecondary),
                                  ),
                                  const SizedBox(height: AppSpacing.sm),
                                  for (final option in session.timeOptions
                                      .where(
                                        (item) =>
                                            item.type ==
                                            ProjectHelpSessionTimeOptionType
                                                .learnerProposed,
                                      ))
                                    _SelectableTimeCard(
                                      selected: _selectedOptionId == option.id,
                                      label: formatHelpSessionDateTime(
                                        context,
                                        option.startsAt,
                                        session.learnerTimeZone,
                                      ),
                                      onTap: session
                                              .authorAllowedActions.canAcceptOption
                                          ? () => setState(
                                                () => _selectedOptionId =
                                                    option.id,
                                              )
                                          : null,
                                    ),
                                ],
                              ),
                            ),
                          ],
                          const SizedBox(height: AppSpacing.md),
                          _TimelineSection(session: session),
                          const SizedBox(height: AppSpacing.md),
                          _StatusPanels(session: session, onRetry: () => _retryZoom(session)),
                          if (session.status == ProjectHelpSessionStatus.scheduled) ...[
                            const SizedBox(height: AppSpacing.md),
                            _CompletionSection(
                              session: session,
                              completeInFlight: _completeInFlight,
                              onComplete: () => _complete(session),
                            ),
                          ],
                          if (session.status == ProjectHelpSessionStatus.completed &&
                              session.completedAt != null) ...[
                            const SizedBox(height: AppSpacing.md),
                            _DetailSection(
                              title: ProjectHelpSessionsL10n.completedTitle
                                  .resolve(context),
                              child: Text(
                                formatHelpSessionDateTime(
                                  context,
                                  session.completedAt!,
                                  session.learnerTimeZone,
                                ),
                              ),
                            ),
                          ],
                          const SizedBox(height: AppSpacing.lg),
                          _AuthorActions(
                            session: session,
                            selectedOptionId: _selectedOptionId,
                            startInFlight: _startInFlight,
                            onAccept: () => _accept(session),
                            onProposeAlternative: () =>
                                _proposeAlternative(session),
                            onDecline: () => _decline(session),
                            onStart: () => _startZoom(session),
                            onCancel: () => _cancel(session),
                            onRetry: () => _retryZoom(session),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DetailSection extends StatelessWidget {
  const _DetailSection({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: palette.panelSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: AppTextStyles.title(context)),
          const SizedBox(height: AppSpacing.sm),
          child,
        ],
      ),
    );
  }
}

class _SelectableTimeCard extends StatelessWidget {
  const _SelectableTimeCard({
    required this.selected,
    required this.label,
    required this.onTap,
  });

  final bool selected;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    return Padding(
      padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.sm),
      child: Semantics(
        selected: selected,
        button: onTap != null,
        label: label,
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: onTap,
            borderRadius: AppRadius.mdAll,
            child: Container(
              width: double.infinity,
              padding: const EdgeInsetsDirectional.all(AppSpacing.md),
              decoration: BoxDecoration(
                borderRadius: AppRadius.mdAll,
                border: Border.all(
                  color: selected ? palette.mint : palette.borderSubtle,
                  width: selected ? 2 : 1,
                ),
              ),
              child: Row(
                children: [
                  Icon(
                    selected
                        ? Icons.radio_button_checked
                        : Icons.radio_button_off,
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(child: Text(label)),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _TimelineSection extends StatelessWidget {
  const _TimelineSection({required this.session});

  final ProjectHelpSession session;

  @override
  Widget build(BuildContext context) {
    final isArabic = Localizations.localeOf(context).languageCode == 'ar';
    final events = <String>[
      isArabic ? 'تم استلام الطلب' : 'Request received',
      if (session.alternativeProposedAt != null)
        isArabic ? 'تم اقتراح موعد بديل' : 'Alternative time proposed',
      if (session.confirmedAt != null)
        isArabic ? 'تم تأكيد الموعد' : 'Time confirmed',
      if (session.status == ProjectHelpSessionStatus.zoomPending)
        isArabic ? 'جارٍ تجهيز Zoom' : 'Zoom preparation',
      if (session.status == ProjectHelpSessionStatus.scheduled)
        isArabic ? 'الجلسة مجدولة' : 'Session scheduled',
      if (session.status == ProjectHelpSessionStatus.schedulingFailed)
        isArabic ? 'تعذر تجهيز Zoom' : 'Zoom setup failed',
      if (session.status == ProjectHelpSessionStatus.declined)
        isArabic ? 'تم رفض الطلب' : 'Request declined',
      if (session.status == ProjectHelpSessionStatus.cancelled)
        isArabic ? 'تم إلغاء الجلسة' : 'Session cancelled',
      if (session.status == ProjectHelpSessionStatus.completed)
        isArabic ? 'اكتملت الجلسة' : 'Session completed',
    ];
    return _DetailSection(
      title: isArabic ? 'المسار' : 'Timeline',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (final event in events)
            Padding(
              padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.xs),
              child: Row(
                children: [
                  const Icon(Icons.circle, size: 8),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(child: Text(event)),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _StatusPanels extends StatelessWidget {
  const _StatusPanels({required this.session, required this.onRetry});

  final ProjectHelpSession session;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    if (session.status == ProjectHelpSessionStatus.alternativeProposed) {
      final alternative = session.timeOptions
          .where(
            (item) =>
                item.type ==
                ProjectHelpSessionTimeOptionType.authorAlternative,
          )
          .toList();
      return _DetailSection(
        title: ProjectHelpSessionsL10n.waitingLearnerAlternative.resolve(context),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (alternative.isNotEmpty)
              Text(
                formatHelpSessionDateTime(
                  context,
                  alternative.first.startsAt,
                  session.learnerTimeZone,
                ),
              ),
          ],
        ),
      );
    }
    if (session.status == ProjectHelpSessionStatus.schedulingFailed) {
      return _DetailSection(
        title: ProjectHelpSessionsL10n.zoomRetryTitle.resolve(context),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(ProjectHelpSessionsL10n.zoomRetryBody.resolve(context)),
            if (session.authorAllowedActions.canRetryZoom) ...[
              const SizedBox(height: AppSpacing.sm),
              FilledButton(
                onPressed: onRetry,
                child: Text(
                  ProjectHelpSessionsL10n.zoomRetryAction.resolve(context),
                ),
              ),
            ],
          ],
        ),
      );
    }
    if (session.selectedStartsAt != null &&
        (session.status == ProjectHelpSessionStatus.scheduled ||
            session.status == ProjectHelpSessionStatus.zoomPending)) {
      return _DetailSection(
        title: ProjectHelpSessionsL10n.filterScheduled.resolve(context),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              formatHelpSessionDateTime(
                context,
                session.selectedStartsAt!,
                session.learnerTimeZone,
              ),
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              ProjectHelpSessionsL10n.timezoneDisplay(session.learnerTimeZone)
                  .resolve(context),
              style: AppTextStyles.label(context),
            ),
          ],
        ),
      );
    }
    return const SizedBox.shrink();
  }
}

class _CompletionSection extends StatelessWidget {
  const _CompletionSection({
    required this.session,
    required this.completeInFlight,
    required this.onComplete,
  });

  final ProjectHelpSession session;
  final bool completeInFlight;
  final VoidCallback onComplete;

  @override
  Widget build(BuildContext context) {
    final actions = session.authorAllowedActions;
    final palette = MaterialsUiPalette.of(context);
    return _DetailSection(
      title: ProjectHelpSessionsL10n.completionSectionTitle.resolve(context),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            ProjectHelpSessionsL10n.completionSectionBody.resolve(context),
            style: AppTextStyles.body(context).copyWith(
              color: palette.textSecondary,
            ),
          ),
          if (session.completionAvailableAt != null && !actions.canComplete) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              '${ProjectHelpSessionsL10n.completionAvailableAt.resolve(context)}: ${formatHelpSessionDateTime(context, session.completionAvailableAt!, session.learnerTimeZone)}',
              style: AppTextStyles.label(context),
            ),
          ],
          const SizedBox(height: AppSpacing.sm),
          Semantics(
            button: true,
            label: ProjectHelpSessionsL10n.markSessionCompleted.resolve(context),
            child: FilledButton(
              onPressed: actions.canComplete && !completeInFlight
                  ? onComplete
                  : null,
              child: completeInFlight
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Text(
                      ProjectHelpSessionsL10n.markSessionCompleted.resolve(
                        context,
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

class _AuthorActions extends StatelessWidget {
  const _AuthorActions({
    required this.session,
    required this.selectedOptionId,
    required this.startInFlight,
    required this.onAccept,
    required this.onProposeAlternative,
    required this.onDecline,
    required this.onStart,
    required this.onCancel,
    required this.onRetry,
  });

  final ProjectHelpSession session;
  final String? selectedOptionId;
  final bool startInFlight;
  final VoidCallback onAccept;
  final VoidCallback onProposeAlternative;
  final VoidCallback onDecline;
  final VoidCallback onStart;
  final VoidCallback onCancel;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final actions = session.authorAllowedActions;
    final isCompact = MediaQuery.sizeOf(context).width < 720;
    final children = <Widget>[];

    if (session.status == ProjectHelpSessionStatus.pending) {
      children.addAll([
        FilledButton(
          onPressed: actions.canAcceptOption && selectedOptionId != null
              ? onAccept
              : null,
          child: Text(
            ProjectHelpSessionsL10n.acceptSelectedTime.resolve(context),
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        OutlinedButton(
          onPressed: actions.canProposeAlternative ? onProposeAlternative : null,
          child: Text(ProjectHelpSessionsL10n.proposeAlternative.resolve(context)),
        ),
        const SizedBox(height: AppSpacing.sm),
        TextButton(
          onPressed: actions.canDecline ? onDecline : null,
          style: TextButton.styleFrom(
            foregroundColor: Theme.of(context).colorScheme.error,
          ),
          child: Text(ProjectHelpSessionsL10n.declineRequest.resolve(context)),
        ),
      ]);
    }

    if (session.status == ProjectHelpSessionStatus.schedulingFailed &&
        actions.canRetryZoom) {
      children.add(
        FilledButton(
          onPressed: onRetry,
          child: Text(ProjectHelpSessionsL10n.zoomRetryAction.resolve(context)),
        ),
      );
    }

    if (session.status == ProjectHelpSessionStatus.scheduled ||
        session.status == ProjectHelpSessionStatus.zoomPending) {
      children.add(
        Semantics(
          button: true,
          label: actions.canStart
              ? '${ProjectHelpSessionsL10n.startZoom.resolve(context)} (${Localizations.localeOf(context).languageCode == 'ar' ? 'يفتح تطبيقًا خارجيًا' : 'opens external app'})'
              : ProjectHelpSessionsL10n.startZoomSoon.resolve(context),
          child: FilledButton(
            onPressed: actions.canStart && !startInFlight ? onStart : null,
            child: startInFlight
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Text(ProjectHelpSessionsL10n.startZoom.resolve(context)),
          ),
        ),
      );
      if (!actions.canStart) {
        children.add(const SizedBox(height: AppSpacing.sm));
        children.add(
          Text(
            ProjectHelpSessionsL10n.startZoomSoon.resolve(context),
            style: AppTextStyles.label(context),
          ),
        );
      }
    }

    if (actions.canCancel) {
      children.add(const SizedBox(height: AppSpacing.sm));
      children.add(
        OutlinedButton(
          onPressed: onCancel,
          child: Text(ProjectHelpSessionsL10n.confirmCancel.resolve(context)),
        ),
      );
    }

    if (children.isEmpty) {
      return const SizedBox.shrink();
    }

    if (isCompact) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: children,
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: children,
    );
  }
}
