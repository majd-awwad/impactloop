import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/navigation_extensions.dart';
import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/widgets/entry_nav_bar.dart';
import '../../../../shared/widgets/app_dialog_footer.dart';
import '../../../../shared/widgets/app_dialog_shell.dart';
import '../../../../shared/widgets/app_feedback.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../ai/application/ai_assistant_shell_provider.dart';
import '../../../ai/application/ai_chat_controller.dart';
import '../../../ai/presentation/widgets/ai_assistant_shell.dart';
import '../../../../shared/models/localized_text.dart';
import '../../../home/application/learner_home_provider.dart';
import '../../../learner_material_requests/application/learner_material_requests_providers.dart';
import '../../../notifications/application/notifications_provider.dart';
import '../../application/learning_hub_providers.dart';
import '../../application/project_build_refresh.dart';
import '../../domain/models/learning_project.dart';
import '../../domain/models/project_build.dart';
import '../../../../core/errors/api_exception.dart';
import '../../domain/models/project_material_coverage.dart';
import '../theme/learning_ui_palette.dart';
import '../l10n/learning_hub_coverage_l10n.dart';
import '../l10n/learning_project_build_l10n.dart';
import '../l10n/project_build_page_l10n.dart';
import '../widgets/project_build_acquisition_state.dart';
import '../widgets/project_build_item_display.dart';
import '../../../learner_builds/application/learner_builds_providers.dart';
import '../../../learner_builds/presentation/l10n/learner_builds_l10n.dart';
import '../../../project_notebook/presentation/l10n/project_notebook_l10n.dart';
import '../widgets/project_build_material_linking.dart';
import '../widgets/project_build_completion_story_section.dart';
import '../../application/learning_session_providers.dart';
import '../widgets/start_knowledge_check_section.dart';
import '../widgets/step_learning_check_sheet.dart';
import '../widgets/final_learning_check_section.dart';
import '../l10n/final_learning_check_l10n.dart';

class LearningProjectBuildPage extends ConsumerStatefulWidget {
  const LearningProjectBuildPage({
    super.key,
    required this.projectId,
    this.recommendationImpressionId,
  });

  final String projectId;
  final String? recommendationImpressionId;

  @override
  ConsumerState<LearningProjectBuildPage> createState() =>
      _LearningProjectBuildPageState();
}

