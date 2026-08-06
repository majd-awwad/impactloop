import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/navigation_extensions.dart';
import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../shared/widgets/app_dialog_footer.dart';
import '../../../../shared/widgets/app_dialog_shell.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../app/widgets/entry_nav_bar.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../auth/application/auth_controller.dart';
import '../../application/project_help_session_zoom_launcher.dart';
import '../../application/project_help_sessions_providers.dart';
import '../../data/models/project_help_session_models.dart';
import '../l10n/project_help_sessions_l10n.dart';
import '../widgets/help_session_request_flow.dart';
import '../widgets/help_session_status_utils.dart';

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

  Future<void> _refresh() async {
    ref.invalidate(learnerHelpSessionDetailProvider(widget.sessionId));
    await ref.read(learnerHelpSessionDetailProvider(widget.sessionId).future);
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
    try {
      await ref
          .read(projectHelpSessionActionControllerProvider.notifier)
          .acceptAlternative(session.id);
      invalidateLearnerHelpSessionProviders(ref, sessionId: session.id);
      invalidateBuildHelpSessionProviders(ref, session.build.id);
      await _refresh();
    } catch (error) {
      if (mounted) {
        await handleHelpSessionRequestError(context, error);
      }
    }
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
    try {
      await ref
          .read(projectHelpSessionActionControllerProvider.notifier)
          .rejectAlternative(session.id);
      invalidateLearnerHelpSessionProviders(ref, sessionId: session.id);
      invalidateBuildHelpSessionProviders(ref, session.build.id);
      await _refresh();
    } catch (error) {
      if (mounted) {
        await handleHelpSessionRequestError(context, error);
      }
    }
  }

  Future<void> _cancelSession(ProjectHelpSession session) async {
    final reasonController = TextEditingController();
    final requiresReason = session.status != ProjectHelpSessionStatus.pending;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AppDialogShell(
        title: Text(ProjectHelpSessionsL10n.cancelTitle.resolve(context)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (requiresReason)
              Text(
                ProjectHelpSessionsL10n.cancelConfirmedWarning.resolve(context),
              ),
            const SizedBox(height: AppSpacing.sm),
            TextField(
              controller: reasonController,
              maxLength: 300,
              decoration: InputDecoration(
                labelText: requiresReason
                    ? ProjectHelpSessionsL10n.cancelReasonRequired
                        .resolve(context)
                    : ProjectHelpSessionsL10n.cancelReasonLabel.resolve(context),
              ),
            ),
          ],
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
          .cancelSession(sessionId: session.id, reason: reason.isEmpty ? null : reason);
      invalidateLearnerHelpSessionProviders(ref, sessionId: session.id);
      invalidateBuildHelpSessionProviders(ref, session.build.id);
      await _refresh();
    } catch (error) {
      if (mounted) {
        await handleHelpSessionRequestError(context, error);
      }
    }
  }

  Future<void> _join(ProjectHelpSession session) async {
    if (_joinInFlight || !session.allowedActions.canJoin) {
      return;
    }
    setState(() => _joinInFlight = true);
    try {
      final result = await ref
          .read(projectHelpSessionActionControllerProvider.notifier)
          .joinZoom(session.id);
      if (result == null || !mounted) {
        return;
      }
      final launched = await launchProjectHelpSessionZoomUrl(result.joinUrl);
      if (!launched && mounted) {
        await handleHelpSessionRequestError(
          context,
          ApiException(
            message: ProjectHelpSessionsL10n.joinLaunchFailed.resolve(context),
            code: 'JOIN_LAUNCH_FAILED',
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
    try {
      final locale = Localizations.localeOf(context).languageCode;
      final handoff = await ref
          .read(projectHelpSessionActionControllerProvider.notifier)
          .ensureNotebookNotes(sessionId: session.id, localeCode: locale);
      if (handoff == null || !mounted) {
        return;
      }
      context.go(
        learnerBuildNotebookRoute(
          handoff.buildId,
          pageId: handoff.pageId,
        ),
      );
    } catch (error) {
      if (mounted) {
        await handleHelpSessionRequestError(context, error);
      }
    } finally {
      if (mounted) {
        setState(() => _notebookInFlight = false);
      }
    }
  }

  void _openNotebook(ProjectHelpSession session) {
    context.go(learnerBuildNotebookRoute(session.build.id));
  }

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final sessionAsync =
        ref.watch(learnerHelpSessionDetailProvider(widget.sessionId));
    final userId = ref.watch(authControllerProvider).user?.id;

    return Scaffold(
      backgroundColor: palette.pageBackground,
      body: SafeArea(
        child: Column(
          children: [
            EntryNavBar(
              showSignIn: false,
              showCreateAccount: false,
              homeRoute: learnerHelpSessionsRoute,
              phoneTitle: ProjectHelpSessionsL10n.listTitle.resolve(context),
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
                data: (session) => Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 920),
                    child: SingleChildScrollView(
                      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
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
                                    .statusLabel(session.status)
                                    .resolve(context),
                                tone: helpSessionStatusTone(session.status),
                              ),
                            ],
                          ),
                          const SizedBox(height: AppSpacing.sm),
                          Text(
                            session.author.displayName,
                            style: AppTextStyles.body(context).copyWith(
                              color: palette.textSecondary,
                            ),
                          ),
                          const SizedBox(height: AppSpacing.lg),
                          _Section(
                            title: Localizations.localeOf(context).languageCode ==
                                    'ar'
                                ? 'المشكلة'
                                : 'Problem',
                            child: Text(session.problemDescription),
                          ),
                          const SizedBox(height: AppSpacing.md),
                          _TimesSection(session: session),
                          const SizedBox(height: AppSpacing.md),
                          _StatusSection(session: session),
                          const SizedBox(height: AppSpacing.lg),
                          _ActionsSection(
                            session: session,
                            joinInFlight: _joinInFlight,
                            notebookInFlight: _notebookInFlight,
                            onAcceptAlternative: () => _acceptAlternative(session),
                            onRejectAlternative: () => _rejectAlternative(session),
                            onCancel: () => _cancelSession(session),
                            onJoin: () => _join(session),
                            onAddNotebookNotes: () => _openNotebookNotes(session),
                            onOpenNotebook: () => _openNotebook(session),
                          ),
                          if (session.status == ProjectHelpSessionStatus.declined &&
                              session.declinedReason != null) ...[
                            const SizedBox(height: AppSpacing.md),
                            Text(session.declinedReason!),
                          ],
                          if (session.status == ProjectHelpSessionStatus.cancelled &&
                              userId != null) ...[
                            const SizedBox(height: AppSpacing.md),
                            Text(
                              '${cancellationActorLabel(session: session, currentUserId: userId, youLabel: ProjectHelpSessionsL10n.youCancelled.resolve(context), creatorLabel: ProjectHelpSessionsL10n.creatorCancelled.resolve(context))}: ${readableCancellationReason(session.cancellationReason)}',
                            ),
                          ],
                        ],
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

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.child});

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

class _TimesSection extends StatelessWidget {
  const _TimesSection({required this.session});

  final ProjectHelpSession session;

  @override
  Widget build(BuildContext context) {
    final isArabic = Localizations.localeOf(context).languageCode == 'ar';
    return _Section(
      title: isArabic ? 'المواعيد' : 'Times',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (session.status == ProjectHelpSessionStatus.pending)
            Text(ProjectHelpSessionsL10n.waitingForCreator.resolve(context)),
          for (final option in session.timeOptions)
            Padding(
              padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.xs),
              child: Text(
                formatHelpSessionDateTime(
                  context,
                  option.startsAt,
                  session.learnerTimeZone,
                ),
              ),
            ),
          if (session.selectedStartsAt != null) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              '${isArabic ? 'الموعد المؤكد' : 'Confirmed time'}: ${formatHelpSessionDateTime(context, session.selectedStartsAt!, session.learnerTimeZone)}',
              style: AppTextStyles.label(context),
            ),
          ],
        ],
      ),
    );
  }
}

