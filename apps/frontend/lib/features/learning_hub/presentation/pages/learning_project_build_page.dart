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
import '../../../../shared/widgets/app_back_action.dart';
import '../../../../shared/widgets/protected_media_image.dart';
import '../../../ai/application/ai_assistant_shell_provider.dart';
import '../../../ai/application/ai_chat_controller.dart';
import '../../../ai/presentation/widgets/ai_assistant_shell.dart';
import '../../../../shared/models/localized_text.dart';
import '../../../../shared/utils/content_text_direction.dart';
import '../../../home/application/learner_home_provider.dart';
import '../../../learner_material_requests/application/learner_material_requests_providers.dart';
import '../../application/learning_hub_providers.dart';
import '../../application/build_display_phase.dart';
import '../../application/project_build_refresh.dart';
import '../../domain/models/learning_project.dart';
import '../../domain/models/project_build.dart';
import '../../../../core/errors/api_exception.dart';
import '../../domain/models/project_material_coverage.dart';
import '../theme/learning_ui_palette.dart';
import '../l10n/learning_hub_coverage_l10n.dart';
import '../l10n/smart_build_plan_l10n.dart';
import '../l10n/learning_project_build_l10n.dart';
import '../l10n/project_build_page_l10n.dart';
import '../widgets/project_build_acquisition_state.dart';
import '../../../learner_builds/application/learner_builds_providers.dart';
import '../../../learner_builds/presentation/l10n/learner_builds_l10n.dart';
import '../../../project_notebook/presentation/l10n/project_notebook_l10n.dart';
import '../widgets/project_build_material_linking.dart';
import '../widgets/build_journey/build_active_phase.dart';
import '../widgets/build_journey/build_prepare_phase.dart';
import '../widgets/build_journey/build_reflection_phase.dart';
import '../../../project_help_sessions/presentation/widgets/build_help_session_compact_action.dart';
import '../widgets/build_steps/build_step_number_badge.dart';
import '../widgets/project_build_completion_story_section.dart';
import '../../application/learning_session_providers.dart';
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
  bool _hasStartedBuild = false;
  bool _allowResumeBanner = true;
  final GlobalKey _completedPageTopKey = GlobalKey();
  final GlobalKey<ProjectBuildCompletionStorySectionState>
  _completionStorySectionKey =
      GlobalKey<ProjectBuildCompletionStorySectionState>();
  final GlobalKey _learningReflectionSectionKey = GlobalKey();
  late final ProjectBuildRefreshCoordinator _refreshCoordinator =
      ProjectBuildRefreshCoordinator(
        onRefresh: () {
          ref.invalidate(projectBuildProvider(widget.projectId));
        },
      );
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
    _buildRefreshController.setPaused(true);
    super.deactivate();
  }

  @override
  void activate() {
    super.activate();
    if (_routeSuspended) {
      _routeSuspended = false;
      _buildRefreshController.setPaused(false);
      _allowResumeBanner = true;
      unawaited(_refreshBuild());
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    switch (state) {
      case AppLifecycleState.resumed:
        // Stay paused while another route covers this page.
        if (_routeSuspended) {
          return;
        }
        _allowResumeBanner = true;
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
      await ref
          .read(learningHubRepositoryProvider)
          .startBuild(
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
    context
        .push(
          Uri(
            path: '/learner/material-requests/new',
            queryParameters: params,
          ).toString(),
        )
        .then((_) {
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

  void _viewReservation(ProjectBuildItem item) {
    final reservationId = item.linkedReservation?.id;
    if (reservationId == null || reservationId.trim().isEmpty) {
      _viewLinkedMaterial(item);
      return;
    }

    context.push('/learner/reservations/$reservationId');
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
        requestedQuantity: _buildItemRequestedQuantity(item),
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
        requestedQuantity: _buildItemRequestedQuantity(item),
      ),
    );
  }

  double? _buildItemRequestedQuantity(ProjectBuildItem item) {
    final required =
        item.quantityAllocation?.requiredQuantity ?? item.component.quantity;
    return required > 0 ? required : null;
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

    _allowResumeBanner = false;
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
        final nextStep = updated.stepProgress.currentStep;
        if (nextStep != null &&
            updated.status != ProjectBuildStatus.completed) {
          await _showStepCompletedFeedback(completedStep, nextStep);
        }
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

  Future<void> _showStepCompletedFeedback(
    ProjectBuildStepView completedStep,
    ProjectBuildCurrentStep nextStep,
  ) async {
    if (!mounted) {
      return;
    }

    await showDialog<void>(
      context: context,
      builder: (dialogContext) {
        final palette = LearningUiPalette.of(dialogContext);
        return Dialog(
          insetPadding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.lg,
            vertical: AppSpacing.lg,
          ),
          child: Padding(
            padding: const EdgeInsetsDirectional.fromSTEB(
              AppSpacing.md,
              AppSpacing.md,
              AppSpacing.md,
              AppSpacing.sm,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Icon(
                  Icons.check_circle_rounded,
                  color: palette.lime,
                  size: 28,
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  '✓ ${ProjectBuildPageL10n.stepCompletedFeedback(
                    completedStep.stepNumber,
                  ).resolve(dialogContext)}',
                  style: AppTextStyles.subtitle(
                    dialogContext,
                  ).copyWith(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  ProjectBuildPageL10n.nextStepReady.resolve(dialogContext),
                  style: AppTextStyles.label(
                    dialogContext,
                  ).copyWith(color: palette.textSecondary),
                ),
                const SizedBox(height: 2),
                ContentDirectionalText(
                  nextStep.title,
                  style: AppTextStyles.body(dialogContext),
                ),
                const SizedBox(height: AppSpacing.md),
                SizedBox(
                  height: 44,
                  child: FilledButton(
                    onPressed: () => Navigator.of(dialogContext).pop(),
                    child: Text(
                      ProjectBuildPageL10n.continueLabel.resolve(dialogContext),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
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
                  FinalLearningCheckL10n.reviewFinalCheck.resolve(
                    dialogContext,
                  ),
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
        setState(
          () => _completingStepIds.add(build.stepProgress.currentStep!.stepId),
        );
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
        _openCompletionResultPhotoPicker();
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
    _resetCompletedPageSections?.call(
      collapseCheckReview: false,
      expandSection: 'story',
    );
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final storyContext = _completionStorySectionKey.currentContext;
      if (storyContext == null || !storyContext.mounted) {
        return;
      }
      Scrollable.ensureVisible(
        storyContext,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
    });
  }

  void _openCompletionResultPhotoPicker() {
    _scrollToCompletionStory();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        unawaited(
          _completionStorySectionKey.currentState?.pickResultPhoto() ??
              Future<void>.value(),
        );
      });
    });
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
    final supporting = FinalLearningCheckL10n.buildCompletedSupporting.resolve(
      context,
    );
    final reviewLabel = FinalLearningCheckL10n.reviewCompletedProject.resolve(
      context,
    );
    final photoLabel = FinalLearningCheckL10n.addResultPhoto.resolve(context);
    final portfolioLabel = FinalLearningCheckL10n.viewPrivatePortfolio.resolve(
      context,
    );

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
                      style: Theme.of(sheetContext).textTheme.bodyMedium
                          ?.copyWith(
                            color: Theme.of(
                              sheetContext,
                            ).colorScheme.onSurfaceVariant,
                          ),
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    SizedBox(
                      width: double.infinity,
                      height: 52,
                      child: FilledButton(
                        onPressed: () => Navigator.of(
                          sheetContext,
                        ).pop(_ProjectCompletionCloseAction.review),
                        child: Text(reviewLabel),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    SizedBox(
                      width: double.infinity,
                      height: 52,
                      child: OutlinedButton(
                        onPressed: () => Navigator.of(
                          sheetContext,
                        ).pop(_ProjectCompletionCloseAction.addPhoto),
                        child: Text(photoLabel),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    SizedBox(
                      width: double.infinity,
                      height: 52,
                      child: TextButton(
                        onPressed: () => Navigator.of(
                          sheetContext,
                        ).pop(_ProjectCompletionCloseAction.portfolio),
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
                    style: Theme.of(dialogContext).textTheme.bodyMedium
                        ?.copyWith(
                          color: Theme.of(
                            dialogContext,
                          ).colorScheme.onSurfaceVariant,
                        ),
                  ),
                ],
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(
                    dialogContext,
                  ).pop(_ProjectCompletionCloseAction.portfolio),
                  child: Text(portfolioLabel),
                ),
                OutlinedButton(
                  onPressed: () => Navigator.of(
                    dialogContext,
                  ).pop(_ProjectCompletionCloseAction.addPhoto),
                  child: Text(photoLabel),
                ),
                FilledButton(
                  onPressed: () => Navigator.of(
                    dialogContext,
                  ).pop(_ProjectCompletionCloseAction.review),
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

  String _stepHelpPrefill(ProjectBuild build) {
    final step = build.stepProgress.currentStep;
    final buffer = StringBuffer('I am building ${build.project.title}.');
    if (step != null) {
      buffer.write(' Current step: ${step.stepNumber}. ${step.title}');
    }
    return buffer.toString();
  }

  Future<void> _openBuildGuide(ProjectBuild build, {String? composerPrefill}) {
    if (_isBuildGuidePanelOpen(context)) {
      return Future.value();
    }

    return _guideOpenRequests.putIfAbsent(widget.projectId, () {
      _openingGuide = true;
      if (mounted) {
        setState(() {});
      }

      final request = _openBuildGuideInternal(
        build,
        composerPrefill: composerPrefill,
      );
      return request.whenComplete(() {
        _guideOpenRequests.remove(widget.projectId);
        if (mounted) {
          setState(() => _openingGuide = false);
        }
      });
    });
  }

  Future<void> _openBuildGuideInternal(
    ProjectBuild build, {
    String? composerPrefill,
  }) async {
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
        ref
            .read(aiAssistantShellProvider.notifier)
            .open(
              conversationId: conversationId,
              buildGuideContext: BuildGuideContext.fromProjectBuild(build),
              composerPrefill: composerPrefill,
            );
        _setGuideQueryParams(conversationId);
        return;
      }

      final liveContext = BuildGuideContext.fromProjectBuild(build);
      if (composerPrefill != null && composerPrefill.trim().isNotEmpty) {
        ref
            .read(aiAssistantShellProvider.notifier)
            .open(
              composerPrefill: composerPrefill,
              buildGuideContext: liveContext,
            );
      }

      context
          .push(
            '/learning/${widget.projectId}/build/guide?conversationId=${Uri.encodeComponent(conversationId)}',
            extra: liveContext,
          )
          .then((_) {
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
    return maxByFraction.clamp(
      _buildGuidePanelMinWidth,
      _buildGuidePanelMaxWidth,
    );
  }

  void _maybeRedirectNarrowGuideRoute() {
    if (_redirectedNarrowGuide || _isWideBuildLayout(context)) {
      return;
    }

    if (!_guideQueryIsOpen(context)) {
      return;
    }

    final conversationId =
        GoRouterState.of(
          context,
        ).uri.queryParameters['conversationId']?.trim() ??
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

    final conversationId = GoRouterState.of(
      context,
    ).uri.queryParameters['conversationId']!.trim();

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
      _closeGuidePanel(errorMessage: 'Unable to open the build assistant.');
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
        _closeGuidePanel(errorMessage: 'Unable to open the build assistant.');
        return;
      }

      _activeGuideConversationId = conversationId;
      ref
          .read(aiAssistantShellProvider.notifier)
          .open(
            conversationId: conversationId,
            buildGuideContext: BuildGuideContext.fromProjectBuild(build),
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
        if (!mounted) {
          return;
        }
        _syncBuildRefreshPolling(build);
        if (build != null) {
          ref
              .read(aiAssistantShellProvider.notifier)
              .syncBuildGuideContextFromBuild(build);
        }
      });
    });

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

                  return _buildWorkspace(context: context, build: build);
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
      hasStartedBuild: _hasStartedBuild,
      showResumeBanner: _allowResumeBanner,
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
      onAddResultPhoto: _openCompletionResultPhotoPicker,
      onRefreshBuild: _refreshBuild,
      onStatusChanged: _updateItem,
      onEditNote: _editNote,
      onFindMaterials: _findMaterials,
      onRequestMaterial: (item) => _requestMaterial(item, build),
      onShowMaterialCandidates: _showMaterialCandidates,
      onUnlinkMaterial: _unlinkMaterial,
      onViewLinkedMaterial: _viewLinkedMaterial,
      onViewReservation: _viewReservation,
      onReserveLinkedMaterial: _reserveLinkedMaterial,
      onCompleteCurrentStep: () => _completeCurrentStep(build),
      onOpenBuildGuide: () => _openBuildGuide(build),
      onNeedStepHelp: () =>
          _openBuildGuide(build, composerPrefill: _stepHelpPrefill(build)),
      onOpenNotebook: () =>
          context.push(learnerBuildNotebookRoute(build.id)),
      onOpenSmartPlan: () =>
          context.push('/learning/${widget.projectId}/build/smart-plan'),
      onStartBuilding: () => setState(() => _hasStartedBuild = true),
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
    required this.hasStartedBuild,
    required this.showResumeBanner,
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
    required this.onAddResultPhoto,
    required this.onRefreshBuild,
    required this.onStatusChanged,
    required this.onEditNote,
    required this.onFindMaterials,
    required this.onRequestMaterial,
    required this.onShowMaterialCandidates,
    required this.onUnlinkMaterial,
    required this.onViewLinkedMaterial,
    required this.onViewReservation,
    required this.onReserveLinkedMaterial,
    required this.onCompleteCurrentStep,
    required this.onOpenBuildGuide,
    required this.onNeedStepHelp,
    required this.onOpenNotebook,
    required this.onOpenSmartPlan,
    required this.onStartBuilding,
    required this.onOpenStepCheck,
    required this.onOpenFinalCheck,
    required this.completedPageScrollController,
    required this.completedPageTopKey,
    required this.onRegisterCompletedPageReset,
  });

  final String projectId;
  final ProjectBuild buildRecord;
  final bool hasStartedBuild;
  final bool showResumeBanner;
  final GlobalKey<ProjectBuildCompletionStorySectionState>
  completionStorySectionKey;
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
  final VoidCallback onAddResultPhoto;
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
  final ValueChanged<ProjectBuildItem> onViewReservation;
  final ValueChanged<ProjectBuildItem> onReserveLinkedMaterial;
  final VoidCallback onCompleteCurrentStep;
  final VoidCallback onOpenBuildGuide;
  final VoidCallback onNeedStepHelp;
  final VoidCallback onOpenNotebook;
  final VoidCallback onOpenSmartPlan;
  final VoidCallback onStartBuilding;
  final Future<void> Function(ProjectBuildStepView step) onOpenStepCheck;
  final Future<void> Function() onOpenFinalCheck;
  final ScrollController completedPageScrollController;
  final GlobalKey completedPageTopKey;
  final void Function(
    void Function({bool collapseCheckReview, String? expandSection}) reset,
  )
  onRegisterCompletedPageReset;

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
        onAddResultPhoto: onAddResultPhoto,
        onRefreshBuild: onRefreshBuild,
        onOpenFinalCheck: onOpenFinalCheck,
      );
    }

    final isEditingLocked = buildRecord.isEditingLocked;
    final phase = BuildDisplayPhaseResolver.resolve(
      buildRecord,
      learnerStartedBuild: hasStartedBuild,
    );

    return SingleChildScrollView(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1120),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (phase == BuildDisplayPhase.build)
                _BuildPhaseNavBar(
                  projectId: projectId,
                  buildRecord: buildRecord,
                  isLifecycleActionInFlight: isLifecycleActionInFlight,
                  onPauseBuild: onPauseBuild,
                  onResumeBuild: onResumeBuild,
                  onArchiveBuild: onArchiveBuild,
                  onBuildAgain: onBuildAgain,
                  onEditCompletionStory: onEditCompletionStory,
                )
              else
                _BuildHeader(
                  projectId: projectId,
                  buildRecord: buildRecord,
                  openingGuide: openingGuide,
                  isLifecycleActionInFlight: isLifecycleActionInFlight,
                  showReadinessProgress: phase != BuildDisplayPhase.prepare,
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
              const SizedBox(height: AppSpacing.md),
              switch (phase) {
                BuildDisplayPhase.prepare => BuildPreparePhase(
                  projectId: projectId,
                  buildRecord: buildRecord,
                  updatingItemIds: updatingItemIds,
                  isEditingLocked: isEditingLocked,
                  onStartBuilding: onStartBuilding,
                  onStatusChanged: onStatusChanged,
                  onEditNote: onEditNote,
                  onFindMaterials: onFindMaterials,
                  onRequestMaterial: onRequestMaterial,
                  onShowMaterialCandidates: onShowMaterialCandidates,
                  onUnlinkMaterial: onUnlinkMaterial,
                  onViewLinkedMaterial: onViewLinkedMaterial,
                  onReserveLinkedMaterial: onReserveLinkedMaterial,
                  onViewReservation: onViewReservation,
                ),
                BuildDisplayPhase.build => BuildActivePhase(
                  projectId: projectId,
                  buildRecord: buildRecord,
                  completingStepIds: completingStepIds,
                  updatingItemIds: updatingItemIds,
                  isEditingLocked: isEditingLocked,
                  showResumeBanner: showResumeBanner,
                  openingGuide: openingGuide,
                  onCompleteCurrentStep: onCompleteCurrentStep,
                  onOpenStepCheck: onOpenStepCheck,
                  onNeedHelp: onNeedStepHelp,
                  onOpenBuildGuide: onOpenBuildGuide,
                  onOpenNotebook: onOpenNotebook,
                  onOpenSmartPlan: onOpenSmartPlan,
                  onStatusChanged: onStatusChanged,
                  onEditNote: onEditNote,
                  onFindMaterials: onFindMaterials,
                  onRequestMaterial: onRequestMaterial,
                  onShowMaterialCandidates: onShowMaterialCandidates,
                  onUnlinkMaterial: onUnlinkMaterial,
                  onViewLinkedMaterial: onViewLinkedMaterial,
                  onReserveLinkedMaterial: onReserveLinkedMaterial,
                  onViewReservation: onViewReservation,
                ),
                BuildDisplayPhase.reflect => BuildReflectionPhase(
                  projectId: projectId,
                  buildRecord: buildRecord,
                  onContinue: () => onOpenFinalCheck(),
                  onOpenFinalCheck: () => onOpenFinalCheck(),
                ),
                BuildDisplayPhase.complete => const SizedBox.shrink(),
              },
              BuildHelpSessionCompactAction(buildRecord: buildRecord),
            ],
          ),
        ),
      ),
    );
  }
}