class _LearningProjectBuildPageState
    extends ConsumerState<LearningProjectBuildPage>
    with WidgetsBindingObserver {
  static const double _buildGuideLayoutBreakpoint = 840;
  static const double _buildGuidePanelMinWidth = 380;
  static const double _buildGuidePanelMaxWidth = 460;
  static const double _buildGuidePanelMaxWidthFraction = 0.42;

  static final Map<String, Future<void>> _guideOpenRequests =
      <String, Future<void>>{};

  bool _isStarting = false;
  bool _isLifecycleActionInFlight = false;
  bool _openingGuide = false;
  bool _redirectedNarrowGuide = false;
  String? _activeGuideConversationId;
  Future<void>? _guideRestoreRequest;
  final Set<String> _updatingItemIds = <String>{};
  final Set<String> _completingStepIds = <String>{};
  bool _routeSuspended = false;
  bool _buildCompletionCelebrationShown = false;
  final ScrollController _completedPageScrollController = ScrollController();
  void Function({bool collapseCheckReview, String? expandSection})?
      _resetCompletedPageSections;
  final GlobalKey _completedPageTopKey = GlobalKey();
  final GlobalKey _completionStorySectionKey = GlobalKey();
  final GlobalKey _learningReflectionSectionKey = GlobalKey();
  late final ProjectBuildRefreshCoordinator _refreshCoordinator =
      ProjectBuildRefreshCoordinator(onRefresh: () {
        ref.invalidate(projectBuildProvider(widget.projectId));
      });
  late final ProjectBuildRefreshController _buildRefreshController =
      ProjectBuildRefreshController(onRefresh: _refreshBuild);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    _completedPageScrollController.dispose();
    _buildRefreshController.dispose();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void deactivate() {
    _routeSuspended = true;
    super.deactivate();
  }

  @override
  void activate() {
    super.activate();
    if (_routeSuspended) {
      _routeSuspended = false;
      unawaited(_refreshBuild());
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    switch (state) {
      case AppLifecycleState.resumed:
        _buildRefreshController.setPaused(false);
        if (mounted) {
          unawaited(_refreshBuild());
        }
      case AppLifecycleState.inactive:
      case AppLifecycleState.paused:
      case AppLifecycleState.hidden:
        _buildRefreshController.setPaused(true);
      case AppLifecycleState.detached:
        break;
    }
  }

  void _syncBuildRefreshPolling(ProjectBuild? build) {
    _buildRefreshController.syncPolling(build);
  }

  void _handleNotificationUnreadChange(int? previous, int? next) {
    if (next == null || previous == null || next <= previous) {
      return;
    }

    _refreshBuild();
    invalidateLearnerMaterialRequests(ref);
    ref.invalidate(learnerHomeFeedProvider);
    ref.invalidate(learnerHomeSectionDetailsProvider);
  }

  Future<void> _refreshBuild() {
    return _refreshCoordinator.requestRefreshAsync(() async {
      ref.invalidate(projectBuildProvider(widget.projectId));
      try {
        await ref.read(projectBuildProvider(widget.projectId).future);
      } catch (_) {
        // Provider surfaces fetch errors in the UI.
      }
    });
  }

  @override
  void didUpdateWidget(covariant LearningProjectBuildPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.projectId != widget.projectId ||
        oldWidget.recommendationImpressionId !=
            widget.recommendationImpressionId) {
      _refreshBuild();
      _isStarting = false;
      _updatingItemIds.clear();
      _completingStepIds.clear();
      _activeGuideConversationId = null;
      _guideRestoreRequest = null;
      _redirectedNarrowGuide = false;
      _refreshBuild();
    }
  }

  Future<void> _startBuild() async {
    setState(() => _isStarting = true);
    try {
      await ref.read(learningHubRepositoryProvider).startBuild(
        widget.projectId,
        recommendationImpressionId: widget.recommendationImpressionId,
      );
      _refreshBuild();
    } catch (error) {
      if (mounted) {
        showErrorSnackBar(context, error);
      }
    } finally {
      if (mounted) {
        setState(() => _isStarting = false);
      }
    }
  }

  Future<void> _updateItem(
    ProjectBuildItem item, {
    required ProjectBuildItemStatus status,
    String? learnerNote,
    bool updateLearnerNote = false,
  }) async {
    setState(() => _updatingItemIds.add(item.id));
    try {
      await ref
          .read(learningHubRepositoryProvider)
          .updateBuildItem(
            widget.projectId,
            item.id,
            status: status,
            learnerNote: updateLearnerNote ? learnerNote : item.learnerNote,
            recommendationImpressionId: widget.recommendationImpressionId,
          );
      _refreshBuild();
    } catch (error) {
      if (mounted) {
        showErrorSnackBar(context, error);
      }
    } finally {
      if (mounted) {
        setState(() => _updatingItemIds.remove(item.id));
      }
    }
  }

  Future<void> _editNote(ProjectBuildItem item) async {
    final controller = TextEditingController(text: item.learnerNote ?? '');
    final note = await showDialog<String?>(
      context: context,
      builder: (context) => AppDialogShell(
        title: const Text('Checklist note'),
        onClose: () => Navigator.of(context).pop(),
        content: TextField(
          controller: controller,
          maxLines: 4,
          maxLength: 1000,
          decoration: const InputDecoration(
            labelText: 'Optional note',
            hintText: 'Example: ask supplier for this size',
          ),
        ),
        footer: AppDialogFooter.form(
          primaryAction: FilledButton(
            onPressed: () {
              Navigator.of(context).pop(controller.text.trim());
            },
            child: const Text('Save note'),
          ),
        ),
      ),
    );
    controller.dispose();

    if (!mounted) {
      return;
    }

    if (note == null) {
      return;
    }

    final normalizedNote = note.trim().isEmpty ? null : note.trim();
    if (normalizedNote == item.learnerNote) {
      return;
    }

    await _updateItem(
      item,
      status: item.status,
      learnerNote: normalizedNote,
      updateLearnerNote: true,
    );
  }

  void _findMaterials(ProjectBuildItem item) {
    final query = item.component.name.resolve(context).trim();
    context.go(
      Uri(
        path: '/materials',
        queryParameters: query.isEmpty ? null : {'q': query},
      ).toString(),
    );
  }

  void _requestMaterial(ProjectBuildItem item, ProjectBuild build) {
    final query = item.component.name.resolve(context).trim();
    final params = <String, String>{
      if (query.isNotEmpty) 'q': query,
      if (item.component.categoryId != null &&
          item.component.categoryId!.trim().isNotEmpty)
        'categoryId': item.component.categoryId!.trim(),
      'projectId': build.projectId,
      'buildId': build.id,
      'buildItemId': item.id,
    };
    context.push(
      Uri(
        path: '/learner/material-requests/new',
        queryParameters: params,
      ).toString(),
    ).then((_) {
      if (mounted) {
        _refreshBuild();
      }
    });
  }

  Future<void> _showMaterialCandidates(ProjectBuildItem item) async {
    final repository = ref.read(learningHubRepositoryProvider);
    final build = await ProjectBuildMaterialCandidatesSheet.show(
      context,
      projectId: widget.projectId,
      item: item,
      onLoadCandidates: () =>
          repository.fetchMaterialCandidates(widget.projectId, item.id),
      onLinkMaterial: (materialId) => repository.linkMaterial(
        widget.projectId,
        item.id,
        materialId: materialId,
      ),
    );

    if (!mounted || build == null) {
      return;
    }

    _refreshBuild();
  }

  Future<void> _unlinkMaterial(ProjectBuildItem item) async {
    if (ProjectBuildAcquisitionState.canRemoveAcquiredAllocation(item)) {
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: Text(
            LearningProjectBuildL10n.removeAcquiredAllocationTitle.resolve(
              dialogContext,
            ),
          ),
          content: Text(
            LearningProjectBuildL10n.removeAcquiredAllocationBody.resolve(
              dialogContext,
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: Text(
                LearningProjectBuildL10n.cancel.resolve(dialogContext),
              ),
            ),
            FilledButton(
              onPressed: () => Navigator.of(dialogContext).pop(true),
              child: Text(
                LearningProjectBuildL10n.removeFromComponent.resolve(
                  dialogContext,
                ),
              ),
            ),
          ],
        ),
      );

      if (confirmed != true || !mounted) {
        return;
      }
    }

    setState(() => _updatingItemIds.add(item.id));
    try {
      if (ProjectBuildAcquisitionState.canRemoveAcquiredAllocation(item)) {
        final materialId = item.linkedMaterial?.id;
        final reservationId = item.linkedReservation?.id;
        if (materialId == null || reservationId == null) {
          throw StateError('Missing linked material or reservation');
        }

        await ref
            .read(learningHubRepositoryProvider)
            .removeAcquiredMaterialFromBuildItem(
              widget.projectId,
              item.id,
              materialId: materialId,
              reservationId: reservationId,
            );
      } else {
        await ref
            .read(learningHubRepositoryProvider)
            .unlinkMaterial(widget.projectId, item.id);
      }

      await _refreshBuild();
      invalidateLearnerMaterialRequests(ref);
      ref.invalidate(learnerHomeFeedProvider);
      ref.invalidate(learnerHomeSectionDetailsProvider);
    } catch (error) {
      if (mounted) {
        showErrorSnackBar(context, error);
      }
    } finally {
      if (mounted) {
        setState(() => _updatingItemIds.remove(item.id));
      }
    }
  }

  void _viewLinkedMaterial(ProjectBuildItem item) {
    final materialId = item.linkedMaterial?.id;
    if (materialId == null) {
      return;
    }

    context.go(
      buildChecklistMaterialDetailUri(
        materialId: materialId,
        projectId: widget.projectId,
        buildItemId: item.id,
        componentName: item.component.name.en,
      ),
    );
  }

  void _reserveLinkedMaterial(ProjectBuildItem item) {
    final materialId = item.linkedMaterial?.id;
    if (materialId == null) {
      return;
    }

    context.go(
      buildChecklistMaterialDetailUri(
        materialId: materialId,
        projectId: widget.projectId,
        buildItemId: item.id,
        componentName: item.component.name.en,
      ),
    );
  }

  Future<void> _completeCurrentStep(ProjectBuild build) async {
    final currentStep = build.stepProgress.currentStep;
    if (currentStep == null) {
      return;
    }

    final stepId = currentStep.stepId;
    final incompleteCount = build.stepProgress.steps
        .where((step) => step.state != ProjectBuildStepState.completed)
        .length;
    final isLastStep = incompleteCount == 1;

    if (isLastStep && mounted) {
      final shouldContinue = await _confirmLastStepWithFinalCheck(build);
      if (!shouldContinue) {
        return;
      }
    }

    setState(() => _completingStepIds.add(stepId));
    try {
      final updated = await ref
          .read(learningHubRepositoryProvider)
          .completeBuildStep(widget.projectId, stepId);
      ref.invalidate(projectBuildProvider(widget.projectId));
      ref.invalidate(buildLearningSessionProvider(widget.projectId));

      ProjectBuildStepView? completedStep;
      for (final step in updated.stepProgress.steps) {
        if (step.stepId == stepId) {
          completedStep = step;
          break;
        }
      }
      if (mounted &&
          completedStep != null &&
          completedStep.state == ProjectBuildStepState.completed) {
        await _offerStepCheckpoint(updated, completedStep);
      }

      if (mounted &&
          updated.status == ProjectBuildStatus.completed &&
          isLastStep) {
        await _onBuildCompletedSuccessfully(updated);
      }
    } catch (error) {
      if (mounted) {
        showErrorSnackBar(context, error);
      }
    } finally {
      if (mounted) {
        setState(() => _completingStepIds.remove(stepId));
      }
    }
  }

  Future<bool> _confirmLastStepWithFinalCheck(ProjectBuild build) async {
    final setup = build.learningSetup;
    if (setup?.isPreparing == true || setup?.isUnavailable == true) {
      return true;
    }

    try {
      final bundle = await ref.read(
        buildLearningSessionProvider(widget.projectId).future,
      );
      final remaining = bundle.session?.hasRemainingFinalQuestions ?? false;
      if (!remaining || !mounted) {
        return true;
      }

      final choice = await showDialog<String>(
        context: context,
        builder: (dialogContext) {
          return AlertDialog(
            title: Text(
              FinalLearningCheckL10n.completeDialogTitle.resolve(dialogContext),
            ),
            content: Text(
              FinalLearningCheckL10n.completeDialogBody.resolve(dialogContext),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(dialogContext).pop('review'),
                child: Text(
                  FinalLearningCheckL10n.reviewFinalCheck.resolve(dialogContext),
                ),
              ),
              FilledButton(
                onPressed: () => Navigator.of(dialogContext).pop('complete'),
                child: Text(
                  FinalLearningCheckL10n.completeAnyway.resolve(dialogContext),
                ),
              ),
            ],
          );
        },
      );

      if (choice == 'review') {
        // Complete the last step first so Final Check becomes available, then open it.
        setState(() => _completingStepIds.add(build.stepProgress.currentStep!.stepId));
        try {
          final updated = await ref
              .read(learningHubRepositoryProvider)
              .completeBuildStep(
                widget.projectId,
                build.stepProgress.currentStep!.stepId,
              );
          ref.invalidate(projectBuildProvider(widget.projectId));
          ref.invalidate(buildLearningSessionProvider(widget.projectId));
          if (mounted) {
            final closeAction = await showFinalLearningCheckSheet(
              context: context,
              ref: ref,
              projectId: widget.projectId,
              buildRecord: updated,
              onOpenAi: () => _openBuildGuide(updated),
            );
            if (closeAction != null) {
              _handleFinalCheckCelebrationClose(closeAction);
            }
          }
        } catch (error) {
          if (mounted) {
            showErrorSnackBar(context, error);
          }
        } finally {
          if (mounted) {
            setState(
              () => _completingStepIds.remove(
                build.stepProgress.currentStep!.stepId,
              ),
            );
          }
        }
        return false;
      }

      return choice == 'complete';
    } catch (_) {
      return true;
    }
  }

  Future<void> _openFinalCheck(ProjectBuild build) async {
    final closeAction = await showFinalLearningCheckSheet(
      context: context,
      ref: ref,
      projectId: widget.projectId,
      buildRecord: build,
      onOpenAi: () => _openBuildGuide(build),
    );
    ref.invalidate(buildLearningSessionProvider(widget.projectId));
    ref.invalidate(projectBuildProvider(widget.projectId));
    ref.invalidate(learnerPortfolioProvider);
    if (!mounted || closeAction == null) {
      return;
    }
    _handleFinalCheckCelebrationClose(closeAction);
  }

  Future<void> _offerStepCheckpoint(
    ProjectBuild build,
    ProjectBuildStepView step,
  ) async {
    final setup = build.learningSetup;
    if (setup?.isUnavailable == true) {
      return;
    }

    if (setup?.status == LearningSetupStatus.notRequested) {
      try {
        await ref
            .read(learningHubRepositoryProvider)
            .setupLearningSession(widget.projectId);
        ref.invalidate(buildLearningSessionProvider(widget.projectId));
      } catch (_) {
        return;
      }
    }

    if (setup?.isPreparing == true) {
      return;
    }

    try {
      final check = await ref
          .read(learningHubRepositoryProvider)
          .fetchStepLearningCheck(widget.projectId, step.stepId);
      if (!mounted || check == null) {
        return;
      }

      await showStepLearningCheckSheet(
        context: context,
        ref: ref,
        projectId: widget.projectId,
        buildRecord: build,
        step: step,
        onOpenAi: () => _openBuildGuide(build),
      );
    } catch (_) {
      // Optional checkpoint failures must not affect step completion.
    }
  }

  Future<void> _openStepCheck(
    ProjectBuild build,
    ProjectBuildStepView step,
  ) async {
    await showStepLearningCheckSheet(
      context: context,
      ref: ref,
      projectId: widget.projectId,
      buildRecord: build,
      step: step,
      onOpenAi: () => _openBuildGuide(build),
    );
    ref.invalidate(buildLearningSessionProvider(widget.projectId));
  }

  Future<void> _runLifecycleAction(
    Future<ProjectBuild> Function() action, {
    required ProjectBuildLifecycleErrorAction errorAction,
  }) async {
    if (_isLifecycleActionInFlight) {
      return;
    }

    setState(() => _isLifecycleActionInFlight = true);
    try {
      await action();
      invalidateLearnerBuildsAndHome(ref);
      ref.invalidate(projectBuildProvider(widget.projectId));
      ref.invalidate(learningProjectProvider(widget.projectId));
      await ref.read(projectBuildProvider(widget.projectId).future);
    } catch (error) {
      if (mounted) {
        final languageCode = Localizations.localeOf(context).languageCode;
        showErrorSnackBar(
          context,
          error,
          message: ProjectBuildPageL10n.lifecycleErrorMessage(
            error,
            errorAction,
            languageCode,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isLifecycleActionInFlight = false);
      }
    }
  }

  Future<bool> _confirmLifecycleAction({
    required LocalizedText title,
    required LocalizedText body,
  }) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(title.resolve(dialogContext)),
        content: Text(body.resolve(dialogContext)),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: Text(ProjectBuildPageL10n.cancel.resolve(dialogContext)),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: Text(ProjectBuildPageL10n.confirm.resolve(dialogContext)),
          ),
        ],
      ),
    );

    return confirmed == true;
  }

  Future<void> _pauseBuild(ProjectBuild build) async {
    final confirmed = await _confirmLifecycleAction(
      title: ProjectBuildPageL10n.pauseConfirmTitle,
      body: ProjectBuildPageL10n.pauseConfirmBody,
    );
    if (!confirmed || !mounted) {
      return;
    }

    return _runLifecycleAction(
      () => pauseLearnerBuild(ref, build.id),
      errorAction: ProjectBuildLifecycleErrorAction.pause,
    );
  }

  Future<void> _resumeBuild(ProjectBuild build) {
    return _runLifecycleAction(
      () => resumeLearnerBuild(ref, build.id),
      errorAction: ProjectBuildLifecycleErrorAction.resume,
    );
  }

  Future<void> _archiveBuild(ProjectBuild build) async {
    final confirmed = await _confirmLifecycleAction(
      title: ProjectBuildPageL10n.archiveConfirmTitle,
      body: ProjectBuildPageL10n.archiveConfirmBody,
    );
    if (!confirmed || !mounted) {
      return;
    }

    return _runLifecycleAction(
      () => archiveLearnerBuild(ref, build.id),
      errorAction: ProjectBuildLifecycleErrorAction.archive,
    );
  }

  Future<void> _buildAgain(ProjectBuild build) {
    return _runLifecycleAction(
      () => buildProjectAgain(ref, build.projectId),
      errorAction: ProjectBuildLifecycleErrorAction.buildAgain,
    );
  }

  void _scrollToLearningReflection() {
    final context = _learningReflectionSectionKey.currentContext;
    if (context == null) {
      return;
    }

    Scrollable.ensureVisible(
      context,
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeInOut,
    );
  }

  void _returnCompletedPageToTop({bool collapseCheckReview = true}) {
    _resetCompletedPageSections?.call(
      collapseCheckReview: collapseCheckReview,
      expandSection: null,
    );
    final topContext = _completedPageTopKey.currentContext;
    if (topContext != null) {
      Scrollable.ensureVisible(
        topContext,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
      return;
    }
    if (_completedPageScrollController.hasClients) {
      _completedPageScrollController.animateTo(
        0,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
    }
  }

  void _handleFinalCheckCelebrationClose(
    FinalCheckCelebrationCloseAction action,
  ) {
    switch (action) {
      case FinalCheckCelebrationCloseAction.viewLearningSummary:
        _returnCompletedPageToTop();
      case FinalCheckCelebrationCloseAction.addLearningReflection:
        _resetCompletedPageSections?.call(
          collapseCheckReview: true,
          expandSection: 'journey',
        );
        _scrollToLearningReflection();
      case FinalCheckCelebrationCloseAction.close:
        _returnCompletedPageToTop();
    }
  }

  void _handleProjectCompletionClose(_ProjectCompletionCloseAction? action) {
    switch (action) {
      case _ProjectCompletionCloseAction.addPhoto:
        _scrollToCompletionStory();
      case _ProjectCompletionCloseAction.portfolio:
        context.push(learnerPortfolioRoute);
      case _ProjectCompletionCloseAction.review:
      case null:
        _returnCompletedPageToTop();
    }
  }

  void _registerCompletedPageReset(
    void Function({bool collapseCheckReview, String? expandSection}) reset,
  ) {
    _resetCompletedPageSections = reset;
  }

  void _scrollToCompletionStory() {
    final context = _completionStorySectionKey.currentContext;
    if (context == null) {
      return;
    }

    Scrollable.ensureVisible(
      context,
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeInOut,
    );
  }

  Future<void> _onBuildCompletedSuccessfully(ProjectBuild build) async {
    if (_buildCompletionCelebrationShown || !mounted) {
      return;
    }
    _buildCompletionCelebrationShown = true;
    ref.invalidate(projectBuildProvider(widget.projectId));
    ref.invalidate(buildLearningSessionProvider(widget.projectId));
    invalidateLearnerBuildsLists(ref);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        unawaited(_showBuildCompletionCelebration(build));
      }
    });
  }

  Future<void> _showBuildCompletionCelebration(ProjectBuild build) async {
    if (!mounted) {
      return;
    }

    final isMobile = MediaQuery.sizeOf(context).width < 600;

    final title = FinalLearningCheckL10n.buildCompletedTitle.resolve(context);
    final message = FinalLearningCheckL10n.buildCompletedBody.resolve(context);
    final supporting =
        FinalLearningCheckL10n.buildCompletedSupporting.resolve(context);
    final reviewLabel =
        FinalLearningCheckL10n.reviewCompletedProject.resolve(context);
    final photoLabel = FinalLearningCheckL10n.addResultPhoto.resolve(context);
    final portfolioLabel =
        FinalLearningCheckL10n.viewPrivatePortfolio.resolve(context);

    _ProjectCompletionCloseAction? closeAction;

    if (isMobile) {
      closeAction = await showModalBottomSheet<_ProjectCompletionCloseAction>(
        context: context,
        isScrollControlled: true,
        showDragHandle: true,
        builder: (sheetContext) {
          return TweenAnimationBuilder<double>(
            tween: Tween(begin: 0.94, end: 1),
            duration: const Duration(milliseconds: 240),
            curve: Curves.easeOutCubic,
            builder: (context, scale, child) =>
                Transform.scale(scale: scale, child: child),
            child: SafeArea(
              child: Padding(
                padding: const EdgeInsetsDirectional.fromSTEB(24, 0, 24, 24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Semantics(
                      header: true,
                      child: Text(
                        title,
                        style: Theme.of(sheetContext).textTheme.titleLarge,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Text(message),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      supporting,
                      style: Theme.of(sheetContext)
                          .textTheme
                          .bodyMedium
                          ?.copyWith(
                            color: Theme.of(sheetContext)
                                .colorScheme
                                .onSurfaceVariant,
                          ),
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    SizedBox(
                      width: double.infinity,
                      height: 52,
                      child: FilledButton(
                        onPressed: () => Navigator.of(sheetContext).pop(
                          _ProjectCompletionCloseAction.review,
                        ),
                        child: Text(reviewLabel),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    SizedBox(
                      width: double.infinity,
                      height: 52,
                      child: OutlinedButton(
                        onPressed: () => Navigator.of(sheetContext).pop(
                          _ProjectCompletionCloseAction.addPhoto,
                        ),
                        child: Text(photoLabel),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    SizedBox(
                      width: double.infinity,
                      height: 52,
                      child: TextButton(
                        onPressed: () => Navigator.of(sheetContext).pop(
                          _ProjectCompletionCloseAction.portfolio,
                        ),
                        child: Text(portfolioLabel),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      );
    } else {
      closeAction = await showDialog<_ProjectCompletionCloseAction>(
        context: context,
        barrierDismissible: true,
        builder: (dialogContext) {
          return TweenAnimationBuilder<double>(
            tween: Tween(begin: 0.94, end: 1),
            duration: const Duration(milliseconds: 240),
            curve: Curves.easeOutCubic,
            builder: (context, scale, child) =>
                Transform.scale(scale: scale, child: child),
            child: AlertDialog(
              title: Semantics(header: true, child: Text(title)),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(message),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    supporting,
                    style:
                        Theme.of(dialogContext).textTheme.bodyMedium?.copyWith(
                      color: Theme.of(dialogContext)
                          .colorScheme
                          .onSurfaceVariant,
                    ),
                  ),
                ],
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(dialogContext).pop(
                    _ProjectCompletionCloseAction.portfolio,
                  ),
                  child: Text(portfolioLabel),
                ),
                OutlinedButton(
                  onPressed: () => Navigator.of(dialogContext).pop(
                    _ProjectCompletionCloseAction.addPhoto,
                  ),
                  child: Text(photoLabel),
                ),
                FilledButton(
                  onPressed: () => Navigator.of(dialogContext).pop(
                    _ProjectCompletionCloseAction.review,
                  ),
                  child: Text(reviewLabel),
                ),
              ],
            ),
          );
        },
      );
    }

    if (mounted) {
      _handleProjectCompletionClose(closeAction);
    }
  }

  Future<void> _openBuildGuide(ProjectBuild build) {
    if (_isBuildGuidePanelOpen(context)) {
      return Future.value();
    }

    return _guideOpenRequests.putIfAbsent(widget.projectId, () {
      _openingGuide = true;
      if (mounted) {
        setState(() {});
      }

      final request = _openBuildGuideInternal(build);
      return request.whenComplete(() {
        _guideOpenRequests.remove(widget.projectId);
        if (mounted) {
          setState(() => _openingGuide = false);
        }
      });
    });
  }

  Future<void> _openBuildGuideInternal(ProjectBuild build) async {
    try {
      final result = await ref
          .read(learningHubRepositoryProvider)
          .getOrCreateBuildGuideConversation(widget.projectId);
      if (!mounted) {
        return;
      }

      final conversationId = result.conversationId.trim();
      if (conversationId.isEmpty) {
        showErrorSnackBar(
          context,
          const ApiException(
            message: 'Unable to open the build assistant.',
            code: 'BUILD_GUIDE_CONVERSATION_MISSING',
          ),
        );
        return;
      }

      _refreshBuild();

      if (_isWideBuildLayout(context)) {
        _activeGuideConversationId = conversationId;
        ref.read(aiAssistantShellProvider.notifier).open(
              conversationId: conversationId,
              buildGuideContext: result.buildContext,
            );
        _setGuideQueryParams(conversationId);
        return;
      }

      context.push(
        '/learning/${widget.projectId}/build/guide?conversationId=${Uri.encodeComponent(conversationId)}',
        extra: result.buildContext,
      ).then((_) {
        if (mounted) {
          _refreshBuild();
        }
      });
    } catch (error) {
      if (mounted) {
        showErrorSnackBar(context, error);
      }
    }
  }

  bool _isWideBuildLayout(BuildContext context) {
    return MediaQuery.sizeOf(context).width >= _buildGuideLayoutBreakpoint;
  }

  bool _isBuildGuidePanelOpen(BuildContext context) {
    if (!_isWideBuildLayout(context)) {
      return false;
    }

    return _guideQueryIsOpen(context);
  }

  bool _guideQueryIsOpen(BuildContext context) {
    final params = GoRouterState.of(context).uri.queryParameters;
    return params['guide'] == '1' &&
        (params['conversationId']?.trim().isNotEmpty ?? false);
  }

  void _setGuideQueryParams(String conversationId) {
    final uri = GoRouterState.of(context).uri;
    context.go(
      uri
          .replace(
            queryParameters: {
              ...uri.queryParameters,
              'guide': '1',
              'conversationId': conversationId,
            },
          )
          .toString(),
    );
  }

  void _closeGuidePanel({String? errorMessage}) {
    _activeGuideConversationId = null;
    final uri = GoRouterState.of(context).uri;
    final params = Map<String, String>.from(uri.queryParameters)
      ..remove('guide')
      ..remove('conversationId');
    final nextUri = uri.replace(queryParameters: params);
    if (nextUri.toString() != uri.toString()) {
      context.go(nextUri.toString());
    }

    if (errorMessage != null && mounted) {
      showErrorSnackBar(
        context,
        ApiException(message: errorMessage, code: 'BUILD_GUIDE_INVALID'),
      );
    }
  }

  double _guidePanelWidth(BuildContext context) {
    final totalWidth = MediaQuery.sizeOf(context).width;
    final maxByFraction = totalWidth * _buildGuidePanelMaxWidthFraction;
    return maxByFraction.clamp(_buildGuidePanelMinWidth, _buildGuidePanelMaxWidth);
  }

  void _maybeRedirectNarrowGuideRoute() {
    if (_redirectedNarrowGuide || _isWideBuildLayout(context)) {
      return;
    }

    if (!_guideQueryIsOpen(context)) {
      return;
    }

    final conversationId =
        GoRouterState.of(context).uri.queryParameters['conversationId']?.trim() ??
        '';
    if (conversationId.isEmpty) {
      return;
    }

    _redirectedNarrowGuide = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) {
        return;
      }

      context.replace(
        '/learning/${widget.projectId}/build/guide?conversationId=${Uri.encodeComponent(conversationId)}',
      );
    });
  }

  Future<void> _ensureGuideRestored(ProjectBuild build) async {
    if (!_isWideBuildLayout(context) || !_guideQueryIsOpen(context)) {
      return;
    }

    final conversationId =
        GoRouterState.of(context).uri.queryParameters['conversationId']!.trim();

    if (_activeGuideConversationId == conversationId &&
        ref.read(aiAssistantControllerProvider).conversationId ==
            conversationId) {
      return;
    }

    _guideRestoreRequest ??= _restoreGuideFromUrl(build, conversationId);
    await _guideRestoreRequest;
    _guideRestoreRequest = null;
  }

  Future<void> _restoreGuideFromUrl(
    ProjectBuild build,
    String conversationId,
  ) async {
    if (build.guideConversationId != null &&
        build.guideConversationId != conversationId) {
      _closeGuidePanel(
        errorMessage: 'Unable to open the build assistant.',
      );
      return;
    }

    try {
      final result = await ref
          .read(learningHubRepositoryProvider)
          .getOrCreateBuildGuideConversation(widget.projectId);
      if (!mounted) {
        return;
      }

      if (result.conversationId != conversationId) {
        _closeGuidePanel(
          errorMessage: 'Unable to open the build assistant.',
        );
        return;
      }

      _activeGuideConversationId = conversationId;
      ref.read(aiAssistantShellProvider.notifier).open(
            conversationId: conversationId,
            buildGuideContext: result.buildContext,
          );
    } catch (error) {
      if (mounted) {
        _closeGuidePanel();
        showErrorSnackBar(context, error);
      }
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _maybeRedirectNarrowGuideRoute();
  }

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);

    ref.listen(projectBuildProvider(widget.projectId), (previous, next) {
      next.whenData((build) {
        if (mounted) {
          _syncBuildRefreshPolling(build);
        }
      });
    });

    ref.listen(myNotificationUnreadCountProvider, (previous, next) {
      _handleNotificationUnreadChange(previous?.value, next.value);
    });
    ref.watch(myNotificationUnreadCountProvider);

    final buildAsync = ref.watch(projectBuildProvider(widget.projectId));
    buildAsync.whenData((build) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          _syncBuildRefreshPolling(build);
        }
      });
    });

    return Scaffold(
      backgroundColor: palette.pageBackground,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const EntryNavBar(homeRoute: '/home'),
            Expanded(
              child: buildAsync.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (error, stackTrace) => _BuildStatePanel(
                  icon: Icons.cloud_off_outlined,
                  title: 'Unable to load checklist',
                  subtitle:
                      'Check that the backend is running, then try again.',
                  actionLabel: 'Try again',
                  onAction: () =>
                      ref.invalidate(projectBuildProvider(widget.projectId)),
                ),
                data: (build) {
                  if (build == null) {
                    return _BuildStatePanel(
                      icon: Icons.playlist_add_check_rounded,
                      title: 'Start this build',
                      subtitle:
                          'Create a saved manual checklist from this project’s required components.',
                      actionLabel: _isStarting ? 'Starting...' : 'Start build',
                      onAction: _isStarting ? null : _startBuild,
                    );
                  }

                  return _buildWorkspace(
                    context: context,
                    build: build,
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildWorkspace({
    required BuildContext context,
    required ProjectBuild build,
  }) {
    final showGuidePanel = _isBuildGuidePanelOpen(context);

    if (showGuidePanel) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          _ensureGuideRestored(build);
        }
      });
    }

    final buildContent = _BuildContent(
      projectId: widget.projectId,
      buildRecord: build,
      completionStorySectionKey: _completionStorySectionKey,
      learningReflectionSectionKey: _learningReflectionSectionKey,
      updatingItemIds: _updatingItemIds,
      completingStepIds: _completingStepIds,
      openingGuide: _openingGuide,
      isLifecycleActionInFlight: _isLifecycleActionInFlight,
      onPauseBuild: () => _pauseBuild(build),
      onResumeBuild: () => _resumeBuild(build),
      onArchiveBuild: () => _archiveBuild(build),
      onBuildAgain: () => _buildAgain(build),
      onEditCompletionStory: _scrollToCompletionStory,
      onRefreshBuild: _refreshBuild,
      onStatusChanged: _updateItem,
      onEditNote: _editNote,
      onFindMaterials: _findMaterials,
      onRequestMaterial: (item) => _requestMaterial(item, build),
      onShowMaterialCandidates: _showMaterialCandidates,
      onUnlinkMaterial: _unlinkMaterial,
      onViewLinkedMaterial: _viewLinkedMaterial,
      onReserveLinkedMaterial: _reserveLinkedMaterial,
      onCompleteCurrentStep: () => _completeCurrentStep(build),
      onOpenBuildGuide: () => _openBuildGuide(build),
      onOpenStepCheck: (step) => _openStepCheck(build, step),
      onOpenFinalCheck: () => _openFinalCheck(build),
      completedPageScrollController: _completedPageScrollController,
      completedPageTopKey: _completedPageTopKey,
      onRegisterCompletedPageReset: _registerCompletedPageReset,
    );

    if (!showGuidePanel) {
      return buildContent;
    }

    return Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(child: buildContent),
        AiBuildGuideSidePanel(
          width: _guidePanelWidth(context),
          onClose: _closeGuidePanel,
        ),
      ],
    );
  }
}

