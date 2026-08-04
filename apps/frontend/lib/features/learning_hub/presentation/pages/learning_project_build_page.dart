import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/errors/api_exception.dart';
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
import '../theme/learning_ui_palette.dart';
import '../l10n/learning_project_build_l10n.dart';
import '../widgets/project_build_acquisition_state.dart';
import '../widgets/project_build_item_display.dart';
import '../widgets/project_build_material_linking.dart';

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
  bool _openingGuide = false;
  bool _redirectedNarrowGuide = false;
  String? _activeGuideConversationId;
  Future<void>? _guideRestoreRequest;
  final Set<String> _updatingItemIds = <String>{};
  final Set<String> _completingStepIds = <String>{};
  bool _routeSuspended = false;
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

    setState(() => _completingStepIds.add(currentStep.stepId));
    try {
      await ref.read(learningHubRepositoryProvider).completeBuildStep(
            widget.projectId,
            currentStep.stepId,
          );
      _refreshBuild();
    } catch (error) {
      if (mounted) {
        showErrorSnackBar(context, error);
      }
    } finally {
      if (mounted) {
        setState(() => _completingStepIds.remove(currentStep.stepId));
      }
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
      updatingItemIds: _updatingItemIds,
      completingStepIds: _completingStepIds,
      openingGuide: _openingGuide,
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
    required this.updatingItemIds,
    required this.completingStepIds,
    required this.openingGuide,
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
  });

  final String projectId;
  final ProjectBuild buildRecord;
  final Set<String> updatingItemIds;
  final Set<String> completingStepIds;
  final bool openingGuide;
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

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1120),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _BuildHeader(
                buildRecord: buildRecord,
                openingGuide: openingGuide,
                onOpenBuildGuide: onOpenBuildGuide,
              ),
              const SizedBox(height: AppSpacing.lg),
              _MaterialsSection(
                buildRecord: buildRecord,
                updatingItemIds: updatingItemIds,
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
                buildRecord: buildRecord,
                completingStepIds: completingStepIds,
                onCompleteCurrentStep: onCompleteCurrentStep,
              ),
              if (buildRecord.status == ProjectBuildStatus.completed ||
                  buildRecord.stepProgress.nextAction ==
                      ProjectBuildNextAction.buildCompleted) ...[
                const SizedBox(height: AppSpacing.lg),
                _BuildCompletionNotice(buildRecord: buildRecord),
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
    required this.buildRecord,
    required this.openingGuide,
    required this.onOpenBuildGuide,
  });

  final ProjectBuild buildRecord;
  final bool openingGuide;
  final VoidCallback onOpenBuildGuide;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final progress = buildRecord.progress.percent.clamp(0, 100) / 100;

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
          LayoutBuilder(
            builder: (context, constraints) {
              final stackGuideAction = constraints.maxWidth < 520;
              final titleBlock = Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    buildRecord.project.title,
                    style: AppTextStyles.display(
                      context,
                    ).copyWith(color: palette.textPrimary),
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
                ],
              );
              final guideAction = _BuildGuideCompactAction(
                openingGuide: openingGuide,
                hasExistingConversation: buildRecord.guideConversationId != null,
                onOpenBuildGuide: onOpenBuildGuide,
              );

              if (stackGuideAction) {
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    titleBlock,
                    const SizedBox(height: AppSpacing.sm),
                    guideAction,
                  ],
                );
              }

              return Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(child: titleBlock),
                  const SizedBox(width: AppSpacing.md),
                  guideAction,
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
            '${buildRecord.progress.ready}/${buildRecord.progress.total} ready for build',
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

class _BuildStepsSection extends StatelessWidget {
  const _BuildStepsSection({
    required this.buildRecord,
    required this.completingStepIds,
    required this.onCompleteCurrentStep,
  });

  final ProjectBuild buildRecord;
  final Set<String> completingStepIds;
  final VoidCallback onCompleteCurrentStep;

  @override
  Widget build(BuildContext context) {
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
                  step.state == ProjectBuildStepState.current && !isCompleting;

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
          if (showClassificationControls) ...[
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