class _BuildPhaseNavBar extends StatelessWidget {
  const _BuildPhaseNavBar({
    required this.projectId,
    required this.buildRecord,
    required this.isLifecycleActionInFlight,
    required this.onPauseBuild,
    required this.onResumeBuild,
    required this.onArchiveBuild,
    required this.onBuildAgain,
    required this.onEditCompletionStory,
  });

  final String projectId;
  final ProjectBuild buildRecord;
  final bool isLifecycleActionInFlight;
  final Future<void> Function() onPauseBuild;
  final Future<void> Function() onResumeBuild;
  final Future<void> Function() onArchiveBuild;
  final Future<void> Function() onBuildAgain;
  final VoidCallback onEditCompletionStory;

  @override
  Widget build(BuildContext context) {
    final compact = MediaQuery.sizeOf(context).width < 520;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            AppBackAction(fallbackLocation: '/learning/$projectId'),
            TextButton(
              onPressed: () => context.go(learnerBuildsRoute),
              child: Text(ProjectBuildPageL10n.myBuilds.resolve(context)),
            ),
            const Spacer(),
            _BuildLifecycleMenu(
              buildRecord: buildRecord,
              isBusy: isLifecycleActionInFlight,
              compact: compact,
              onPause: onPauseBuild,
              onResume: onResumeBuild,
              onArchive: onArchiveBuild,
              onBuildAgain: onBuildAgain,
              onEditCompletionStory: onEditCompletionStory,
            ),
          ],
        ),
        if (buildRecord.status == ProjectBuildStatus.paused) ...[
          const SizedBox(height: AppSpacing.sm),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: isLifecycleActionInFlight ? null : onResumeBuild,
              icon: const Icon(Icons.play_arrow_rounded),
              label: Text(ProjectBuildPageL10n.resumeBuild.resolve(context)),
            ),
          ),
        ],
      ],
    );
  }
}