class _BuildContent extends StatelessWidget {
  const _BuildContent({
    required this.projectId,
    required this.buildRecord,
    required this.completionStorySectionKey,
    required this.learningReflectionSectionKey,
    required this.updatingItemIds,
    required this.completingStepIds,
    required this.openingGuide,
    required this.isLifecycleActionInFlight,
    required this.onPauseBuild,
    required this.onResumeBuild,
    required this.onArchiveBuild,
    required this.onBuildAgain,
    required this.onEditCompletionStory,
    required this.onRefreshBuild,
    required this.onStatusChanged,
    required this.onEditNote,
    required this.onFindMaterials,
    required this.onRequestMaterial,
    required this.onShowMaterialCandidates,
    required this.onUnlinkMaterial,
    required this.onViewLinkedMaterial,
    required this.onReserveLinkedMaterial,
    required this.onCompleteCurrentStep,
    required this.onOpenBuildGuide,
    required this.onOpenStepCheck,
    required this.onOpenFinalCheck,
    required this.completedPageScrollController,
    required this.completedPageTopKey,
    required this.onRegisterCompletedPageReset,
  });

  final String projectId;
  final ProjectBuild buildRecord;
  final GlobalKey completionStorySectionKey;
  final GlobalKey learningReflectionSectionKey;
  final Set<String> updatingItemIds;
  final Set<String> completingStepIds;
  final bool openingGuide;
  final bool isLifecycleActionInFlight;
  final Future<void> Function() onPauseBuild;
  final Future<void> Function() onResumeBuild;
  final Future<void> Function() onArchiveBuild;
  final Future<void> Function() onBuildAgain;
  final VoidCallback onEditCompletionStory;
  final Future<void> Function() onRefreshBuild;
  final Future<void> Function(
    ProjectBuildItem item, {
    required ProjectBuildItemStatus status,
    String? learnerNote,
  })
  onStatusChanged;
  final ValueChanged<ProjectBuildItem> onEditNote;
  final ValueChanged<ProjectBuildItem> onFindMaterials;
  final ValueChanged<ProjectBuildItem> onRequestMaterial;
  final ValueChanged<ProjectBuildItem> onShowMaterialCandidates;
  final ValueChanged<ProjectBuildItem> onUnlinkMaterial;
  final ValueChanged<ProjectBuildItem> onViewLinkedMaterial;
  final ValueChanged<ProjectBuildItem> onReserveLinkedMaterial;
  final VoidCallback onCompleteCurrentStep;
  final VoidCallback onOpenBuildGuide;
  final Future<void> Function(ProjectBuildStepView step) onOpenStepCheck;
  final Future<void> Function() onOpenFinalCheck;
  final ScrollController completedPageScrollController;
  final GlobalKey completedPageTopKey;
  final void Function(
    void Function({bool collapseCheckReview, String? expandSection}) reset,
  ) onRegisterCompletedPageReset;