class _StatusSection extends StatelessWidget {
  const _StatusSection({required this.session});

  final ProjectHelpSession session;

  @override
  Widget build(BuildContext context) {
    if (session.status == ProjectHelpSessionStatus.zoomPending) {
      return _Section(
        title: ProjectHelpSessionsL10n.zoomPreparing.resolve(context),
        child: Text(ProjectHelpSessionsL10n.zoomPreparingBody.resolve(context)),
      );
    }
    if (session.status == ProjectHelpSessionStatus.schedulingFailed) {
      return _Section(
        title: ProjectHelpSessionsL10n.zoomDelayed.resolve(context),
        child: Text(ProjectHelpSessionsL10n.zoomDelayedBody.resolve(context)),
      );
    }
    if (session.status == ProjectHelpSessionStatus.scheduled) {
      return _Section(
        title: ProjectHelpSessionsL10n.statusLabel(session.status).resolve(context),
        child: Text(
          session.allowedActions.canJoin
              ? ProjectHelpSessionsL10n.joinZoom.resolve(context)
              : ProjectHelpSessionsL10n.joinOpensLater.resolve(context),
        ),
      );
    }
    if (session.status == ProjectHelpSessionStatus.completed) {
      final isArabic = Localizations.localeOf(context).languageCode == 'ar';
      return _Section(
        title: ProjectHelpSessionsL10n.completedTitle.resolve(context),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(ProjectHelpSessionsL10n.completedLearnerBody.resolve(context)),
            if (session.completedAt != null) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(
                '${isArabic ? 'وقت الإكمال' : 'Completed'}: ${formatHelpSessionDateTime(context, session.completedAt!, session.learnerTimeZone)}',
                style: AppTextStyles.label(context),
              ),
            ],
            if (session.selectedStartsAt != null) ...[
              const SizedBox(height: AppSpacing.xs),
              Text(
                '${isArabic ? 'الموعد المجدول' : 'Scheduled time'}: ${formatHelpSessionDateTime(context, session.selectedStartsAt!, session.learnerTimeZone)}',
              ),
              Text(
                '${isArabic ? 'المدة' : 'Duration'}: ${session.durationMinutes} ${isArabic ? 'دقيقة' : 'minutes'}',
              ),
              Text(
                ProjectHelpSessionsL10n.timezoneDisplay(session.learnerTimeZone)
                    .resolve(context),
                style: AppTextStyles.label(context),
              ),
            ],
          ],
        ),
      );
    }
    return const SizedBox.shrink();
  }
}