class _BuildHeader extends StatelessWidget {
  const _BuildHeader({
    required this.projectId,
    required this.buildRecord,
    required this.openingGuide,
    required this.isLifecycleActionInFlight,
    required this.showReadinessProgress,
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
  final bool showReadinessProgress;
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
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: palette.cardSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.xs,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              AppBackAction(fallbackLocation: '/learning/$projectId'),
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
                      ContentDirectionalText(
                        buildRecord.project.title,
                        style: AppTextStyles.title(context).copyWith(
                          color: palette.textPrimary,
                          fontWeight: FontWeight.w800,
                          fontSize: 22,
                          height: 1.25,
                        ),
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
                hasExistingConversation:
                    buildRecord.guideConversationId != null,
                onOpenBuildGuide: onOpenBuildGuide,
              );
              final smartPlanAction = _SmartBuildPlanAction(
                projectId: projectId,
              );
              final notebookAction = OutlinedButton.icon(
                onPressed: () =>
                    context.push(learnerBuildNotebookRoute(buildRecord.id)),
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
                    if (buildRecord.status == ProjectBuildStatus.inProgress ||
                        buildRecord.status == ProjectBuildStatus.paused) ...[
                      const SizedBox(height: AppSpacing.sm),
                      smartPlanAction,
                    ],
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
                      Flexible(
                        child: Wrap(
                          spacing: AppSpacing.sm,
                          runSpacing: AppSpacing.sm,
                          alignment: WrapAlignment.end,
                          children: [
                            menuAction,
                            notebookAction,
                            guideAction,
                            if (buildRecord.status ==
                                    ProjectBuildStatus.inProgress ||
                                buildRecord.status == ProjectBuildStatus.paused)
                              smartPlanAction,
                          ],
                        ),
                      ),
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
          if (showReadinessProgress) ...[
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
    final label = hasExistingConversation
        ? ProjectBuildPageL10n.continueWithAi.resolve(context)
        : ProjectBuildPageL10n.askAi.resolve(context);

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

class _SmartBuildPlanAction extends StatelessWidget {
  const _SmartBuildPlanAction({required this.projectId});

  final String projectId;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      onPressed: () => context.push('/learning/$projectId/build/smart-plan'),
      icon: const Icon(Icons.auto_awesome_outlined, size: 18),
      label: Text(SmartBuildPlanL10n.openFromBuild.resolve(context)),
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
    final message = switch (buildRecord.status) {
      ProjectBuildStatus.paused => LearnerBuildsL10n.pausedNotice.resolve(
        context,
      ),
      ProjectBuildStatus.completed =>
        LearnerBuildsL10n.completedBuildDocumentNotice.resolve(context),
      _ => LearnerBuildsL10n.readOnlyNotice.resolve(context),
    };

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
    required this.onAddResultPhoto,
    required this.onRefreshBuild,
    required this.onOpenFinalCheck,
  });

  final String projectId;
  final ProjectBuild buildRecord;
  final GlobalKey<ProjectBuildCompletionStorySectionState>
  completionStorySectionKey;
  final GlobalKey learningReflectionSectionKey;
  final ScrollController completedPageScrollController;
  final GlobalKey completedPageTopKey;
  final void Function(
    void Function({bool collapseCheckReview, String? expandSection}) reset,
  )
  onRegisterCompletedPageReset;
  final bool isLifecycleActionInFlight;
  final Future<void> Function() onArchiveBuild;
  final Future<void> Function() onBuildAgain;
  final VoidCallback onEditCompletionStory;
  final VoidCallback onAddResultPhoto;
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
  bool _showHistory = false;

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
      _expandedSectionId = _expandedSectionId == sectionId ? null : sectionId;
    });
  }