  @override
  Widget build(BuildContext context) {
    if (buildRecord.status == ProjectBuildStatus.completed ||
        buildRecord.status == ProjectBuildStatus.archived) {
      return _CompletedBuildReviewContent(
        projectId: projectId,
        buildRecord: buildRecord,
        completionStorySectionKey: completionStorySectionKey,
        learningReflectionSectionKey: learningReflectionSectionKey,
        completedPageScrollController: completedPageScrollController,
        completedPageTopKey: completedPageTopKey,
        onRegisterCompletedPageReset: onRegisterCompletedPageReset,
        isLifecycleActionInFlight: isLifecycleActionInFlight,
        onArchiveBuild: onArchiveBuild,
        onBuildAgain: onBuildAgain,
        onEditCompletionStory: onEditCompletionStory,
        onRefreshBuild: onRefreshBuild,
        onOpenFinalCheck: onOpenFinalCheck,
      );
    }

    final isEditingLocked = buildRecord.isEditingLocked;

    return SingleChildScrollView(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1120),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _BuildHeader(
                projectId: projectId,
                buildRecord: buildRecord,
                openingGuide: openingGuide,
                isLifecycleActionInFlight: isLifecycleActionInFlight,
                onOpenBuildGuide: onOpenBuildGuide,
                onPauseBuild: onPauseBuild,
                onResumeBuild: onResumeBuild,
                onArchiveBuild: onArchiveBuild,
                onBuildAgain: onBuildAgain,
                onEditCompletionStory: onEditCompletionStory,
              ),
              if (isEditingLocked) ...[
                const SizedBox(height: AppSpacing.md),
                _BuildLockedNotice(buildRecord: buildRecord),
              ],
              if (!isEditingLocked &&
                  buildRecord.status == ProjectBuildStatus.inProgress) ...[
                const SizedBox(height: AppSpacing.lg),
                StartKnowledgeCheckSection(
                  projectId: projectId,
                  buildRecord: buildRecord,
                ),
              ],
              const SizedBox(height: AppSpacing.lg),
              _MaterialsSection(
                buildRecord: buildRecord,
                updatingItemIds: updatingItemIds,
                isEditingLocked: isEditingLocked,
                onStatusChanged: onStatusChanged,
                onEditNote: onEditNote,
                onFindMaterials: onFindMaterials,
                onRequestMaterial: onRequestMaterial,
                onShowMaterialCandidates: onShowMaterialCandidates,
                onUnlinkMaterial: onUnlinkMaterial,
                onViewLinkedMaterial: onViewLinkedMaterial,
                onReserveLinkedMaterial: onReserveLinkedMaterial,
              ),
              const SizedBox(height: AppSpacing.lg),
              _BuildStepsSection(
                projectId: projectId,
                buildRecord: buildRecord,
                completingStepIds: completingStepIds,
                isEditingLocked: isEditingLocked,
                onCompleteCurrentStep: onCompleteCurrentStep,
                onOpenStepCheck: onOpenStepCheck,
              ),
              if (areRequiredBuildStepsComplete(buildRecord)) ...[
                const SizedBox(height: AppSpacing.lg),
                FinalLearningCheckSection(
                  projectId: projectId,
                  buildRecord: buildRecord,
                  onOpenCheck: () => onOpenFinalCheck(),
                ),
              ],
              Consumer(
                builder: (context, ref, _) {
                  final sessionAsync =
                      ref.watch(buildLearningSessionProvider(projectId));
                  return sessionAsync.maybeWhen(
                    data: (bundle) {
                      final summary = bundle.session?.learningSummary;
                      if (summary == null) {
                        return const SizedBox.shrink();
                      }
                      return Column(
                        children: [
                          const SizedBox(height: AppSpacing.lg),
                          LearningSummarySection(summary: summary),
                        ],
                      );
                    },
                    orElse: () => const SizedBox.shrink(),
                  );
                },
              ),
              if (buildRecord.status == ProjectBuildStatus.completed ||
                  buildRecord.status == ProjectBuildStatus.archived) ...[
                Consumer(
                  builder: (context, ref, _) {
                    final sessionAsync =
                        ref.watch(buildLearningSessionProvider(projectId));
                    return sessionAsync.maybeWhen(
                      data: (bundle) {
                        final session = bundle.session;
                        if (session == null) {
                          return const SizedBox.shrink();
                        }
                        return Column(
                          children: [
                            const SizedBox(height: AppSpacing.lg),
                            KeyedSubtree(
                              key: learningReflectionSectionKey,
                              child: LearningReflectionSection(
                                projectId: projectId,
                                buildRecord: buildRecord,
                                session: session,
                              ),
                            ),
                          ],
                        );
                      },
                      orElse: () => const SizedBox.shrink(),
                    );
                  },
                ),
              ],
              if (buildRecord.status == ProjectBuildStatus.completed ||
                  buildRecord.stepProgress.nextAction ==
                      ProjectBuildNextAction.buildCompleted) ...[
                const SizedBox(height: AppSpacing.lg),
                _BuildCompletionNotice(buildRecord: buildRecord),
                const SizedBox(height: AppSpacing.lg),
                KeyedSubtree(
                  key: completionStorySectionKey,
                  child: ProjectBuildCompletionStorySection(
                    build: buildRecord,
                    onUpdated: () => onRefreshBuild(),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _BuildHeader extends StatelessWidget {
  const _BuildHeader({
    required this.projectId,
    required this.buildRecord,
    required this.openingGuide,
    required this.isLifecycleActionInFlight,
    required this.onOpenBuildGuide,
    required this.onPauseBuild,
    required this.onResumeBuild,
    required this.onArchiveBuild,
    required this.onBuildAgain,
    required this.onEditCompletionStory,
  });

  final String projectId;
  final ProjectBuild buildRecord;
  final bool openingGuide;
  final bool isLifecycleActionInFlight;
  final VoidCallback onOpenBuildGuide;
  final Future<void> Function() onPauseBuild;
  final Future<void> Function() onResumeBuild;
  final Future<void> Function() onArchiveBuild;
  final Future<void> Function() onBuildAgain;
  final VoidCallback onEditCompletionStory;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final progress = buildRecord.progress.percent.clamp(0, 100) / 100;
    final coverageL10n = LearningHubCoverageL10n.of(context);
    final readinessLabel = coverageL10n.personalReadinessSummary(
      ProjectPersonalBuildReadiness(
        buildId: buildRecord.id,
        buildStatus: switch (buildRecord.status) {
          ProjectBuildStatus.inProgress => 'IN_PROGRESS',
          ProjectBuildStatus.paused => 'PAUSED',
          ProjectBuildStatus.completed => 'COMPLETED',
          ProjectBuildStatus.archived => 'ARCHIVED',
        },
        readyComponents: buildRecord.progress.ready,
        totalRequiredComponents: buildRecord.progress.total,
        needsMaterialComponents:
            buildRecord.progress.total - buildRecord.progress.ready,
        readinessRatio: buildRecord.progress.total == 0
            ? 0
            : buildRecord.progress.ready / buildRecord.progress.total,
      ),
    );
    final statusLabel = LearnerBuildsL10n.statusLabel(buildRecord.status);
    final statusTone = switch (buildRecord.status) {
      ProjectBuildStatus.inProgress => AppStatusTone.info,
      ProjectBuildStatus.paused => AppStatusTone.warning,
      ProjectBuildStatus.completed => AppStatusTone.success,
      ProjectBuildStatus.archived => AppStatusTone.neutral,
    };

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: palette.cardSurface,
        borderRadius: AppRadius.xlAll,
        border: Border.all(color: palette.borderSubtle),
        boxShadow: [
          BoxShadow(
            color: palette.cardShadow,
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.xs,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              TextButton.icon(
                onPressed: () => context.go('/learning/$projectId'),
                icon: const Icon(Icons.arrow_back_rounded, size: 18),
                label: Text(ProjectBuildPageL10n.backToProject.resolve(context)),
              ),
              TextButton(
                onPressed: () => context.go(learnerBuildsRoute),
                child: Text(ProjectBuildPageL10n.myBuilds.resolve(context)),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          LayoutBuilder(
            builder: (context, constraints) {
              final useCompactMenu = constraints.maxWidth < 520;
              final titleBlock = Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Wrap(
                    spacing: AppSpacing.sm,
                    runSpacing: AppSpacing.xs,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Text(
                        buildRecord.project.title,
                        style: AppTextStyles.display(
                          context,
                        ).copyWith(color: palette.textPrimary),
                      ),
                      AppStatusBadge(
                        label: statusLabel.resolve(context),
                        tone: statusTone,
                      ),
                    ],
                  ),
                  if (buildRecord.project.shortDescription.isNotEmpty) ...[
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      buildRecord.project.shortDescription,
                      style: AppTextStyles.body(
                        context,
                      ).copyWith(color: palette.textSecondary, height: 1.45),
                    ),
                  ],
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    ProjectBuildPageL10n.progressSavedAutomatically.resolve(
                      context,
                    ),
                    style: AppTextStyles.label(
                      context,
                    ).copyWith(color: palette.textSecondary),
                  ),
                ],
              );
              final guideAction = _BuildGuideCompactAction(
                openingGuide: openingGuide,
                hasExistingConversation: buildRecord.guideConversationId != null,
                onOpenBuildGuide: onOpenBuildGuide,
              );
              final notebookAction = OutlinedButton.icon(
                onPressed: () => context.push(
                  learnerBuildNotebookRoute(buildRecord.id),
                ),
                icon: const Icon(Icons.menu_book_outlined, size: 18),
                label: Text(
                  ProjectNotebookL10n.projectNotebook.resolve(context),
                ),
                style: OutlinedButton.styleFrom(
                  visualDensity: VisualDensity.compact,
                  padding: const EdgeInsetsDirectional.symmetric(
                    horizontal: AppSpacing.md,
                    vertical: AppSpacing.sm,
                  ),
                ),
              );
              final menuAction = _BuildLifecycleMenu(
                buildRecord: buildRecord,
                isBusy: isLifecycleActionInFlight,
                compact: useCompactMenu,
                onPause: onPauseBuild,
                onResume: onResumeBuild,
                onArchive: onArchiveBuild,
                onBuildAgain: onBuildAgain,
                onEditCompletionStory: onEditCompletionStory,
              );

              if (useCompactMenu) {
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(child: titleBlock),
                        menuAction,
                      ],
                    ),
                    if (buildRecord.status == ProjectBuildStatus.paused) ...[
                      const SizedBox(height: AppSpacing.sm),
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton.icon(
                          onPressed: isLifecycleActionInFlight
                              ? null
                              : onResumeBuild,
                          icon: const Icon(Icons.play_arrow_rounded),
                          label: Text(
                            ProjectBuildPageL10n.resumeBuild.resolve(context),
                          ),
                        ),
                      ),
                    ],
                    const SizedBox(height: AppSpacing.sm),
                    guideAction,
                    const SizedBox(height: AppSpacing.sm),
                    notebookAction,
                  ],
                );
              }

              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(child: titleBlock),
                      const SizedBox(width: AppSpacing.sm),
                      menuAction,
                      const SizedBox(width: AppSpacing.sm),
                      notebookAction,
                      const SizedBox(width: AppSpacing.sm),
                      guideAction,
                    ],
                  ),
                  if (buildRecord.status == ProjectBuildStatus.paused) ...[
                    const SizedBox(height: AppSpacing.sm),
                    Align(
                      alignment: AlignmentDirectional.centerStart,
                      child: FilledButton.icon(
                        onPressed: isLifecycleActionInFlight
                            ? null
                            : onResumeBuild,
                        icon: const Icon(Icons.play_arrow_rounded),
                        label: Text(
                          ProjectBuildPageL10n.resumeBuild.resolve(context),
                        ),
                      ),
                    ),
                  ],
                ],
              );
            },
          ),
          const SizedBox(height: AppSpacing.lg),
          ClipRRect(
            borderRadius: AppRadius.pillAll,
            child: LinearProgressIndicator(
              minHeight: 10,
              value: progress,
              backgroundColor: palette.mutedChip,
              valueColor: AlwaysStoppedAnimation<Color>(palette.lime),
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            readinessLabel,
            style: AppTextStyles.label(
              context,
            ).copyWith(color: palette.textSecondary),
          ),
        ],
      ),
    );
  }
}

class _BuildGuideCompactAction extends StatelessWidget {
  const _BuildGuideCompactAction({
    required this.openingGuide,
    required this.hasExistingConversation,
    required this.onOpenBuildGuide,
  });

  final bool openingGuide;
  final bool hasExistingConversation;
  final VoidCallback onOpenBuildGuide;

  @override
  Widget build(BuildContext context) {
    final label = hasExistingConversation ? 'Continue with AI' : 'Ask AI';

    return OutlinedButton.icon(
      onPressed: openingGuide ? null : onOpenBuildGuide,
      icon: openingGuide
          ? const SizedBox.square(
              dimension: 16,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          : const Icon(Icons.smart_toy_outlined, size: 18),
      label: Text(label),
      style: OutlinedButton.styleFrom(
        visualDensity: VisualDensity.compact,
        padding: const EdgeInsetsDirectional.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.sm,
        ),
      ),
    );
  }
}

class _MaterialsSection extends StatelessWidget {
  const _MaterialsSection({
    required this.buildRecord,
    required this.updatingItemIds,
    required this.isEditingLocked,
    required this.onStatusChanged,
    required this.onEditNote,
    required this.onFindMaterials,
    required this.onRequestMaterial,
    required this.onShowMaterialCandidates,
    required this.onUnlinkMaterial,
    required this.onViewLinkedMaterial,
    required this.onReserveLinkedMaterial,
  });