class _ActionsSection extends StatelessWidget {
  const _ActionsSection({
    required this.session,
    required this.joinInFlight,
    required this.notebookInFlight,
    required this.onAcceptAlternative,
    required this.onRejectAlternative,
    required this.onCancel,
    required this.onJoin,
    required this.onAddNotebookNotes,
    required this.onOpenNotebook,
  });

  final ProjectHelpSession session;
  final bool joinInFlight;
  final bool notebookInFlight;
  final VoidCallback onAcceptAlternative;
  final VoidCallback onRejectAlternative;
  final VoidCallback onCancel;
  final VoidCallback onJoin;
  final VoidCallback onAddNotebookNotes;
  final VoidCallback onOpenNotebook;

  @override
  Widget build(BuildContext context) {
    final actions = session.allowedActions;
    if (session.status == ProjectHelpSessionStatus.completed) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          FilledButton(
            onPressed: notebookInFlight ? null : onAddNotebookNotes,
            child: notebookInFlight
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Text(
                    ProjectHelpSessionsL10n.addSessionNotesToNotebook.resolve(
                      context,
                    ),
                  ),
          ),
          const SizedBox(height: AppSpacing.sm),
          OutlinedButton(
            onPressed: onOpenNotebook,
            child: Text(
              ProjectHelpSessionsL10n.openProjectNotebook.resolve(context),
            ),
          ),
        ],
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (actions.canJoin)
          FilledButton(
            onPressed: joinInFlight ? null : onJoin,
            child: joinInFlight
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Text(ProjectHelpSessionsL10n.joinZoom.resolve(context)),
          ),
        if (actions.canAcceptAlternative) ...[
          FilledButton(
            onPressed: onAcceptAlternative,
            child: Text(ProjectHelpSessionsL10n.confirmTime.resolve(context)),
          ),
          const SizedBox(height: AppSpacing.sm),
          OutlinedButton(
            onPressed: onRejectAlternative,
            child: Text(ProjectHelpSessionsL10n.rejectTime.resolve(context)),
          ),
        ],
        if (actions.canCancel) ...[
          const SizedBox(height: AppSpacing.sm),
          OutlinedButton(
            onPressed: onCancel,
            child: Text(ProjectHelpSessionsL10n.confirmCancel.resolve(context)),
          ),
        ],
      ],
    );
  }
}