  String _formatDate(BuildContext context, DateTime date) {
    return MaterialLocalizations.of(context).formatMediumDate(date.toLocal());
  }

  Future<void> _openFinalCheck() => widget.onOpenFinalCheck();

  bool _shouldShowCheckReview(LearningSessionBundle bundle) {
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
    final sessionAsync = ref.watch(
      buildLearningSessionProvider(widget.projectId),
    );
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
                  onEditCompletionStory: widget.onEditCompletionStory,
                  onAddResultPhoto: widget.onAddResultPhoto,
                  onToggleHistory: () =>
                      setState(() => _showHistory = !_showHistory),
                  showingHistory: _showHistory,
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
                onOpenStory: widget.onEditCompletionStory,
              ),
              if (_showHistory) ...[
                const SizedBox(height: AppSpacing.md),
                _CompletedBuildHistory(buildRecord: widget.buildRecord),
              ],
              const SizedBox(height: AppSpacing.md),
              _CompletedReviewSectionTile(
                title: ProjectBuildPageL10n.sectionCompletionStoryPhotos
                    .resolve(context),
                expanded: _isSectionExpanded('story', desktopDefault: false),
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
    required this.onEditCompletionStory,
    required this.onAddResultPhoto,
    required this.onToggleHistory,
    required this.showingHistory,
    required this.formatDate,
  });

  final String projectId;
  final ProjectBuild buildRecord;
  final bool isLifecycleActionInFlight;
  final Future<void> Function() onBuildAgain;
  final VoidCallback onEditCompletionStory;
  final VoidCallback onAddResultPhoto;
  final VoidCallback onToggleHistory;
  final bool showingHistory;
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
    final impact = buildRecord.impactSummary;
    final reusedCount = impact?.alreadyOwnedComponentCount ?? 0;
    final storyPhoto = buildRecord.completionStory?.photos.isNotEmpty == true
        ? buildRecord.completionStory!.photos.first.imageUrl
        : null;
    final resultImage = storyPhoto != null && storyPhoto.trim().isNotEmpty
        ? storyPhoto
        : null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            AppBackAction(fallbackLocation: '/learning/$projectId'),
            const Spacer(),
            _BuildLifecycleMenu(
              buildRecord: buildRecord,
              isBusy: isLifecycleActionInFlight,
              compact: MediaQuery.sizeOf(context).width < 520,
              onPause: () async {},
              onResume: () async {},
              onArchive: () async {},
              onBuildAgain: onBuildAgain,
              onEditCompletionStory: onEditCompletionStory,
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          '🎉',
          textAlign: TextAlign.center,
          style: AppTextStyles.title(context).copyWith(fontSize: 28),
        ),
        const SizedBox(height: AppSpacing.xs),
        ContentDirectionalText(
          ProjectBuildPageL10n.youCompletedProject(
            buildRecord.project.title,
          ).resolve(context),
          textAlign: TextAlign.center,
          style: AppTextStyles.title(
            context,
          ).copyWith(fontWeight: FontWeight.w800, fontSize: 22, height: 1.3),
        ),
        const SizedBox(height: AppSpacing.sm),
        Wrap(
          alignment: WrapAlignment.center,
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
        const SizedBox(height: AppSpacing.sm),
        Text(
          '${ProjectBuildPageL10n.stepsCompletedCount(steps.completed, steps.total).resolve(context)}\n'
          '${ProjectBuildPageL10n.materialsProvidedCount(readiness.ready, readiness.total).resolve(context)}',
          textAlign: TextAlign.center,
          style: AppTextStyles.body(
            context,
          ).copyWith(color: palette.textSecondary, height: 1.35),
        ),
        if (reusedCount > 0) ...[
          const SizedBox(height: AppSpacing.xs),
          Text(
            ProjectBuildPageL10n.reusedMaterialsCount(
              reusedCount,
            ).resolve(context),
            textAlign: TextAlign.center,
            style: AppTextStyles.body(
              context,
            ).copyWith(fontWeight: FontWeight.w700),
          ),
        ],
        if (buildRecord.completedAt != null) ...[
          const SizedBox(height: AppSpacing.xs),
          Text(
            '${ProjectBuildPageL10n.completedOn.resolve(context)} ${formatDate(context, buildRecord.completedAt!)}',
            textAlign: TextAlign.center,
            style: AppTextStyles.label(
              context,
            ).copyWith(color: palette.textSecondary),
          ),
        ],
        const SizedBox(height: AppSpacing.sm),
        Text(
          ProjectBuildPageL10n.completedHeaderBody.resolve(context),
          textAlign: TextAlign.center,
          style: AppTextStyles.body(
            context,
          ).copyWith(color: palette.textSecondary, height: 1.45, fontSize: 14),
        ),
        if (resultImage != null) ...[
          const SizedBox(height: AppSpacing.md),
          ClipRRect(
            borderRadius: AppRadius.lgAll,
            child: ProtectedMediaImage(
              url: resultImage,
              height: 180,
              width: double.infinity,
              fit: BoxFit.cover,
            ),
          ),
        ] else if (buildRecord.status == ProjectBuildStatus.completed) ...[
          const SizedBox(height: AppSpacing.sm),
          TextButton(
            onPressed: onAddResultPhoto,
            child: Text(LearnerBuildsL10n.addPhoto.resolve(context)),
          ),
        ],
        const SizedBox(height: AppSpacing.md),
        SizedBox(
          height: 48,
          child: FilledButton(
            onPressed: () => context.push(learnerPortfolioRoute),
            child: Text(
              ProjectBuildPageL10n.viewPrivatePortfolio.resolve(context),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ),
        TextButton(
          onPressed: onToggleHistory,
          child: Text(
            (showingHistory
                    ? ProjectBuildPageL10n.hideBuildJourney
                    : ProjectBuildPageL10n.viewBuildJourney)
                .resolve(context),
          ),
        ),
        SizedBox(
          height: 44,
          child: OutlinedButton(
            onPressed: onBuildAgain,
            child: Text(
              LearnerBuildsL10n.buildAgain.resolve(context),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ),
      ],
    );
  }
}

class _CompletedOverviewCards extends StatelessWidget {
  const _CompletedOverviewCards({
    required this.buildRecord,
    required this.session,
    required this.onOpenStory,
  });

  final ProjectBuild buildRecord;
  final BuildLearningSession? session;
  final VoidCallback onOpenStory;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final languageCode = Localizations.localeOf(context).languageCode;
    final story = buildRecord.completionStory;
    final reflection = (story?.reflection ?? '').trim();
    final impact = buildRecord.impactSummary;
    final understood = session?.learningSummary?.understoodConcepts ?? const [];
    final review = session?.learningSummary?.reviewConcepts ?? const [];
    final acquired = impact?.acquiredViaImpactLoopCount ?? 0;
    final reused = impact?.alreadyOwnedComponentCount ?? 0;
    final ready =
        impact?.readyMaterialComponentCount ??
        buildRecord.materialReadiness.ready;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (reused > 0 || acquired > 0 || ready > 0) ...[
          Text(
            ProjectBuildPageL10n.yourProjectImpact.resolve(context),
            style: AppTextStyles.subtitle(
              context,
            ).copyWith(fontWeight: FontWeight.w800, fontSize: 18),
          ),
          const SizedBox(height: AppSpacing.sm),
          if (reused > 0)
            Text(
              ProjectBuildPageL10n.reusedMaterialsCount(
                reused,
              ).resolve(context),
              style: AppTextStyles.body(context).copyWith(fontSize: 14),
            ),
          if (acquired > 0)
            Text(
              LearnerBuildsL10n.impactMaterialsAcquired(
                acquired,
              ).resolve(context),
              style: AppTextStyles.body(context).copyWith(fontSize: 14),
            ),
          if (ready > 0)
            Text(
              ProjectBuildPageL10n.materialsProvidedCount(
                ready,
                buildRecord.materialReadiness.total,
              ).resolve(context),
              style: AppTextStyles.body(context).copyWith(fontSize: 14),
            ),
          const SizedBox(height: AppSpacing.md),
        ],
        if (understood.isNotEmpty || review.isNotEmpty) ...[
          Text(
            ProjectBuildPageL10n.whatYouLearned.resolve(context),
            style: AppTextStyles.subtitle(
              context,
            ).copyWith(fontWeight: FontWeight.w800, fontSize: 18),
          ),
          const SizedBox(height: AppSpacing.xs),
          if (understood.isNotEmpty)
            Text(
              ProjectBuildPageL10n.masteredConceptsCount(
                understood.length,
              ).resolve(context),
              style: AppTextStyles.body(
                context,
              ).copyWith(fontWeight: FontWeight.w700, fontSize: 14),
            ),
          for (final concept in understood)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                '✓ ${concept.labelFor(languageCode)}',
                style: AppTextStyles.body(context).copyWith(fontSize: 14),
              ),
            ),
          if (review.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              ProjectBuildPageL10n.reviewConceptsCount(
                review.length,
              ).resolve(context),
              style: AppTextStyles.body(
                context,
              ).copyWith(fontWeight: FontWeight.w700, fontSize: 14),
            ),
            for (final concept in review)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(
                  '○ ${concept.labelFor(languageCode)}',
                  style: AppTextStyles.body(context).copyWith(fontSize: 14),
                ),
              ),
          ],
          const SizedBox(height: AppSpacing.md),
        ],
        Text(
          ProjectBuildPageL10n.overviewCompletionStory.resolve(context),
          style: AppTextStyles.subtitle(
            context,
          ).copyWith(fontWeight: FontWeight.w800, fontSize: 18),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          reflection.isNotEmpty
              ? reflection
              : ProjectBuildPageL10n.storyNotAdded.resolve(context),
          maxLines: 4,
          overflow: TextOverflow.ellipsis,
          style: AppTextStyles.body(
            context,
          ).copyWith(color: palette.textSecondary, height: 1.35, fontSize: 14),
        ),
        Align(
          alignment: AlignmentDirectional.centerStart,
          child: TextButton(
            onPressed: onOpenStory,
            child: Text(
              (reflection.isNotEmpty
                      ? ProjectBuildPageL10n.editStory
                      : FinalLearningCheckL10n.addCompletionStory)
                  .resolve(context),
            ),
          ),
        ),
      ],
    );
  }
}