  final ProjectBuild buildRecord;
  final Set<String> updatingItemIds;
  final bool isEditingLocked;
  final Future<void> Function(
    ProjectBuildItem item, {
    required ProjectBuildItemStatus status,
    String? learnerNote,
  })
  onStatusChanged;
  final ValueChanged<ProjectBuildItem> onEditNote;
  final ValueChanged<ProjectBuildItem> onFindMaterials;
  final ValueChanged<ProjectBuildItem> onRequestMaterial;
  final ValueChanged<ProjectBuildItem> onShowMaterialCandidates;
  final ValueChanged<ProjectBuildItem> onUnlinkMaterial;
  final ValueChanged<ProjectBuildItem> onViewLinkedMaterial;
  final ValueChanged<ProjectBuildItem> onReserveLinkedMaterial;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final total = buildRecord.progress.total;
    final ready = buildRecord.progress.ready;
    final allReady = total > 0 && ready >= total;

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: palette.cardSurface,
        borderRadius: AppRadius.xlAll,
        border: Border.all(
          color: allReady
              ? palette.lime.withValues(alpha: 0.35)
              : palette.borderSubtle,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Materials',
            style: AppTextStyles.title(
              context,
            ).copyWith(color: palette.textPrimary),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            total == 0
                ? 'No required components listed yet.'
                : '$ready of $total ready',
            style: AppTextStyles.body(
              context,
            ).copyWith(
              color: allReady ? palette.lime : palette.textSecondary,
            ),
          ),
          if (allReady) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              'All required materials are ready. You can review them while working through the steps.',
              style: AppTextStyles.body(
                context,
              ).copyWith(color: palette.textSecondary, height: 1.4),
            ),
          ],
          const SizedBox(height: AppSpacing.lg),
          if (buildRecord.items.isEmpty)
            _EmptyChecklistCard(palette: palette, embedded: true)
          else
            ...List.generate(buildRecord.items.length, (index) {
              final item = buildRecord.items[index];
              return Padding(
                padding: EdgeInsetsDirectional.only(
                  bottom: index == buildRecord.items.length - 1
                      ? 0
                      : AppSpacing.md,
                ),
                child: _BuildItemCard(
                  index: index,
                  item: item,
                  isUpdating: updatingItemIds.contains(item.id),
                  isEditingLocked: isEditingLocked,
                  onStatusChanged: (status) =>
                      onStatusChanged(item, status: status),
                  onEditNote: () => onEditNote(item),
                  onFindMaterials: () => onFindMaterials(item),
                  onRequestMaterial: () => onRequestMaterial(item),
                  onShowMaterialCandidates: () =>
                      onShowMaterialCandidates(item),
                  onUnlinkMaterial: () => onUnlinkMaterial(item),
                  onViewLinkedMaterial: () => onViewLinkedMaterial(item),
                  onReserveLinkedMaterial: () =>
                      onReserveLinkedMaterial(item),
                ),
              );
            }),
        ],
      ),
    );
  }
}

class _BuildLifecycleMenu extends StatelessWidget {
  const _BuildLifecycleMenu({
    required this.buildRecord,
    required this.isBusy,
    required this.compact,
    required this.onPause,
    required this.onResume,
    required this.onArchive,
    required this.onBuildAgain,
    required this.onEditCompletionStory,
  });

  final ProjectBuild buildRecord;
  final bool isBusy;
  final bool compact;
  final Future<void> Function() onPause;
  final Future<void> Function() onResume;
  final Future<void> Function() onArchive;
  final Future<void> Function() onBuildAgain;
  final VoidCallback onEditCompletionStory;

  List<PopupMenuEntry<_BuildLifecycleAction>> _menuItems(BuildContext context) {
    final items = <PopupMenuEntry<_BuildLifecycleAction>>[];

    if (buildRecord.status == ProjectBuildStatus.inProgress) {
      items.add(
        PopupMenuItem(
          value: _BuildLifecycleAction.pause,
          child: Text(LearnerBuildsL10n.pauseBuild.resolve(context)),
        ),
      );
    }

    if (buildRecord.status == ProjectBuildStatus.paused) {
      items.add(
        PopupMenuItem(
          value: _BuildLifecycleAction.resume,
          child: Text(LearnerBuildsL10n.resumeBuild.resolve(context)),
        ),
      );
    }

    if (buildRecord.status == ProjectBuildStatus.inProgress ||
        buildRecord.status == ProjectBuildStatus.paused) {
      items.add(
        PopupMenuItem(
          value: _BuildLifecycleAction.archive,
          child: Text(LearnerBuildsL10n.archiveBuild.resolve(context)),
        ),
      );
    }

    if (buildRecord.status == ProjectBuildStatus.completed) {
      items.add(
        PopupMenuItem(
          value: _BuildLifecycleAction.editCompletionStory,
          child: Text(
            ProjectBuildPageL10n.editCompletionStory.resolve(context),
          ),
        ),
      );
    }

    if (buildRecord.status == ProjectBuildStatus.completed ||
        buildRecord.status == ProjectBuildStatus.archived) {
      items.add(
        PopupMenuItem(
          value: _BuildLifecycleAction.buildAgain,
          child: Text(LearnerBuildsL10n.buildAgain.resolve(context)),
        ),
      );
    }

    return items;
  }

  void _handleAction(_BuildLifecycleAction action) {
    switch (action) {
      case _BuildLifecycleAction.pause:
        onPause();
      case _BuildLifecycleAction.resume:
        onResume();
      case _BuildLifecycleAction.archive:
        onArchive();
      case _BuildLifecycleAction.buildAgain:
        onBuildAgain();
      case _BuildLifecycleAction.editCompletionStory:
        onEditCompletionStory();
    }
  }

  @override
  Widget build(BuildContext context) {
    final menuLabel = ProjectBuildPageL10n.buildActions.resolve(context);
    final items = _menuItems(context);

    if (items.isEmpty) {
      return const SizedBox.shrink();
    }

    if (isBusy) {
      return const SizedBox.square(
        dimension: 40,
        child: Padding(
          padding: EdgeInsets.all(10),
          child: CircularProgressIndicator(strokeWidth: 2),
        ),
      );
    }

    if (compact) {
      return Semantics(
        button: true,
        label: menuLabel,
        child: PopupMenuButton<_BuildLifecycleAction>(
          tooltip: menuLabel,
          icon: const Icon(Icons.more_vert_rounded),
          onSelected: _handleAction,
          itemBuilder: (context) => items,
        ),
      );
    }

    return PopupMenuButton<_BuildLifecycleAction>(
      tooltip: menuLabel,
      onSelected: _handleAction,
      itemBuilder: (context) => items,
      child: Semantics(
        button: true,
        label: menuLabel,
        child: IgnorePointer(
          child: OutlinedButton(
            onPressed: () {},
            style: OutlinedButton.styleFrom(
              visualDensity: VisualDensity.compact,
              padding: const EdgeInsetsDirectional.symmetric(
                horizontal: AppSpacing.md,
                vertical: AppSpacing.sm,
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.more_vert_rounded, size: 18),
                const SizedBox(width: AppSpacing.xs),
                Text(menuLabel),
                const Icon(Icons.arrow_drop_down_rounded, size: 20),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

enum _BuildLifecycleAction {
  pause,
  resume,
  archive,
  buildAgain,
  editCompletionStory,
}

class _BuildLockedNotice extends StatelessWidget {
  const _BuildLockedNotice({required this.buildRecord});

  final ProjectBuild buildRecord;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final message = buildRecord.status == ProjectBuildStatus.paused
        ? LearnerBuildsL10n.pausedNotice.resolve(context)
        : LearnerBuildsL10n.readOnlyNotice.resolve(context);

    return Container(
      width: double.infinity,
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: palette.cardSurfaceAlt,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Row(
        children: [
          Icon(Icons.info_outline_rounded, color: palette.textSecondary),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              message,
              style: AppTextStyles.body(
                context,
              ).copyWith(color: palette.textSecondary, height: 1.35),
            ),
          ),
        ],
      ),
    );
  }
}

class _BuildCompletionNotice extends StatelessWidget {
  const _BuildCompletionNotice({required this.buildRecord});

  final ProjectBuild buildRecord;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final style = AppStatusStyle.of(context, AppStatusTone.success);

    return Container(
      width: double.infinity,
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: style.background,
        borderRadius: AppRadius.xlAll,
        border: Border.all(color: style.border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.check_circle_outline, color: style.foreground, size: 22),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Build completed',
                  style: AppTextStyles.subtitle(
                    context,
                  ).copyWith(color: palette.textPrimary),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  'You finished all build steps for ${buildRecord.project.title}.',
                  style: AppTextStyles.body(
                    context,
                  ).copyWith(color: palette.textSecondary, height: 1.4),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _BuildStepsSection extends ConsumerWidget {
  const _BuildStepsSection({
    required this.projectId,
    required this.buildRecord,
    required this.completingStepIds,
    required this.isEditingLocked,
    required this.onCompleteCurrentStep,
    required this.onOpenStepCheck,
  });

  final String projectId;
  final ProjectBuild buildRecord;
  final Set<String> completingStepIds;
  final bool isEditingLocked;
  final VoidCallback onCompleteCurrentStep;
  final Future<void> Function(ProjectBuildStepView step) onOpenStepCheck;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = LearningUiPalette.of(context);
    final stepProgress = buildRecord.stepProgress;
    final materialsReady =
        buildRecord.stepProgress.nextAction !=
        ProjectBuildNextAction.prepareMaterials;

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: palette.cardSurface,
        borderRadius: AppRadius.xlAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Build steps',
            style: AppTextStyles.title(
              context,
            ).copyWith(color: palette.textPrimary),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            materialsReady
                ? '${stepProgress.completed}/${stepProgress.total} completed · ${stepProgress.percent}%'
                : 'Prepare all required materials before starting the build steps.',
            style: AppTextStyles.body(
              context,
            ).copyWith(color: palette.textSecondary),
          ),
          if (stepProgress.steps.isEmpty) ...[
            const SizedBox(height: AppSpacing.md),
            Text(
              'This project does not include build steps yet.',
              style: AppTextStyles.body(
                context,
              ).copyWith(color: palette.textSecondary),
            ),
          ] else ...[
            const SizedBox(height: AppSpacing.lg),
            ...stepProgress.steps.map((step) {
              final isCompleting = completingStepIds.contains(step.stepId);
              final canComplete =
                  !isEditingLocked &&
                  step.state == ProjectBuildStepState.current &&
                  !isCompleting;

              return Padding(
                padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.md),
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsetsDirectional.all(AppSpacing.md),
                  decoration: BoxDecoration(
                    color: palette.cardSurfaceAlt,
                    borderRadius: AppRadius.lgAll,
                    border: Border.all(
                      color: switch (step.state) {
                        ProjectBuildStepState.current => palette.lime,
                        ProjectBuildStepState.completed => palette.borderSubtle,
                        ProjectBuildStepState.locked => palette.borderSubtle,
                      },
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              '${step.stepNumber}. ${step.title}',
                              style: AppTextStyles.subtitle(context).copyWith(
                                color: palette.textPrimary,
                              ),
                            ),
                          ),
                          _StepStateChip(state: step.state),
                        ],
                      ),
                      if (step.description.isNotEmpty) ...[
                        const SizedBox(height: AppSpacing.xs),
                        Text(
                          step.description,
                          style: AppTextStyles.body(context).copyWith(
                            color: palette.textSecondary,
                            height: 1.4,
                          ),
                        ),
                      ],
                      if (canComplete) ...[
                        const SizedBox(height: AppSpacing.md),
                        FilledButton(
                          onPressed: onCompleteCurrentStep,
                          child: const Text('Complete step'),
                        ),
                      ],
                      StepLearningCheckStatusRow(
                        projectId: projectId,
                        buildRecord: buildRecord,
                        step: step,
                        onOpenCheck: () => onOpenStepCheck(step),
                      ),
                    ],
                  ),
                ),
              );
            }),
          ],
        ],
      ),
    );
  }
}

class _StepStateChip extends StatelessWidget {
  const _StepStateChip({required this.state});

  final ProjectBuildStepState state;

  @override
  Widget build(BuildContext context) {
    final label = switch (state) {
      ProjectBuildStepState.locked => 'Locked',
      ProjectBuildStepState.current => 'Current',
      ProjectBuildStepState.completed => 'Completed',
    };
    final tone = switch (state) {
      ProjectBuildStepState.locked => AppStatusTone.neutral,
      ProjectBuildStepState.current => AppStatusTone.primary,
      ProjectBuildStepState.completed => AppStatusTone.success,
    };
    final style = AppStatusStyle.of(context, tone);

    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: style.background,
        borderRadius: AppRadius.pillAll,
        border: Border.all(color: style.border),
      ),
      child: Text(
        label,
        style: AppTextStyles.label(context).copyWith(color: style.foreground),
      ),
    );
  }
}

class _BuildItemCard extends StatelessWidget {
  const _BuildItemCard({
    required this.index,
    required this.item,
    required this.isUpdating,
    required this.isEditingLocked,
    required this.onStatusChanged,
    required this.onEditNote,
    required this.onFindMaterials,
    required this.onRequestMaterial,
    required this.onShowMaterialCandidates,
    required this.onUnlinkMaterial,
    required this.onViewLinkedMaterial,
    required this.onReserveLinkedMaterial,
  });

  final int index;
  final ProjectBuildItem item;
  final bool isUpdating;
  final bool isEditingLocked;
  final ValueChanged<ProjectBuildItemStatus> onStatusChanged;
  final VoidCallback onEditNote;
  final VoidCallback onFindMaterials;
  final VoidCallback onRequestMaterial;
  final VoidCallback onShowMaterialCandidates;
  final VoidCallback onUnlinkMaterial;
  final VoidCallback onViewLinkedMaterial;
  final VoidCallback onReserveLinkedMaterial;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final displayMeta = ProjectBuildItemDisplayMeta.forItem(item);
    final statusStyle = AppStatusStyle.of(context, displayMeta.tone);
    final isAcquired =
        ProjectBuildAcquisitionState.isAcquiredViaCompletedReservation(item);
    final isPartiallyAcquired =
        ProjectBuildAcquisitionState.isPartiallyAcquired(item);
    final hasInsufficientQuantity =
        ProjectBuildAcquisitionState.hasInsufficientQuantity(item);
    final isAwaitingResolution =
        ProjectBuildAcquisitionState.isAwaitingResolution(item);
    final hasSelectedMaterial =
        ProjectBuildAcquisitionState.hasSelectedMaterial(item);
    final showClassificationControls =
        ProjectBuildAcquisitionState.shouldShowClassificationControls(item);

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: palette.cardSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: statusStyle.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CircleAvatar(
                radius: 18,
                backgroundColor: statusStyle.background,
                child: Text(
                  '${index + 1}',
                  style: AppTextStyles.label(
                    context,
                  ).copyWith(color: statusStyle.foreground),
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.component.name.resolve(context),
                      style: AppTextStyles.subtitle(
                        context,
                      ).copyWith(color: palette.textPrimary),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      '${_formatQuantity(item.component.quantity)} ${item.component.unit} · ${item.component.materialType}',
                      style: AppTextStyles.body(
                        context,
                      ).copyWith(color: palette.textSecondary),
                    ),
                    if (item.component.notes != null) ...[
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        item.component.notes!,
                        style: AppTextStyles.body(
                          context,
                        ).copyWith(color: palette.textSecondary),
                      ),
                    ],
                  ],
                ),
              ),
              if (isUpdating)
                const SizedBox.square(
                  dimension: 22,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              else
                _BuildStatusChip(meta: displayMeta),
            ],
          ),
          if (displayMeta.detail != null) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              displayMeta.detail!.resolve(context),
              style: AppTextStyles.body(
                context,
              ).copyWith(color: palette.textSecondary, height: 1.35),
            ),
          ],
          if (!item.isReadyForBuild &&
              !isAcquired &&
              !isPartiallyAcquired &&
              !hasInsufficientQuantity &&
              !isAwaitingResolution) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              hasSelectedMaterial
                  ? LearningProjectBuildL10n.materialSelectedReserveOrAcquire
                      .resolve(context)
                  : item.readinessLabel,
              style: AppTextStyles.body(
                context,
              ).copyWith(color: palette.textSecondary, height: 1.35),
            ),
          ],
          if (isAwaitingResolution) ...[
            const SizedBox(height: AppSpacing.sm),
            Container(
              width: double.infinity,
              padding: const EdgeInsetsDirectional.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: statusStyle.background,
                borderRadius: AppRadius.mdAll,
                border: Border.all(color: statusStyle.border),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    LearningProjectBuildL10n.reservationRequiresResolution
                        .resolve(context),
                    style: AppTextStyles.subtitle(
                      context,
                    ).copyWith(color: statusStyle.foreground),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    LearningProjectBuildL10n.needsAttention.resolve(context),
                    style: AppTextStyles.body(
                      context,
                    ).copyWith(color: palette.textSecondary, height: 1.35),
                  ),
                ],
              ),
            ),
          ],
          if (showClassificationControls && !isEditingLocked) ...[
            const SizedBox(height: AppSpacing.md),
            Wrap(
              spacing: AppSpacing.sm,
              runSpacing: AppSpacing.sm,
              children: ProjectBuildItemStatus.values
                  .map((status) {
                    final selected = status == item.status;
                    final meta = _BuildStatusMeta.fromStatus(status);
                    final style = AppStatusStyle.of(context, meta.tone);

                    return ChoiceChip(
                      selected: selected,
                      label: Text(meta.label),
                      avatar: Icon(
                        meta.icon,
                        size: 18,
                        color: selected
                            ? style.foreground
                            : palette.textSecondary,
                      ),
                      onSelected: isUpdating
                          ? null
                          : (_) => onStatusChanged(status),
                      selectedColor: style.background,
                      backgroundColor: palette.mutedChip,
                      side: BorderSide(
                        color: selected ? style.border : palette.borderSubtle,
                      ),
                      labelStyle: AppTextStyles.label(context).copyWith(
                        color: selected
                            ? style.foreground
                            : palette.textSecondary,
                      ),
                    );
                  })
                  .toList(growable: false),
            ),
          ],
          if (item.learnerNote != null) ...[
            const SizedBox(height: AppSpacing.md),
            Container(
              width: double.infinity,
              padding: const EdgeInsetsDirectional.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: palette.cardSurfaceAlt,
                borderRadius: AppRadius.mdAll,
                border: Border.all(color: palette.borderSubtle),
              ),
              child: Text(
                item.learnerNote!,
                style: AppTextStyles.body(
                  context,
                ).copyWith(color: palette.textSecondary),
              ),
            ),
          ],
          if (item.linkedMaterial != null) ...[
            const SizedBox(height: AppSpacing.md),
            ProjectBuildLinkedMaterialPanel(
              material: item.linkedMaterial!,
              item: item,
              isBusy: isUpdating,
              onViewMaterial: onViewLinkedMaterial,
              onReserveMaterial: item.linkedReservation == null
                  ? onReserveLinkedMaterial
                  : null,
              onUnlink: onUnlinkMaterial,
              onUseAnotherMaterial: onShowMaterialCandidates,
            ),
          ],
          if (!isEditingLocked) ...[
            const SizedBox(height: AppSpacing.md),
            Wrap(
              spacing: AppSpacing.sm,
              runSpacing: AppSpacing.sm,
              children: [
                FilledButton.tonalIcon(
                  onPressed: isUpdating ? null : onShowMaterialCandidates,
                  icon: const Icon(Icons.playlist_add_check_circle_outlined),
                  label: Text(
                    item.linkedMaterial == null
                        ? 'Browse matching materials'
                        : 'Change material option',
                  ),
                ),
                OutlinedButton.icon(
                  onPressed: isUpdating ? null : onFindMaterials,
                  icon: const Icon(Icons.travel_explore_rounded),
                  label: const Text('Browse all materials'),
                ),
                if (!isAcquired &&
                    item.status == ProjectBuildItemStatus.missing)
                  OutlinedButton.icon(
                    onPressed: isUpdating ? null : onRequestMaterial,
                    icon: const Icon(Icons.campaign_outlined),
                    label: const Text('Request this component'),
                  ),
                TextButton.icon(
                  onPressed: isUpdating ? null : onEditNote,
                  icon: const Icon(Icons.edit_note_rounded),
                  label: Text(
                    item.learnerNote == null ? 'Add note' : 'Edit note',
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  String _formatQuantity(double value) {
    if (value == value.roundToDouble()) {
      return value.toInt().toString();
    }

    return value.toStringAsFixed(2);
  }
}

class _BuildStatusChip extends StatelessWidget {
  const _BuildStatusChip({required this.meta});

  final ProjectBuildItemDisplayMeta meta;

  @override
  Widget build(BuildContext context) {
    final style = AppStatusStyle.of(context, meta.tone);

    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: style.background,
        borderRadius: AppRadius.pillAll,
        border: Border.all(color: style.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(meta.icon, size: 16, color: style.foreground),
          const SizedBox(width: AppSpacing.xs),
          Text(
            meta.label.resolve(context),
            style: AppTextStyles.label(
              context,
            ).copyWith(color: style.foreground),
          ),
        ],
      ),
    );
  }
}

class _BuildStatusMeta {
  const _BuildStatusMeta({
    required this.label,
    required this.icon,
    required this.tone,
  });

  final String label;
  final IconData icon;
  final AppStatusTone tone;

  static _BuildStatusMeta fromStatus(ProjectBuildItemStatus status) {
    return switch (status) {
      ProjectBuildItemStatus.available => const _BuildStatusMeta(
        label: 'Available',
        icon: Icons.inventory_2_outlined,
        tone: AppStatusTone.primary,
      ),
      ProjectBuildItemStatus.missing => const _BuildStatusMeta(
        label: 'Missing',
        icon: Icons.search_off_rounded,
        tone: AppStatusTone.warning,
      ),
      ProjectBuildItemStatus.alternative => const _BuildStatusMeta(
        label: 'Alternative',
        icon: Icons.swap_horiz_rounded,
        tone: AppStatusTone.primary,
      ),
      ProjectBuildItemStatus.alreadyOwned => const _BuildStatusMeta(
        label: 'Already owned',
        icon: Icons.home_repair_service_outlined,
        tone: AppStatusTone.primary,
      ),
      ProjectBuildItemStatus.reserved => const _BuildStatusMeta(
        label: 'Reserved',
        icon: Icons.lock_clock_rounded,
        tone: AppStatusTone.info,
      ),
    };
  }
}

class _EmptyChecklistCard extends StatelessWidget {
  const _EmptyChecklistCard({required this.palette, this.embedded = false});

  final LearningUiPalette palette;
  final bool embedded;

  @override
  Widget build(BuildContext context) {
    final message = Text(
      'This project does not list required components yet.',
      style: AppTextStyles.body(
        context,
      ).copyWith(color: palette.textSecondary),
    );

    if (embedded) {
      return message;
    }

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: palette.cardSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: message,
    );
  }
}

class _BuildStatePanel extends StatelessWidget {
  const _BuildStatePanel({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.actionLabel,
    required this.onAction,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final String actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);

    return Center(
      child: Padding(
        padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
        child: Container(
          constraints: const BoxConstraints(maxWidth: 520),
          padding: const EdgeInsetsDirectional.all(AppSpacing.xl),
          decoration: BoxDecoration(
            color: palette.cardSurface,
            borderRadius: AppRadius.xlAll,
            border: Border.all(color: palette.borderSubtle),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 44, color: palette.lime),
              const SizedBox(height: AppSpacing.md),
              Text(
                title,
                textAlign: TextAlign.center,
                style: AppTextStyles.title(
                  context,
                ).copyWith(color: palette.textPrimary),
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                subtitle,
                textAlign: TextAlign.center,
                style: AppTextStyles.body(
                  context,
                ).copyWith(color: palette.textSecondary, height: 1.45),
              ),
              const SizedBox(height: AppSpacing.lg),
              Wrap(
                alignment: WrapAlignment.center,
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.sm,
                children: [
                  FilledButton(onPressed: onAction, child: Text(actionLabel)),
                  OutlinedButton(
                    onPressed: () => context.popOrGo('/learning'),
                    child: const Text('Back to Learning Hub'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CompletedBuildReviewContent extends ConsumerStatefulWidget {
  const _CompletedBuildReviewContent({
    required this.projectId,
    required this.buildRecord,
    required this.completionStorySectionKey,
    required this.learningReflectionSectionKey,
    required this.completedPageScrollController,
    required this.completedPageTopKey,
    required this.onRegisterCompletedPageReset,
    required this.isLifecycleActionInFlight,
    required this.onArchiveBuild,
    required this.onBuildAgain,
    required this.onEditCompletionStory,
    required this.onRefreshBuild,
    required this.onOpenFinalCheck,
  });

  final String projectId;
  final ProjectBuild buildRecord;
  final GlobalKey completionStorySectionKey;
  final GlobalKey learningReflectionSectionKey;
  final ScrollController completedPageScrollController;
  final GlobalKey completedPageTopKey;
  final void Function(
    void Function({bool collapseCheckReview, String? expandSection}) reset,
  ) onRegisterCompletedPageReset;
  final bool isLifecycleActionInFlight;
  final Future<void> Function() onArchiveBuild;
  final Future<void> Function() onBuildAgain;
  final VoidCallback onEditCompletionStory;
  final Future<void> Function() onRefreshBuild;
  final Future<void> Function() onOpenFinalCheck;

  @override
  ConsumerState<_CompletedBuildReviewContent> createState() =>
      _CompletedBuildReviewContentState();
}

class _CompletedBuildReviewContentState
    extends ConsumerState<_CompletedBuildReviewContent> {
  String? _expandedSectionId;
  bool _collapseCheckReview = false;

  @override
  void initState() {
    super.initState();
    widget.onRegisterCompletedPageReset(_resetPageSections);
  }

  void _resetPageSections({
    bool collapseCheckReview = true,
    String? expandSection,
  }) {
    if (!mounted) {
      return;
    }
    setState(() {
      _collapseCheckReview = collapseCheckReview;
      _expandedSectionId = expandSection;
    });
  }

  bool _isMobile(BuildContext context) =>
      MediaQuery.sizeOf(context).width < 600;

  bool _isSectionExpanded(String sectionId, {required bool desktopDefault}) {
    if (sectionId == 'check' && _collapseCheckReview) {
      return false;
    }
    if (_expandedSectionId != null) {
      return _expandedSectionId == sectionId;
    }
    return !_isMobile(context) && desktopDefault;
  }

  void _toggleSection(String sectionId) {
    setState(() {
      _expandedSectionId =
          _expandedSectionId == sectionId ? null : sectionId;
    });
  }

  String _formatDate(BuildContext context, DateTime date) {
    return MaterialLocalizations.of(context).formatMediumDate(date.toLocal());
  }

  Future<void> _openFinalCheck() => widget.onOpenFinalCheck();

  bool _shouldShowCheckReview(
    LearningSessionBundle bundle,
  ) {
    final session = bundle.session;
    if (session != null && session.assignments.isNotEmpty) {
      return true;
    }
    return resolveCompletedReviewFinalCheckUi(
      buildRecord: widget.buildRecord,
      session: session,
      learningSetup: bundle.learningSetup,
    ).isVisible;
  }

  @override
  Widget build(BuildContext context) {
    final sessionAsync =
        ref.watch(buildLearningSessionProvider(widget.projectId));
    final sessionBundle = sessionAsync.asData?.value;
    final session = sessionBundle?.session;

    return SingleChildScrollView(
      controller: widget.completedPageScrollController,
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1120),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              KeyedSubtree(
                key: widget.completedPageTopKey,
                child: _CompletedBuildReviewHeader(
                projectId: widget.projectId,
                buildRecord: widget.buildRecord,
                isLifecycleActionInFlight: widget.isLifecycleActionInFlight,
                onBuildAgain: widget.onBuildAgain,
                formatDate: _formatDate,
                ),
              ),
              if (widget.buildRecord.isEditingLocked) ...[
                const SizedBox(height: AppSpacing.md),
                _BuildLockedNotice(buildRecord: widget.buildRecord),
              ],
              const SizedBox(height: AppSpacing.md),
              _CompletedOverviewCards(
                buildRecord: widget.buildRecord,
                session: session,
                formatDate: _formatDate,
                onOpenStory: widget.onEditCompletionStory,
              ),
              const SizedBox(height: AppSpacing.md),
              _CompletedReviewSectionTile(
                title: ProjectBuildPageL10n.sectionCompletionStoryPhotos
                    .resolve(context),
                expanded: _isSectionExpanded(
                  'story',
                  desktopDefault: false,
                ),
                onToggle: () => _toggleSection('story'),
                child: KeyedSubtree(
                  key: widget.completionStorySectionKey,
                  child: ProjectBuildCompletionStorySection(
                    build: widget.buildRecord,
                    embedded: true,
                    onUpdated: widget.onRefreshBuild,
                  ),
                ),
              ),
              sessionAsync.maybeWhen(
                data: (bundle) {
                  final session = bundle.session;
                  final showCheckReview = _shouldShowCheckReview(bundle);
                  if (session == null && !showCheckReview) {
                    return const SizedBox.shrink();
                  }
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (session != null) ...[
                        const SizedBox(height: AppSpacing.sm),
                        _CompletedReviewSectionTile(
                          title: ProjectBuildPageL10n.sectionLearningJourney
                              .resolve(context),
                          expanded: _isSectionExpanded(
                            'journey',
                            desktopDefault: false,
                          ),
                          onToggle: () => _toggleSection('journey'),
                          child: _LearningJourneyReviewBody(
                            projectId: widget.projectId,
                            buildRecord: widget.buildRecord,
                            session: session,
                            learningReflectionSectionKey:
                                widget.learningReflectionSectionKey,
                            isMobile: _isMobile(context),
                          ),
                        ),
                      ],
                      if (showCheckReview) ...[
                        const SizedBox(height: AppSpacing.sm),
                        _CompletedReviewSectionTile(
                          title: ProjectBuildPageL10n.sectionCheckReview
                              .resolve(context),
                          expanded: _isSectionExpanded(
                            'check',
                            desktopDefault: !_isMobile(context),
                          ),
                          onToggle: () => _toggleSection('check'),
                          child: _CheckReviewBody(
                            session: session,
                            buildRecord: widget.buildRecord,
                            learningSetup: bundle.learningSetup,
                            onOpenFinalCheck: _openFinalCheck,
                          ),
                        ),
                      ],
                    ],
                  );
                },
                orElse: () => const SizedBox.shrink(),
              ),
              const SizedBox(height: AppSpacing.md),
              _CompletedNextActions(
                buildRecord: widget.buildRecord,
                onBuildAgain: widget.onBuildAgain,
                onEditCompletionStory: widget.onEditCompletionStory,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CompletedBuildReviewHeader extends StatelessWidget {
  const _CompletedBuildReviewHeader({
    required this.projectId,
    required this.buildRecord,
    required this.isLifecycleActionInFlight,
    required this.onBuildAgain,
    required this.formatDate,
  });

  final String projectId;
  final ProjectBuild buildRecord;
  final bool isLifecycleActionInFlight;
  final Future<void> Function() onBuildAgain;
  final String Function(BuildContext context, DateTime date) formatDate;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final statusLabel = LearnerBuildsL10n.statusLabel(buildRecord.status);
    final statusTone = buildRecord.status == ProjectBuildStatus.archived
        ? AppStatusTone.neutral
        : AppStatusTone.success;
    final steps = buildRecord.stepProgress;
    final readiness = buildRecord.materialReadiness;

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: palette.cardSurface,
        borderRadius: AppRadius.xlAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Directionality(
                      textDirection: TextDirection.ltr,
                      child: Text(
                        buildRecord.project.title,
                        style: AppTextStyles.display(context).copyWith(
                          color: palette.textPrimary,
                        ),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Wrap(
                      spacing: AppSpacing.sm,
                      runSpacing: AppSpacing.xs,
                      children: [
                        AppStatusBadge(
                          label: statusLabel.resolve(context),
                          tone: statusTone,
                        ),
                        AppStatusBadge(
                          label: LearnerBuildsL10n.attemptNumber(
                            buildRecord.attemptNumber,
                          ).resolve(context),
                          tone: AppStatusTone.neutral,
                        ),
                      ],
                    ),
                    if (buildRecord.completedAt != null) ...[
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        '${ProjectBuildPageL10n.completedOn.resolve(context)} ${formatDate(context, buildRecord.completedAt!)}',
                        style: AppTextStyles.label(context).copyWith(
                          color: palette.textSecondary,
                        ),
                      ),
                    ],
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      '${steps.completed}/${steps.total} ${ProjectBuildPageL10n.completedStepsSummary.resolve(context)} · '
                      '${readiness.ready}/${readiness.total} ${ProjectBuildPageL10n.materialsSummary.resolve(context)}',
                      style: AppTextStyles.label(context),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      ProjectBuildPageL10n.completedHeaderBody.resolve(context),
                      style: AppTextStyles.body(context).copyWith(
                        color: palette.textSecondary,
                        height: 1.45,
                      ),
                    ),
                  ],
                ),
              ),
              _BuildLifecycleMenu(
                buildRecord: buildRecord,
                isBusy: isLifecycleActionInFlight,
                compact: MediaQuery.sizeOf(context).width < 520,
                onPause: () async {},
                onResume: () async {},
                onArchive: () async {},
                onBuildAgain: onBuildAgain,
                onEditCompletionStory: () {},
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              SizedBox(
                height: 52,
                child: FilledButton(
                  onPressed: () => context.push(learnerPortfolioRoute),
                  child: Text(
                    ProjectBuildPageL10n.viewPrivatePortfolio.resolve(context),
                  ),
                ),
              ),
              SizedBox(
                height: 52,
                child: OutlinedButton(
                  onPressed: () => context.go(learnerBuildsRoute),
                  child: Text(
                    ProjectBuildPageL10n.backToMyBuilds.resolve(context),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _CompletedOverviewCards extends StatelessWidget {
  const _CompletedOverviewCards({
    required this.buildRecord,
    required this.session,
    required this.formatDate,
    required this.onOpenStory,
  });

  final ProjectBuild buildRecord;
  final BuildLearningSession? session;
  final String Function(BuildContext context, DateTime date) formatDate;
  final VoidCallback onOpenStory;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final isNarrow = MediaQuery.sizeOf(context).width < 720;
    final story = buildRecord.completionStory;
    final hasStory = (story?.reflection ?? '').trim().isNotEmpty;
    final photoCount = story?.photos.length ?? 0;

    Widget buildCard({
      required String title,
      required String body,
      VoidCallback? onTap,
    }) {
      return Material(
        color: palette.cardSurfaceAlt,
        borderRadius: AppRadius.lgAll,
        child: InkWell(
          onTap: onTap,
          borderRadius: AppRadius.lgAll,
          child: Padding(
            padding: const EdgeInsetsDirectional.all(AppSpacing.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: AppTextStyles.label(context)),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  body,
                  maxLines: 4,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.body(context).copyWith(
                    color: palette.textSecondary,
                    height: 1.35,
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final practicalBody =
        '${buildRecord.stepProgress.completed}/${buildRecord.stepProgress.total} ${ProjectBuildPageL10n.completedStepsSummary.resolve(context)}\n'
        '${buildRecord.materialReadiness.ready}/${buildRecord.materialReadiness.total} ${ProjectBuildPageL10n.materialsSummary.resolve(context)}';

    final journeyBody = session == null
        ? ProjectBuildPageL10n.reflectionNotAdded.resolve(context)
        : _learningJourneySummary(context, session!);

    final storyBody = hasStory
        ? story!.reflection!.trim()
        : photoCount > 0
            ? '$photoCount ${LearnerBuildsL10n.resultPhotosTitle.resolve(context)}'
            : ProjectBuildPageL10n.storyNotAdded.resolve(context);

    final cards = [
      buildCard(
        title: ProjectBuildPageL10n.overviewPracticalResult.resolve(context),
        body: practicalBody,
      ),
      buildCard(
        title: ProjectBuildPageL10n.overviewLearningJourney.resolve(context),
        body: journeyBody,
      ),
      buildCard(
        title: ProjectBuildPageL10n.overviewCompletionStory.resolve(context),
        body: storyBody,
        onTap: onOpenStory,
      ),
    ];

    if (isNarrow) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final card in cards) ...[
            card,
            const SizedBox(height: AppSpacing.sm),
          ],
        ],
      );
    }

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var i = 0; i < cards.length; i++) ...[
          if (i > 0) const SizedBox(width: AppSpacing.sm),
          Expanded(child: cards[i]),
        ],
      ],
    );
  }

  String _learningJourneySummary(
    BuildContext context,
    BuildLearningSession session,
  ) {
    final parts = <String>[];
    if (session.goalOutcome != null) {
      parts.add(FinalLearningCheckL10n.goalOutcomeLabel.resolve(context));
    }
    if (session.confidenceBefore != null && session.confidenceAfter != null) {
      parts.add('${session.confidenceBefore} → ${session.confidenceAfter}');
    }
    final understood = session.learningSummary?.understoodConcepts.length ?? 0;
    final review = session.learningSummary?.reviewConcepts.length ?? 0;
    if (understood > 0 || review > 0) {
      parts.add('$understood / $review');
    }
    return parts.isEmpty
        ? ProjectBuildPageL10n.reflectionNotAdded.resolve(context)
        : parts.join('\n');
  }
}

class _CompletedReviewSectionTile extends StatelessWidget {
  const _CompletedReviewSectionTile({
    required this.title,
    required this.child,
    required this.expanded,
    required this.onToggle,
  });

  final String title;
  final Widget child;
  final bool expanded;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);

    return Material(
      color: palette.cardSurface,
      borderRadius: AppRadius.lgAll,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          InkWell(
            onTap: onToggle,
            borderRadius: AppRadius.lgAll,
            child: Padding(
              padding: const EdgeInsetsDirectional.symmetric(
                horizontal: AppSpacing.md,
                vertical: AppSpacing.md,
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      title,
                      style: AppTextStyles.subtitle(context),
                    ),
                  ),
                  Icon(
                    expanded
                        ? Icons.expand_less_rounded
                        : Icons.expand_more_rounded,
                  ),
                ],
              ),
            ),
          ),
          if (expanded)
            Padding(
              padding: const EdgeInsetsDirectional.fromSTEB(
                AppSpacing.md,
                0,
                AppSpacing.md,
                AppSpacing.md,
              ),
              child: child,
            ),
        ],
      ),
    );
  }
}

class _LearningJourneyReviewBody extends StatefulWidget {
  const _LearningJourneyReviewBody({
    required this.projectId,
    required this.buildRecord,
    required this.session,
    required this.learningReflectionSectionKey,
    required this.isMobile,
  });

  final String projectId;
  final ProjectBuild buildRecord;
  final BuildLearningSession session;
  final GlobalKey learningReflectionSectionKey;
  final bool isMobile;

  @override
  State<_LearningJourneyReviewBody> createState() =>
      _LearningJourneyReviewBodyState();
}

class _LearningJourneyReviewBodyState extends State<_LearningJourneyReviewBody> {
  bool _reflectionExpanded = false;

  @override
  void initState() {
    super.initState();
    _reflectionExpanded = !widget.isMobile &&
        (widget.session.finalReflection?.trim().isNotEmpty ?? false);
  }

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final languageCode = Localizations.localeOf(context).languageCode;
    final goal = widget.session.learningGoal?.trim();
    final isArabic = languageCode == 'ar';
    final hasReflection =
        widget.session.finalReflection?.trim().isNotEmpty ?? false;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (goal != null && goal.isNotEmpty) ...[
          Text(
            LearnerBuildsL10n.learningGoalAdded.resolve(context),
            style: AppTextStyles.label(context),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(goal, style: AppTextStyles.body(context)),
          const SizedBox(height: AppSpacing.sm),
        ],
        if (widget.session.goalOutcome != null) ...[
          Text(
            FinalLearningCheckL10n.goalOutcomeLabel.resolve(context),
            style: AppTextStyles.label(context),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            _goalOutcomeLabel(widget.session.goalOutcome!).resolve(context),
            style: AppTextStyles.body(context),
          ),
          const SizedBox(height: AppSpacing.sm),
        ],
        if (widget.session.confidenceBefore != null &&
            widget.session.confidenceAfter != null) ...[
          Text(
            isArabic
                ? '${FinalLearningCheckL10n.confidenceProgressLabel.resolve(context)}: ${widget.session.confidenceBefore} ← ${widget.session.confidenceAfter}'
                : '${FinalLearningCheckL10n.confidenceProgressLabel.resolve(context)}: ${widget.session.confidenceBefore} → ${widget.session.confidenceAfter}',
            style: AppTextStyles.label(context).copyWith(
              color: palette.textSecondary,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
        ],
        if (widget.session.learningSummary != null)
          LearningSummarySection(summary: widget.session.learningSummary!),
        const SizedBox(height: AppSpacing.sm),
        OutlinedButton(
          onPressed: () => setState(() => _reflectionExpanded = !_reflectionExpanded),
          child: Text(
            hasReflection
                ? ProjectBuildPageL10n.editLearningReflection.resolve(context)
                : ProjectBuildPageL10n.addLearningReflection.resolve(context),
          ),
        ),
        if (_reflectionExpanded) ...[
          const SizedBox(height: AppSpacing.md),
          KeyedSubtree(
            key: widget.learningReflectionSectionKey,
            child: LearningReflectionSection(
              projectId: widget.projectId,
              buildRecord: widget.buildRecord,
              session: widget.session,
            ),
          ),
        ],
      ],
    );
  }

  LocalizedText _goalOutcomeLabel(LearningGoalOutcome outcome) {
    return switch (outcome) {
      LearningGoalOutcome.achieved => FinalLearningCheckL10n.goalAchieved,
      LearningGoalOutcome.partiallyAchieved => FinalLearningCheckL10n.goalPartial,
      LearningGoalOutcome.notYetAchieved => FinalLearningCheckL10n.goalNotYet,
    };
  }
}

class _CheckReviewBody extends StatelessWidget {
  const _CheckReviewBody({
    required this.session,
    required this.buildRecord,
    required this.learningSetup,
    required this.onOpenFinalCheck,
  });

  final BuildLearningSession? session;
  final ProjectBuild buildRecord;
  final ProjectBuildLearningSetup learningSetup;
  final VoidCallback onOpenFinalCheck;

  @override
  Widget build(BuildContext context) {
    final finalUi = resolveCompletedReviewFinalCheckUi(
      buildRecord: buildRecord,
      session: session,
      learningSetup: learningSetup,
    );
    final startAssignments = session?.startAssignments ?? const [];
    final stepAssignments = session?.stepAssignments ?? const [];
    final finalAssignments = session?.finalAssignments ?? const [];
    final showFinalGroup =
        finalAssignments.isNotEmpty || finalUi.isVisible;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (startAssignments.isNotEmpty)
          _CheckReviewGroup(
            title: ProjectBuildPageL10n.startCheckGroup.resolve(context),
            assignments: startAssignments,
          ),
        if (stepAssignments.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.sm),
          _CheckReviewGroup(
            title: ProjectBuildPageL10n.stepCheckGroup.resolve(context),
            assignments: stepAssignments,
          ),
        ],
        if (showFinalGroup) ...[
          const SizedBox(height: AppSpacing.sm),
          _CheckReviewGroup(
            title: ProjectBuildPageL10n.finalCheckGroup.resolve(context),
            assignments: finalAssignments,
            isFinalGroup: true,
            finalCheckUi: finalUi,
            onOpenFinalCheck: onOpenFinalCheck,
          ),
        ],
      ],
    );
  }
}