class _CompletedBuildHistory extends StatelessWidget {
  const _CompletedBuildHistory({required this.buildRecord});

  final ProjectBuild buildRecord;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final steps = buildRecord.stepProgress.steps;
    final items = buildRecord.items;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (items.isNotEmpty) ...[
          Text(
            ProjectBuildPageL10n.materialsSummary.resolve(context),
            style: AppTextStyles.subtitle(
              context,
            ).copyWith(fontWeight: FontWeight.w800, fontSize: 18),
          ),
          const SizedBox(height: AppSpacing.xs),
          for (final item in items)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
                children: [
                  Icon(
                    item.isReadyForBuild
                        ? Icons.check_rounded
                        : Icons.remove_rounded,
                    size: 16,
                    color: palette.textSecondary,
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: ContentDirectionalText(
                      item.component.name.resolve(context),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.body(context).copyWith(fontSize: 14),
                    ),
                  ),
                ],
              ),
            ),
          const SizedBox(height: AppSpacing.md),
        ],
        if (steps.isNotEmpty) ...[
          Text(
            ProjectBuildPageL10n.completedStepsSummary.resolve(context),
            style: AppTextStyles.subtitle(
              context,
            ).copyWith(fontWeight: FontWeight.w800, fontSize: 18),
          ),
          const SizedBox(height: AppSpacing.xs),
          for (final step in steps)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
                children: [
                  BuildStepNumberBadge(number: step.stepNumber, size: 24),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: ContentDirectionalText(
                      step.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.body(context).copyWith(fontSize: 14),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ],
    );
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
                    child: Text(title, style: AppTextStyles.subtitle(context)),
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

class _LearningJourneyReviewBodyState
    extends State<_LearningJourneyReviewBody> {
  bool _reflectionExpanded = false;

  @override
  void initState() {
    super.initState();
    _reflectionExpanded =
        !widget.isMobile &&
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
            style: AppTextStyles.label(
              context,
            ).copyWith(color: palette.textSecondary),
          ),
          const SizedBox(height: AppSpacing.sm),
        ],
        if (widget.session.learningSummary != null)
          LearningSummarySection(summary: widget.session.learningSummary!),
        const SizedBox(height: AppSpacing.sm),
        OutlinedButton(
          onPressed: () =>
              setState(() => _reflectionExpanded = !_reflectionExpanded),
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
      LearningGoalOutcome.partiallyAchieved =>
        FinalLearningCheckL10n.goalPartial,
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
    final showFinalGroup = finalAssignments.isNotEmpty || finalUi.isVisible;

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
            style: AppTextStyles.body(
              context,
            ).copyWith(color: palette.textSecondary),
          ),
          if (isFinalGroup && finalCheckUi != null) ...[
            const SizedBox(height: AppSpacing.sm),
            if (finalCheckUi!.compactNotice != null)
              Text(
                finalCheckUi!.compactNotice!.resolve(context),
                style: AppTextStyles.body(
                  context,
                ).copyWith(color: palette.textSecondary, height: 1.4),
              ),
            if (finalCheckUi!.actionLabel != null &&
                onOpenFinalCheck != null) ...[
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
                child: Text(
                  ProjectBuildPageL10n.reviewAnswers.resolve(context),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  LearningCheckProgress _computeProgress(List<LearningAssignment> items) {
    final total = items.length;
    final skipped = items
        .where((a) => a.status == LearningAssignmentStatus.skipped)
        .length;
    final correct = items.where((a) => a.hasCorrectAnswer).length;
    final answered = items
        .where((a) => a.status == LearningAssignmentStatus.answered)
        .length;
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
                    style: AppTextStyles.label(
                      context,
                    ).copyWith(color: palette.textSecondary, fontSize: 12),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Directionality(
                    textDirection: TextDirection.ltr,
                    child: Text(stepTitle, style: AppTextStyles.label(context)),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    ProjectBuildPageL10n.whyThisStepMatters.resolve(context),
                    style: AppTextStyles.label(
                      context,
                    ).copyWith(fontSize: 12, color: palette.textSecondary),
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
                  style: AppTextStyles.label(
                    context,
                  ).copyWith(color: palette.textSecondary),
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
            style: AppTextStyles.label(
              context,
            ).copyWith(color: palette.textSecondary),
          ),
          const SizedBox(height: AppSpacing.sm),
        ],
        if (assignment.attemptCount > 0)
          Text(
            '${ProjectBuildPageL10n.attemptCountLabel.resolve(context)}: ${assignment.attemptCount}',
            style: AppTextStyles.label(
              context,
            ).copyWith(color: palette.textSecondary),
          ),
      ],
    );
  }
}

enum _ProjectCompletionCloseAction { review, addPhoto, portfolio }