class _CheckReviewGroup extends StatelessWidget {
  const _CheckReviewGroup({
    required this.title,
    required this.assignments,
    this.isFinalGroup = false,
    this.finalCheckUi,
    this.onOpenFinalCheck,
  });

  final String title;
  final List<LearningAssignment> assignments;
  final bool isFinalGroup;
  final CompletedReviewFinalCheckUi? finalCheckUi;
  final VoidCallback? onOpenFinalCheck;

  Future<void> _openReviewDialog(BuildContext context) async {
    if (assignments.isEmpty) {
      return;
    }
    await showDialog<void>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          title: Text(title),
          content: SizedBox(
            width: 520,
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (final assignment in assignments)
                    _CheckReviewQuestionTile(
                      assignment: assignment,
                      expanded: true,
                      onExpanded: () {},
                    ),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: Text(ProjectBuildPageL10n.cancel.resolve(context)),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final progress = _computeProgress(assignments);
    final summary =
        '${progress.handled}/${progress.total} ${ProjectBuildPageL10n.checkGroupProgress.resolve(context)} · '
        '${progress.correct} ${ProjectBuildPageL10n.checkGroupCorrect.resolve(context)} · '
        '${progress.skipped} ${ProjectBuildPageL10n.checkGroupSkipped.resolve(context)} · '
        '${progress.remaining} ${ProjectBuildPageL10n.checkGroupRemaining.resolve(context)}';

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: palette.cardSurfaceAlt,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(title, style: AppTextStyles.label(context)),
          const SizedBox(height: AppSpacing.xs),
          Text(
            summary,
            style: AppTextStyles.body(context).copyWith(
              color: palette.textSecondary,
            ),
          ),
          if (isFinalGroup && finalCheckUi != null) ...[
            const SizedBox(height: AppSpacing.sm),
            if (finalCheckUi!.compactNotice != null)
              Text(
                finalCheckUi!.compactNotice!.resolve(context),
                style: AppTextStyles.body(context).copyWith(
                  color: palette.textSecondary,
                  height: 1.4,
                ),
              ),
            if (finalCheckUi!.actionLabel != null && onOpenFinalCheck != null) ...[
              const SizedBox(height: AppSpacing.sm),
              SizedBox(
                height: 52,
                child: FilledButton(
                  onPressed: onOpenFinalCheck,
                  child: Text(finalCheckUi!.actionLabel!.resolve(context)),
                ),
              ),
            ],
          ],
          if (assignments.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            SizedBox(
              height: 52,
              child: OutlinedButton(
                onPressed: () => _openReviewDialog(context),
                child: Text(ProjectBuildPageL10n.reviewAnswers.resolve(context)),
              ),
            ),
          ],
        ],
      ),
    );
  }

  LearningCheckProgress _computeProgress(List<LearningAssignment> items) {
    final total = items.length;
    final skipped =
        items.where((a) => a.status == LearningAssignmentStatus.skipped).length;
    final correct = items.where((a) => a.hasCorrectAnswer).length;
    final answered =
        items.where((a) => a.status == LearningAssignmentStatus.answered).length;
    final handled = items.where((a) => a.isComplete).length;
    return LearningCheckProgress(
      total: total,
      answered: answered,
      correct: correct,
      skipped: skipped,
      remaining: total - handled,
      handled: handled,
    );
  }
}

class _CheckReviewQuestionTile extends StatelessWidget {
  const _CheckReviewQuestionTile({
    required this.assignment,
    required this.expanded,
    required this.onExpanded,
  });

  final LearningAssignment assignment;
  final bool expanded;
  final VoidCallback onExpanded;

  @override
  Widget build(BuildContext context) {
    final languageCode = Localizations.localeOf(context).languageCode;
    final palette = LearningUiPalette.of(context);
    final statusLabel = _statusLabel(assignment).resolve(context);
    final stepTitle = assignment.stepTitle?.trim();

    return Padding(
      padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.sm),
      child: Material(
        color: palette.cardSurfaceAlt,
        borderRadius: AppRadius.mdAll,
        child: InkWell(
          onTap: onExpanded,
          borderRadius: AppRadius.mdAll,
          child: Padding(
            padding: const EdgeInsetsDirectional.all(AppSpacing.sm),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (stepTitle != null && stepTitle.isNotEmpty) ...[
                  Text(
                    ProjectBuildPageL10n.stepLabel.resolve(context),
                    style: AppTextStyles.label(context).copyWith(
                      color: palette.textSecondary,
                      fontSize: 12,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Directionality(
                    textDirection: TextDirection.ltr,
                    child: Text(
                      stepTitle,
                      style: AppTextStyles.label(context),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    ProjectBuildPageL10n.whyThisStepMatters.resolve(context),
                    style: AppTextStyles.label(context).copyWith(
                      fontSize: 12,
                      color: palette.textSecondary,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                ],
                Text(
                  assignment.question.promptFor(languageCode),
                  style: AppTextStyles.body(context),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  statusLabel,
                  style: AppTextStyles.label(context).copyWith(
                    color: palette.textSecondary,
                  ),
                ),
                if (expanded) ...[
                  const SizedBox(height: AppSpacing.sm),
                  _CheckReviewQuestionDetails(assignment: assignment),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  LocalizedText _statusLabel(LearningAssignment assignment) {
    if (assignment.hasCorrectAnswer) {
      return ProjectBuildPageL10n.statusAnsweredCorrectly;
    }
    if (assignment.status == LearningAssignmentStatus.skipped &&
        assignment.answerAttempts.isEmpty) {
      return ProjectBuildPageL10n.statusSkippedForNow;
    }
    if (assignment.answerAttempts.isNotEmpty) {
      return ProjectBuildPageL10n.statusNeedsReview;
    }
    return ProjectBuildPageL10n.statusNotAnswered;
  }
}

class _CheckReviewQuestionDetails extends StatelessWidget {
  const _CheckReviewQuestionDetails({required this.assignment});

  final LearningAssignment assignment;

  String _optionLabel(String languageCode, String? optionKey) {
    if (optionKey == null || optionKey.isEmpty) {
      return '';
    }
    for (final option in assignment.question.options) {
      if (option.optionKey == optionKey) {
        return option.promptFor(languageCode);
      }
    }
    return optionKey;
  }

  @override
  Widget build(BuildContext context) {
    final languageCode = Localizations.localeOf(context).languageCode;
    final palette = LearningUiPalette.of(context);
    final latest = assignment.latestAttempt;
    final selectedKey = latest?.selectedOptionKey;
    final showCorrect = assignment.reviewCorrectOptionKey != null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (selectedKey != null) ...[
          Text(
            ProjectBuildPageL10n.yourAnswer.resolve(context),
            style: AppTextStyles.label(context),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            _optionLabel(languageCode, selectedKey),
            style: AppTextStyles.body(context),
          ),
          const SizedBox(height: AppSpacing.sm),
        ],
        if (showCorrect) ...[
          Text(
            ProjectBuildPageL10n.correctAnswer.resolve(context),
            style: AppTextStyles.label(context),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            _optionLabel(languageCode, assignment.reviewCorrectOptionKey),
            style: AppTextStyles.body(context),
          ),
          const SizedBox(height: AppSpacing.sm),
        ],
        if (latest != null && !latest.isCorrect) ...[
          Text(
            ProjectBuildPageL10n.explanation.resolve(context),
            style: AppTextStyles.label(context),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            assignment.question.explanationFor(languageCode),
            style: AppTextStyles.body(context),
          ),
          const SizedBox(height: AppSpacing.sm),
        ],
        if (assignment.hintViewed) ...[
          Text(
            ProjectBuildPageL10n.hintViewed.resolve(context),
            style: AppTextStyles.label(context).copyWith(
              color: palette.textSecondary,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
        ],
        if (assignment.attemptCount > 0)
          Text(
            '${ProjectBuildPageL10n.attemptCountLabel.resolve(context)}: ${assignment.attemptCount}',
            style: AppTextStyles.label(context).copyWith(
              color: palette.textSecondary,
            ),
          ),
      ],
    );
  }
}

class _CompletedNextActions extends StatelessWidget {
  const _CompletedNextActions({
    required this.buildRecord,
    required this.onBuildAgain,
    required this.onEditCompletionStory,
  });

  final ProjectBuild buildRecord;
  final Future<void> Function() onBuildAgain;
  final VoidCallback onEditCompletionStory;

  @override
  Widget build(BuildContext context) {
    final hasStory = (buildRecord.completionStory?.reflection ?? '').trim().isNotEmpty;
    final hasPhotos = buildRecord.completionStory?.photos.isNotEmpty ?? false;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          ProjectBuildPageL10n.sectionNextActions.resolve(context),
          style: AppTextStyles.subtitle(context),
        ),
        const SizedBox(height: AppSpacing.sm),
        SizedBox(
          width: double.infinity,
          height: 52,
          child: FilledButton(
            onPressed: () => context.push(learnerPortfolioRoute),
            child: Text(
              ProjectBuildPageL10n.viewPrivatePortfolio.resolve(context),
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: [
            OutlinedButton(
              onPressed: () => context.go(learnerBuildsRoute),
              child: Text(
                ProjectBuildPageL10n.backToMyBuilds.resolve(context),
              ),
            ),
            OutlinedButton(
              onPressed: onBuildAgain,
              child: Text(LearnerBuildsL10n.buildAgain.resolve(context)),
            ),
            if (!hasStory)
              TextButton(
                onPressed: onEditCompletionStory,
                child: Text(
                  FinalLearningCheckL10n.addCompletionStory.resolve(context),
                ),
              ),
            if (!hasPhotos)
              TextButton(
                onPressed: onEditCompletionStory,
                child: Text(
                  ProjectBuildPageL10n.addResultPhotos.resolve(context),
                ),
              ),
          ],
        ),
      ],
    );
  }
}

enum _ProjectCompletionCloseAction { review, addPhoto, portfolio }