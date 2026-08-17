import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/navigation_extensions.dart';
import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/widgets/entry_nav_bar.dart';
import '../../../../shared/utils/content_text_direction.dart';
import '../../../../shared/widgets/app_dropdown_field.dart';
import '../../../../shared/widgets/app_empty_state_card.dart';
import '../../../../shared/widgets/app_feedback.dart';
import '../../../../shared/widgets/app_primary_button.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/app_back_action.dart';
import '../../../../shared/widgets/app_text_area.dart';
import '../../../../shared/widgets/app_text_field.dart';
import '../../../../shared/widgets/learning_project_status_presentation.dart';
import '../../../profile/application/profile_providers.dart';
import '../../../profile/presentation/widgets/profile_image_picker.dart';
import '../../../materials/data/models/category.dart';
import '../../../../core/config/api_config.dart';
import '../../../../core/errors/api_exception.dart';
import '../../application/learning_hub_providers.dart';
import '../../../ai/domain/authoring_session_models.dart';
import '../../../ai/application/authoring_workspace_controller.dart';
import '../../../ai/application/ai_chat_controller.dart';
import '../../../ai/domain/ai_models.dart';
import '../../domain/models/learning_project_draft_component.dart';
import '../../domain/models/learning_project_step_text.dart';
import '../../../project_help_sessions/application/project_help_sessions_providers.dart';
import '../../../project_help_sessions/presentation/l10n/project_help_sessions_l10n.dart';
import '../../../project_help_sessions/presentation/widgets/submission_help_session_settings_entry.dart';
import '../../domain/models/learning_project_submission.dart';
import '../models/authoring_workspace_state.dart';
import '../theme/learning_ui_palette.dart';
import '../widgets/learning_project_component_editor.dart';

const _continueWithAiLabel = LocalizedText(
  en: 'Continue with AI',
  ar: 'متابعة بالذكاء الاصطناعي',
);

const _missingProjectImageMessage =
    'Add at least one project image before submitting for review.';

String _newSubmitIdempotencyKey() =>
    'learning-draft-submit-${DateTime.now().microsecondsSinceEpoch}';

String _submissionDetailsPath(String submissionId, {bool focusImages = false}) {
  if (!focusImages) {
    return '/learning/submissions/$submissionId';
  }
  return '/learning/submissions/$submissionId?focusImages=1';
}

Future<void> _focusImagesSection(GlobalKey imagesSectionKey) async {
  final contextForScroll = imagesSectionKey.currentContext;
  if (contextForScroll == null) {
    return;
  }

  await Scrollable.ensureVisible(
    contextForScroll,
    duration: const Duration(milliseconds: 250),
    curve: Curves.easeInOut,
    alignment: 0.1,
  );
}

void _showSubmissionIncompleteFeedback(
  BuildContext context,
  ApiException error, {
  GlobalKey? imagesSectionKey,
  VoidCallback? onEdit,
  bool navigateToImages = false,
  required String submissionId,
}) {
  final requiresImage = projectSubmissionIncompleteRequiresImage(error);
  final message = formatProjectSubmissionIncompleteMessage(error);
  final hasMultipleIssues = error.fieldIssues.length > 1;

  if (hasMultipleIssues) {
    showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Project is not ready to submit'),
        content: SingleChildScrollView(child: Text(message)),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: const Text('Close'),
          ),
          if (onEdit != null)
            FilledButton(
              onPressed: () {
                Navigator.of(dialogContext).pop();
                onEdit();
              },
              child: const Text('Edit draft'),
            ),
        ],
      ),
    );
  } else {
    showInfoSnackBar(context, message);
  }

  if (requiresImage) {
    if (navigateToImages) {
      context.push(_submissionDetailsPath(submissionId, focusImages: true));
      return;
    }
    if (imagesSectionKey != null) {
      unawaited(_focusImagesSection(imagesSectionKey));
    }
  }
}

class LearningProjectSubmissionsPage extends ConsumerStatefulWidget {
  const LearningProjectSubmissionsPage({super.key});

  @override
  ConsumerState<LearningProjectSubmissionsPage> createState() =>
      _LearningProjectSubmissionsPageState();
}

class _LearningProjectSubmissionsPageState
    extends ConsumerState<LearningProjectSubmissionsPage> {
  int _page = 1;
  LearningProjectSubmissionStatus? _status;

  LearningProjectSubmissionsQuery get _query =>
      LearningProjectSubmissionsQuery(page: _page, limit: 12, status: _status);

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final submissionsAsync = ref.watch(
      myLearningProjectSubmissionsProvider(_query),
    );
    final showHelpRequestsEntry = ref
        .watch(hasAuthoredProjectSubmissionsProvider)
        .maybeWhen(data: (value) => value, orElse: () => false);

    return Scaffold(
      backgroundColor: palette.pageBackground,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const EntryNavBar(homeRoute: '/home'),
            Expanded(
              child: submissionsAsync.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (error, stackTrace) => _StatePanel(
                  icon: Icons.cloud_off_outlined,
                  title: 'Unable to load submissions',
                  subtitle:
                      'Check that the backend is running, then try again.',
                  actionLabel: 'Try again',
                  onAction: () => ref.invalidate(
                    myLearningProjectSubmissionsProvider(_query),
                  ),
                ),
                data: (result) => _SubmissionsContent(
                  result: result,
                  selectedStatus: _status,
                  showHelpRequestsEntry: showHelpRequestsEntry,
                  onStatusChanged: (status) {
                    setState(() {
                      _status = status;
                      _page = 1;
                    });
                  },
                  onPageChanged: (page) => setState(() => _page = page),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SubmissionsContent extends StatelessWidget {
  const _SubmissionsContent({
    required this.result,
    required this.selectedStatus,
    required this.showHelpRequestsEntry,
    required this.onStatusChanged,
    required this.onPageChanged,
  });

  final LearningProjectSubmissionsResult result;
  final LearningProjectSubmissionStatus? selectedStatus;
  final bool showHelpRequestsEntry;
  final ValueChanged<LearningProjectSubmissionStatus?> onStatusChanged;
  final ValueChanged<int> onPageChanged;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);

    return SingleChildScrollView(
      padding: const EdgeInsetsDirectional.fromSTEB(
        AppSpacing.md,
        AppSpacing.lg,
        AppSpacing.md,
        AppSpacing.xl,
      ),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1180),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Wrap(
                spacing: AppSpacing.md,
                runSpacing: AppSpacing.md,
                alignment: WrapAlignment.spaceBetween,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'My project submissions',
                        style: AppTextStyles.display(
                          context,
                        ).copyWith(color: palette.textPrimary),
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        'Track review status, read admin feedback, and resubmit requested changes.',
                        style: AppTextStyles.body(
                          context,
                        ).copyWith(color: palette.textSecondary),
                      ),
                    ],
                  ),
                  OutlinedButton.icon(
                    onPressed: () => context.go('/learning/create-project'),
                    style: AppStatusButtonStyle.filled(
                      context,
                      AppStatusTone.primary,
                    ),
                    icon: const Icon(Icons.add_rounded),
                    label: const Text('Submit new project'),
                  ),
                  if (showHelpRequestsEntry)
                    OutlinedButton.icon(
                      onPressed: () => context.push(creatorHelpSessionsRoute),
                      icon: const Icon(Icons.support_agent_outlined),
                      label: Text(
                        ProjectHelpSessionsL10n.submissionsHelpRequestsAction
                            .resolve(context),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: AppSpacing.lg),
              _StatusFilters(
                selectedStatus: selectedStatus,
                onChanged: onStatusChanged,
              ),
              const SizedBox(height: AppSpacing.lg),
              if (result.items.isEmpty)
                _StatePanel(
                  icon: Icons.assignment_outlined,
                  title: 'No submissions yet',
                  subtitle:
                      'Submitted project drafts and admin feedback will appear here.',
                  actionLabel: 'Create a project draft',
                  onAction: () => context.go('/learning/create-project'),
                )
              else
                LayoutBuilder(
                  builder: (context, constraints) {
                    final wide = constraints.maxWidth >= 820;
                    return Wrap(
                      spacing: AppSpacing.md,
                      runSpacing: AppSpacing.md,
                      children: result.items
                          .map(
                            (submission) => SizedBox(
                              width: wide
                                  ? (constraints.maxWidth - AppSpacing.md) / 2
                                  : constraints.maxWidth,
                              child: _SubmissionCard(submission: submission),
                            ),
                          )
                          .toList(growable: false),
                    );
                  },
                ),
              if (result.totalPages > 1) ...[
                const SizedBox(height: AppSpacing.lg),
                _SubmissionsPager(result: result, onPageChanged: onPageChanged),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class LearningProjectSubmissionDetailPage extends ConsumerWidget {
  const LearningProjectSubmissionDetailPage({
    super.key,
    required this.submissionId,
  });

  final String submissionId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = LearningUiPalette.of(context);
    final focusImages =
        GoRouterState.of(context).uri.queryParameters['focusImages'] == '1';
    final submissionAsync = ref.watch(
      myLearningProjectSubmissionProvider(submissionId),
    );

    return Scaffold(
      backgroundColor: palette.pageBackground,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const EntryNavBar(homeRoute: '/home'),
            Expanded(
              child: submissionAsync.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (error, stackTrace) => _StatePanel(
                  icon: Icons.search_off_outlined,
                  title: 'Submission not found',
                  subtitle:
                      'This submission may not exist or may belong to another learner.',
                  actionLabel: 'Back to submissions',
                  actionTone: AppStatusTone.neutral,
                  actionProminent: false,
                  onAction: () => context.go('/learning/submissions'),
                ),
                data: (submission) => _SubmissionDetailContent(
                  submission: submission,
                  focusImagesOnLoad: focusImages,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SubmissionDetailContent extends ConsumerStatefulWidget {
  const _SubmissionDetailContent({
    required this.submission,
    this.focusImagesOnLoad = false,
  });

  final LearningProjectSubmission submission;
  final bool focusImagesOnLoad;

  @override
  ConsumerState<_SubmissionDetailContent> createState() =>
      _SubmissionDetailContentState();
}

class _SubmissionDetailContentState
    extends ConsumerState<_SubmissionDetailContent> {
  final _imagesSectionKey = GlobalKey();
  bool _isSubmitting = false;
  bool _isUploadingImage = false;
  String _submitIdempotencyKey = _newSubmitIdempotencyKey();

  LearningProjectSubmission get submission => widget.submission;

  bool get _hasPersistedImage =>
      submission.coverImageUrl?.trim().isNotEmpty == true;

  bool get _canSubmitDraft =>
      submission.status == LearningProjectSubmissionStatus.draft;

  @override
  void initState() {
    super.initState();
    if (widget.focusImagesOnLoad) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        unawaited(_focusImagesSection(_imagesSectionKey));
      });
    }
  }

  @override
  void didUpdateWidget(covariant _SubmissionDetailContent oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.focusImagesOnLoad && !oldWidget.focusImagesOnLoad) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        unawaited(_focusImagesSection(_imagesSectionKey));
      });
    }
  }

  Future<void> _uploadProjectImage() async {
    if (_isUploadingImage) {
      return;
    }

    try {
      final picked = await pickProfileImageFile();
      if (picked == null || !mounted) {
        return;
      }

      setState(() => _isUploadingImage = true);
      // Stores the file only; learner profile is not updated until PATCH /api/profile.
      final uploaded = await ref
          .read(profileRepositoryProvider)
          .uploadProfileImage(picked);
      final imageUrl = uploaded.url.trim();
      if (imageUrl.isEmpty) {
        throw const FormatException('Uploaded image URL was empty.');
      }

      final repository = ref.read(learningHubRepositoryProvider);
      final updated = await repository.updateMyLearningProjectSubmission(
        submission.id,
        {'coverImageUrl': imageUrl},
      );

      if (!mounted) {
        return;
      }

      ref.invalidate(myLearningProjectSubmissionProvider(submission.id));
      ref.invalidate(myLearningProjectSubmissionsProvider);
      showInfoSnackBar(context, 'Project image saved.');
      setState(() {
        _isUploadingImage = false;
        _submitIdempotencyKey = _newSubmitIdempotencyKey();
      });
      if (updated.coverImageUrl?.trim().isNotEmpty == true) {
        return;
      }
    } catch (error) {
      if (mounted) {
        showErrorSnackBar(context, error);
        setState(() => _isUploadingImage = false);
      }
    }
  }

  Future<void> _openProjectImagePicker() => _uploadProjectImage();

  Future<void> _submitForReview() async {
    if (_isSubmitting || !_canSubmitDraft) {
      return;
    }

    if (!_hasPersistedImage) {
      showInfoSnackBar(context, _missingProjectImageMessage);
      await _focusImagesSection(_imagesSectionKey);
      return;
    }

    setState(() => _isSubmitting = true);
    try {
      final repository = ref.read(learningHubRepositoryProvider);
      final updated = await repository.submitMyLearningProjectDraft(
        submission.id,
        idempotencyKey: _submitIdempotencyKey,
      );

      if (!mounted) {
        return;
      }

      ref.invalidate(myLearningProjectSubmissionProvider(submission.id));
      ref.invalidate(myLearningProjectSubmissionsProvider);
      showInfoSnackBar(context, 'Project submitted for review.');
      setState(() {
        _isSubmitting = false;
        _submitIdempotencyKey = _newSubmitIdempotencyKey();
      });
      if (updated.status != LearningProjectSubmissionStatus.pendingReview) {
        return;
      }
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }
      _showSubmissionIncompleteFeedback(
        context,
        error,
        imagesSectionKey: _imagesSectionKey,
        submissionId: submission.id,
        onEdit: () =>
            context.push('/learning/submissions/${submission.id}/edit'),
      );
      setState(() {
        _isSubmitting = false;
        _submitIdempotencyKey = _newSubmitIdempotencyKey();
      });
    } catch (error) {
      if (mounted) {
        showErrorSnackBar(context, error);
        setState(() {
          _isSubmitting = false;
          _submitIdempotencyKey = _newSubmitIdempotencyKey();
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);

    return SingleChildScrollView(
      padding: const EdgeInsetsDirectional.fromSTEB(
        AppSpacing.md,
        AppSpacing.lg,
        AppSpacing.md,
        AppSpacing.xl,
      ),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1020),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Align(
                alignment: AlignmentDirectional.centerStart,
                child: const AppBackAction(
                  fallbackLocation: '/learning/submissions',
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              Container(
                padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
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
                      runSpacing: AppSpacing.sm,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        _StatusChip(status: submission.status),
                        Text(
                          submission.category.resolve(context),
                          style: AppTextStyles.badgeLabel(
                            context,
                          ).copyWith(color: palette.textSecondary),
                        ),
                        Text(
                          _formatDateLabel(
                            submission.statusDate,
                            submission.statusDatePrefix,
                          ),
                          style: AppTextStyles.badgeLabel(
                            context,
                          ).copyWith(color: palette.textSecondary),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.md),
                    Text(
                      submission.title,
                      style: AppTextStyles.display(
                        context,
                      ).copyWith(color: palette.textPrimary),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      submission.shortDescription,
                      style: AppTextStyles.body(
                        context,
                      ).copyWith(color: palette.textSecondary),
                    ),
                    if (submission.description?.trim().isNotEmpty == true) ...[
                      const SizedBox(height: AppSpacing.md),
                      Text(
                        submission.description!,
                        style: AppTextStyles.body(
                          context,
                        ).copyWith(color: palette.textPrimary),
                      ),
                    ],
                    if (submission.activeFeedback != null) ...[
                      const SizedBox(height: AppSpacing.lg),
                      _FeedbackPanel(submission: submission),
                    ],
                    if (submission.status ==
                        LearningProjectSubmissionStatus.pendingReview) ...[
                      const SizedBox(height: AppSpacing.lg),
                      _ReviewStateBanner(
                        title: 'Pending admin review',
                        message:
                            'Your project was submitted for moderation. It will not become public until an admin approves it.',
                        tone: AppStatusTone.warning,
                      ),
                    ],
                    const SizedBox(height: AppSpacing.lg),
                    _SubmissionActions(submission: submission),
                    SubmissionHelpSessionSettingsEntry(submission: submission),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              _ProjectImagesSection(
                key: _imagesSectionKey,
                coverImageUrl: submission.coverImageUrl,
                canManageImages:
                    _canSubmitDraft ||
                    submission.status ==
                        LearningProjectSubmissionStatus.changesRequested,
                isUploading: _isUploadingImage,
                onAddImage: _uploadProjectImage,
              ),
              if (_canSubmitDraft) ...[
                const SizedBox(height: AppSpacing.md),
                if (!_hasPersistedImage)
                  _ReviewStateBanner(
                    title: 'Project image required',
                    message: _missingProjectImageMessage,
                    tone: AppStatusTone.warning,
                    actionLabel: 'Add project image',
                    onAction: _openProjectImagePicker,
                  ),
                const SizedBox(height: AppSpacing.md),
                Container(
                  padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
                  decoration: BoxDecoration(
                    color: palette.cardSurface,
                    borderRadius: AppRadius.lgAll,
                    border: Border.all(color: palette.borderSubtle),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Submit for review',
                        style: AppTextStyles.title(
                          context,
                        ).copyWith(color: palette.textPrimary),
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        'Send this draft to admin moderation. It will not be published until approved. You may receive requested changes or rejection.',
                        style: AppTextStyles.body(
                          context,
                        ).copyWith(color: palette.textSecondary),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      AppPrimaryButton(
                        label: 'Submit for review',
                        isLoading: _isSubmitting,
                        onPressed: _isSubmitting ? null : _submitForReview,
                      ),
                    ],
                  ),
                ),
              ],
              _SummarySection(
                title: 'Components',
                emptyLabel: 'No components submitted.',
                children: submission.requiredComponents
                    .map(
                      (component) => _SummaryRow(
                        title: component.name,
                        subtitle:
                            '${component.quantity.g} ${component.unit} · ${component.role.labelEn()}',
                      ),
                    )
                    .toList(growable: false),
              ),
              const SizedBox(height: AppSpacing.md),
              _SummarySection(
                title: 'Steps',
                emptyLabel: 'No steps submitted.',
                children: submission.steps
                    .map(
                      (step) => _SummaryRow(
                        title: step.title,
                        subtitle: step.description,
                      ),
                    )
                    .toList(growable: false),
              ),
              const SizedBox(height: AppSpacing.md),
              _SummarySection(
                title: 'Links',
                emptyLabel: 'No links submitted.',
                children: submission.links
                    .map(
                      (link) => _SummaryRow(
                        title: link.title ?? link.url,
                        subtitle: link.url,
                      ),
                    )
                    .toList(growable: false),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class LearningProjectSubmissionEditPage extends ConsumerStatefulWidget {
  const LearningProjectSubmissionEditPage({
    super.key,
    required this.submissionId,
    this.embeddedInAuthoringWorkspace = false,
    this.saveStateNotifier,
  });

  final String submissionId;
  final bool embeddedInAuthoringWorkspace;
  final ValueNotifier<AuthoringWorkspaceSaveState>? saveStateNotifier;

  @override
  ConsumerState<LearningProjectSubmissionEditPage> createState() =>
      _LearningProjectSubmissionEditPageState();
}

class _LearningProjectSubmissionEditPageState
    extends ConsumerState<LearningProjectSubmissionEditPage> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _summaryController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _durationController = TextEditingController();
  final _stepsController = TextEditingController();
  final _linksController = TextEditingController();

  String? _loadedId;
  String? _loadedUpdatedAt;
  String? _pendingLoadId;
  String? _pendingLoadUpdatedAt;
  String? _selectedCategoryId;
  String _selectedDifficulty = 'INTERMEDIATE';
  bool _isSaving = false;
  String? _componentValidationMessage;
  List<LearningProjectDraftComponent> _components = [
    LearningProjectDraftComponent.empty(),
  ];
  List<String?> _componentIds = [null];
  bool _dirty = false;
  bool _suppressDirtyTracking = false;
  Set<String> _highlightedFields = const {};

  @override
  void initState() {
    super.initState();
    if (widget.embeddedInAuthoringWorkspace) {
      widget.saveStateNotifier?.value = AuthoringWorkspaceSaveState.unsaved;
    }
    for (final controller in [
      _titleController,
      _summaryController,
      _descriptionController,
      _durationController,
      _stepsController,
      _linksController,
    ]) {
      controller.addListener(_markDirty);
    }
  }

  void _markDirty() {
    if (_suppressDirtyTracking || !widget.embeddedInAuthoringWorkspace) {
      return;
    }
    if (!_dirty) {
      _dirty = true;
      widget.saveStateNotifier?.value = AuthoringWorkspaceSaveState.unsaved;
    }
  }

  void _setSaveState(AuthoringWorkspaceSaveState state) {
    widget.saveStateNotifier?.value = state;
  }

  @override
  void dispose() {
    _titleController.dispose();
    _summaryController.dispose();
    _descriptionController.dispose();
    _durationController.dispose();
    _stepsController.dispose();
    _linksController.dispose();
    super.dispose();
  }

  void _applyAuthoringDraftSnapshot(ScopedAuthoringCanonicalUpdate update) {
    if (widget.embeddedInAuthoringWorkspace &&
        update.projectId != widget.submissionId) {
      return;
    }

    final snapshot = maskAuthoringDraftPlaceholders(update.snapshot);
    setState(() {
      _suppressDirtyTracking = true;
      _titleController.text = snapshot.title;
      _summaryController.text = snapshot.shortDescription;
      _descriptionController.text = snapshot.description;
      _durationController.text = snapshot.estimatedMinutes?.toString() ?? '';
      if (isValidAuthoringDifficulty(snapshot.difficulty)) {
        _selectedDifficulty = snapshot.difficulty.trim().toUpperCase();
      }
      _components = snapshot.components.isEmpty
          ? [LearningProjectDraftComponent.empty()]
          : snapshot.components
                .map(_draftComponentFromProposal)
                .toList(growable: false);
      _componentIds = snapshot.components.isEmpty
          ? [null]
          : snapshot.components.map((component) => component.id).toList();
      _stepsController.text = LearningProjectStepText.formatStepsForEditing(
        snapshot.steps.map(
          (step) => (title: step.title, description: step.description),
        ),
      );
      _dirty = false;
      _suppressDirtyTracking = false;
    });
    final mirror = ScopedAuthoringEditorMirror(
      projectId: update.projectId,
      canonicalUpdatedAt: update.canonicalUpdatedAt,
      snapshot: _mirrorSnapshotFromEditor(snapshot),
    );
    ref.read(authoringEditorAppliedSnapshotProvider.notifier).setMirror(mirror);
    ref
        .read(aiAssistantControllerProvider.notifier)
        .acknowledgeEditorSynchronized(mirror);
    ref
        .read(authoringWorkspaceControllerProvider.notifier)
        .acknowledgeEditorSynchronized(mirror);
    if (widget.embeddedInAuthoringWorkspace) {
      final authoringStage = ref
          .read(authoringWorkspaceControllerProvider)
          .snapshot
          ?.session
          .stage;
      if (authoringStage != null && authoringStage != 'OVERVIEW') {
        _setSaveState(AuthoringWorkspaceSaveState.saved);
      } else {
        _setSaveState(AuthoringWorkspaceSaveState.unsaved);
      }
    }
  }

  LearningProjectDraftComponent _draftComponentFromProposal(
    AiAuthoringProposalComponent component,
  ) {
    return LearningProjectDraftComponent(
      name: component.componentName,
      quantity: component.quantity,
      unit: component.unit,
      role: LearningProjectComponentRole.fromApiValue(component.componentRole),
      materialTypeHint: component.materialType,
      keywords: component.searchKeywords,
      canBeSubstituted: component.canBeSubstituted,
      notes: component.notes ?? '',
    );
  }

  AuthoringDraftSnapshot _mirrorSnapshotFromEditor(
    AuthoringDraftSnapshot source,
  ) {
    final parsedSteps = LearningProjectStepText.parseStepsFromText(
      _stepsController.text,
    );
    return AuthoringDraftSnapshot(
      title: _titleController.text,
      shortDescription: _summaryController.text,
      description: _descriptionController.text,
      difficulty: _selectedDifficulty,
      estimatedMinutes:
          int.tryParse(_durationController.text.trim()) ??
          source.estimatedMinutes,
      components: [
        for (var index = 0; index < _components.length; index += 1)
          if (_components[index].name.trim().isNotEmpty)
            AiAuthoringProposalComponent(
              id: index < _componentIds.length
                  ? _componentIds[index]
                  : index < source.components.length
                  ? source.components[index].id
                  : null,
              componentName: _components[index].name.trim(),
              materialType: _components[index].materialTypeHint,
              quantity: _components[index].quantity,
              unit: _components[index].unit,
              componentRole: _components[index].role.apiValue,
              isRequired:
                  _components[index].role ==
                  LearningProjectComponentRole.material,
              canBeSubstituted: _components[index].canBeSubstituted,
              searchKeywords: _components[index].keywords,
              notes: _components[index].notes.trim().isEmpty
                  ? null
                  : _components[index].notes.trim(),
            ),
      ],
      steps: parsedSteps
          .map(
            (step) => AiAuthoringProposalStep(
              title: '${step['title'] ?? ''}',
              description: '${step['description'] ?? ''}',
            ),
          )
          .toList(growable: false),
    );
  }

  /// Schedules a submission load outside the build phase.
  ///
  /// `build()` must stay side-effect free: [_loadSubmission] mutates controllers
  /// and the save-state [ValueNotifier], which throws
  /// `setState()/markNeedsBuild() called during build` when invoked synchronously
  /// from `AsyncValue.when(data: ...)`. We instead run it once per (id, stamp)
  /// change in a guarded post-frame callback so the first valid start response
  /// renders without a manual Refresh.
  void _scheduleSubmissionLoad(
    LearningProjectSubmission submission, {
    bool force = false,
  }) {
    if (widget.embeddedInAuthoringWorkspace) {
      final workspaceLifecycle = ref
          .read(authoringWorkspaceControllerProvider)
          .lifecycle;
      if (!force &&
          (workspaceLifecycle == AuthoringWorkspaceLifecycle.activating ||
              workspaceLifecycle == AuthoringWorkspaceLifecycle.loading)) {
        return;
      }
    }
    final remoteStamp = submission.updatedAt?.toUtc().toIso8601String();
    if (!force &&
        _loadedId == submission.id &&
        _loadedUpdatedAt == remoteStamp) {
      return;
    }
    if (!force &&
        _pendingLoadId == submission.id &&
        _pendingLoadUpdatedAt == remoteStamp) {
      return;
    }
    _pendingLoadId = submission.id;
    _pendingLoadUpdatedAt = remoteStamp;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) {
        return;
      }
      if (_pendingLoadId != submission.id ||
          _pendingLoadUpdatedAt != remoteStamp) {
        return;
      }
      setState(() => _loadSubmission(submission, force: force));
    });
  }

  void _loadSubmission(
    LearningProjectSubmission submission, {
    bool force = false,
  }) {
    final remoteStamp = submission.updatedAt?.toUtc().toIso8601String();
    if (!force &&
        _loadedId == submission.id &&
        _loadedUpdatedAt == remoteStamp) {
      return;
    }
    if (!force &&
        _dirty &&
        widget.embeddedInAuthoringWorkspace &&
        _loadedId == submission.id) {
      return;
    }

    _suppressDirtyTracking = true;
    _loadedId = submission.id;
    _loadedUpdatedAt = remoteStamp;
    _titleController.text = maskAuthoringDraftFieldTitle(submission.title);
    _summaryController.text = maskAuthoringDraftFieldShortDescription(
      submission.shortDescription,
    );
    _descriptionController.text = maskAuthoringDraftFieldDescription(
      submission.description ?? '',
    );
    _durationController.text =
        submission.estimatedDurationMinutes?.toString() ?? '';
    _selectedCategoryId = null;
    _selectedDifficulty = isValidAuthoringDifficulty(submission.difficulty)
        ? submission.difficulty.trim().toUpperCase()
        : 'INTERMEDIATE';
    _components = submission.requiredComponents.isEmpty
        ? [LearningProjectDraftComponent.empty()]
        : submission.requiredComponents
              .map((component) => component.toDraftComponent())
              .toList(growable: false);
    _componentIds = submission.requiredComponents.isEmpty
        ? [null]
        : submission.requiredComponents
              .map((component) => component.id)
              .toList();
    _stepsController.text = LearningProjectStepText.formatStepsForEditing(
      submission.steps.map(
        (step) => (title: step.title, description: step.description),
      ),
    );
    _linksController.text = submission.links.map((link) => link.url).join('\n');
    _dirty = false;
    _suppressDirtyTracking = false;
    if (widget.embeddedInAuthoringWorkspace) {
      final authoringStage = ref
          .read(authoringWorkspaceControllerProvider)
          .snapshot
          ?.session
          .stage;
      if (authoringStage != null && authoringStage != 'OVERVIEW') {
        _setSaveState(AuthoringWorkspaceSaveState.saved);
      } else {
        _setSaveState(AuthoringWorkspaceSaveState.unsaved);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final submissionAsync = ref.watch(
      myLearningProjectSubmissionProvider(widget.submissionId),
    );
    final projectCategoriesAsync = ref.watch(projectCategoriesProvider);
    final materialCategoriesAsync = ref.watch(materialCategoriesProvider);

    ref.listen<ScopedAuthoringCanonicalUpdate?>(
      authoringCanonicalProjectUpdateProvider,
      (previous, next) {
        if (next == null) {
          return;
        }
        _applyAuthoringDraftSnapshot(next);
      },
    );

    ref.listen<Set<String>>(authoringHighlightedFieldsProvider, (
      previous,
      next,
    ) {
      if (next.isEmpty) {
        return;
      }
      setState(() => _highlightedFields = next);
      Future<void>.delayed(const Duration(seconds: 2), () {
        if (!mounted) {
          return;
        }
        setState(() => _highlightedFields = const {});
        ref.read(authoringHighlightedFieldsProvider.notifier).clear();
      });
    });

    ref.listen<int>(authoringCanonicalApplyNonceProvider, (previous, next) {
      if (widget.embeddedInAuthoringWorkspace) {
        return;
      }
      if (next > (previous ?? 0)) {
        final submission = submissionAsync.asData?.value;
        if (submission != null) {
          _scheduleSubmissionLoad(submission, force: true);
        }
      }
    });

    final body = submissionAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, stackTrace) => _StatePanel(
        icon: Icons.search_off_outlined,
        title: 'Submission not found',
        subtitle:
            'This submission may not exist or may belong to another learner.',
        actionLabel: 'Back to submissions',
        actionTone: AppStatusTone.neutral,
        actionProminent: false,
        onAction: () => context.go('/learning/submissions'),
      ),
      data: (submission) {
        _scheduleSubmissionLoad(submission);
        if (!submission.availableActions.canEdit) {
          return _StatePanel(
            icon: Icons.lock_outline_rounded,
            title: 'This submission cannot be edited',
            subtitle:
                'Only drafts, pending review, and projects with requested changes can be edited.',
            actionLabel: 'View submission',
            actionTone: AppStatusTone.neutral,
            actionProminent: false,
            onAction: () =>
                context.go('/learning/submissions/${submission.id}'),
          );
        }

        final projectCategories =
            projectCategoriesAsync.value ?? const <MaterialCategory>[];
        final materialCategories = materialSelectableCategories(
          materialCategoriesAsync.value ?? const <MaterialCategory>[],
        );
        _selectedCategoryId ??= submission.category.resolve(context);

        return _EditContent(
          formKey: _formKey,
          submission: submission,
          embeddedInAuthoringWorkspace: widget.embeddedInAuthoringWorkspace,
          highlightedFields: _highlightedFields,
          titleController: _titleController,
          summaryController: _summaryController,
          descriptionController: _descriptionController,
          durationController: _durationController,
          stepsController: _stepsController,
          linksController: _linksController,
          projectCategories: projectCategories,
          materialCategories: materialCategories,
          selectedCategoryId: _resolveSelectedCategoryId(
            projectCategories,
            submission,
          ),
          selectedDifficulty: _selectedDifficulty,
          components: _components,
          componentValidationMessage: _componentValidationMessage,
          isSaving: _isSaving,
          onCategoryChanged: (value) =>
              setState(() => _selectedCategoryId = value),
          onDifficultyChanged: (value) {
            setState(() => _selectedDifficulty = value);
          },
          onComponentsChanged: (components) =>
              setState(() => _components = components),
          onAddComponent: () {
            setState(() {
              _components = [
                ..._components,
                LearningProjectDraftComponent.empty(),
              ];
              _componentIds = [..._componentIds, null];
            });
          },
          onRemoveComponent: (index) {
            setState(() {
              _components = [
                for (var i = 0; i < _components.length; i++)
                  if (i != index) _components[i],
              ];
              _componentIds = [
                for (var i = 0; i < _componentIds.length; i++)
                  if (i != index) _componentIds[i],
              ];
            });
          },
          onCancel: () =>
              context.popOrGo('/learning/submissions/${submission.id}'),
          onSave: () => _save(submission, resubmit: false),
          onSaveAndResubmit: () => _save(submission, resubmit: true),
        );
      },
    );

    if (widget.embeddedInAuthoringWorkspace) {
      return body;
    }

    return Scaffold(
      backgroundColor: palette.pageBackground,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const EntryNavBar(homeRoute: '/home'),
            Expanded(child: body),
          ],
        ),
      ),
    );
  }

  String? _resolveSelectedCategoryId(
    List<MaterialCategory> categories,
    LearningProjectSubmission submission,
  ) {
    if (_selectedCategoryId != null &&
        categories.any((category) => category.id == _selectedCategoryId)) {
      return _selectedCategoryId;
    }

    final matched = categories.where(
      (category) =>
          category.nameEn == submission.category.en ||
          category.nameAr == submission.category.ar,
    );
    if (matched.isNotEmpty) {
      _selectedCategoryId = matched.first.id;
      return matched.first.id;
    }

    return categories.isNotEmpty ? categories.first.id : null;
  }

  Future<void> _save(
    LearningProjectSubmission submission, {
    required bool resubmit,
  }) async {
    FocusScope.of(context).unfocus();
    if (_isSaving) return;

    if (!(_formKey.currentState?.validate() ?? false)) {
      return;
    }

    final componentError = _validateComponents();
    if (componentError != null) {
      setState(() => _componentValidationMessage = componentError);
      return;
    }

    final categoryId = _selectedCategoryId;
    if (categoryId == null || categoryId.trim().isEmpty) {
      showInfoSnackBar(context, 'Select a project category before saving.');
      return;
    }

    setState(() {
      _isSaving = true;
      _componentValidationMessage = null;
    });
    if (widget.embeddedInAuthoringWorkspace) {
      _setSaveState(AuthoringWorkspaceSaveState.saving);
    }

    try {
      final repository = ref.read(learningHubRepositoryProvider);
      await repository.updateMyLearningProjectSubmission(
        submission.id,
        _buildPayload(categoryId),
      );
      if (resubmit) {
        await repository.resubmitMyLearningProjectSubmission(submission.id);
      }

      if (!mounted) return;
      invalidateLearningProjectSubmissions(ref, submission.id);
      _dirty = false;
      if (widget.embeddedInAuthoringWorkspace) {
        _setSaveState(AuthoringWorkspaceSaveState.saved);
        showInfoSnackBar(context, 'Project draft saved.');
      } else {
        showInfoSnackBar(
          context,
          resubmit
              ? 'Project resubmitted for admin review.'
              : 'Project submission changes saved.',
        );
        context.go('/learning/submissions/${submission.id}');
      }
    } catch (error) {
      if (mounted) {
        if (widget.embeddedInAuthoringWorkspace) {
          _setSaveState(AuthoringWorkspaceSaveState.failed);
        }
        showErrorSnackBar(context, error);
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  Map<String, dynamic> _buildPayload(String categoryId) {
    final duration = int.tryParse(_durationController.text.trim());
    final shortDescription = _summaryController.text.trim();
    final fullDescription = _descriptionController.text.trim();
    return {
      'title': _titleController.text.trim(),
      'shortDescription': shortDescription,
      'description': fullDescription.isNotEmpty
          ? fullDescription
          : shortDescription,
      'categoryId': categoryId,
      'difficulty': _selectedDifficulty,
      if (duration != null && duration > 0)
        'estimatedDurationMinutes': duration,
      'requiredComponents': _buildComponentsPayload(),
      'steps': LearningProjectStepText.parseStepsFromText(
        _stepsController.text,
      ),
      'links': _parseLinks(_linksController.text),
    };
  }

  List<Map<String, dynamic>> _buildComponentsPayload() {
    final payload = <Map<String, dynamic>>[];
    for (var index = 0; index < _components.length; index++) {
      final component = _components[index];
      if (component.name.trim().isEmpty) continue;
      final item = component.toSubmitPayload();
      final id = index < _componentIds.length ? _componentIds[index] : null;
      if (id != null && id.trim().isNotEmpty) {
        item['id'] = id;
      }
      payload.add(item);
    }
    return payload;
  }

  String? _validateComponents() {
    final named = _components
        .where((component) => component.name.trim().isNotEmpty)
        .toList(growable: false);
    if (named.isEmpty) return 'Add at least one component with a name.';
    if (_components.length > 50) return 'Use 50 components or fewer.';

    final seen = <String>{};
    for (final component in named) {
      final error = component.validate(
        requireName: true,
        materialCategories: materialSelectableCategories(
          ref.read(materialCategoriesProvider).value ??
              const <MaterialCategory>[],
        ),
      );
      if (error != null) return error;
      final key = component.name.trim().toLowerCase();
      if (seen.contains(key)) return 'Each component must have a unique name.';
      seen.add(key);
    }
    return null;
  }
}

class _EditContent extends StatelessWidget {
  const _EditContent({
    required this.formKey,
    required this.submission,
    required this.embeddedInAuthoringWorkspace,
    this.highlightedFields = const {},
    required this.titleController,
    required this.summaryController,
    required this.descriptionController,
    required this.durationController,
    required this.stepsController,
    required this.linksController,
    required this.projectCategories,
    required this.materialCategories,
    required this.selectedCategoryId,
    required this.selectedDifficulty,
    required this.components,
    required this.componentValidationMessage,
    required this.isSaving,
    required this.onCategoryChanged,
    required this.onDifficultyChanged,
    required this.onComponentsChanged,
    required this.onAddComponent,
    required this.onRemoveComponent,
    required this.onCancel,
    required this.onSave,
    required this.onSaveAndResubmit,
  });

  final GlobalKey<FormState> formKey;
  final LearningProjectSubmission submission;
  final bool embeddedInAuthoringWorkspace;
  final Set<String> highlightedFields;
  final TextEditingController titleController;
  final TextEditingController summaryController;
  final TextEditingController descriptionController;
  final TextEditingController durationController;
  final TextEditingController stepsController;
  final TextEditingController linksController;
  final List<MaterialCategory> projectCategories;
  final List<MaterialCategory> materialCategories;
  final String? selectedCategoryId;
  final String selectedDifficulty;
  final List<LearningProjectDraftComponent> components;
  final String? componentValidationMessage;
  final bool isSaving;
  final ValueChanged<String?> onCategoryChanged;
  final ValueChanged<String> onDifficultyChanged;
  final ValueChanged<List<LearningProjectDraftComponent>> onComponentsChanged;
  final VoidCallback onAddComponent;
  final ValueChanged<int> onRemoveComponent;
  final VoidCallback onCancel;
  final VoidCallback onSave;
  final VoidCallback onSaveAndResubmit;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final titleDirection = resolveContentTextDirection(titleController.text);
    final summaryDirection = resolveContentTextDirection(
      summaryController.text,
    );
    final descriptionDirection = resolveContentTextDirection(
      descriptionController.text,
    );

    return SingleChildScrollView(
      padding: EdgeInsetsDirectional.fromSTEB(
        AppSpacing.md,
        embeddedInAuthoringWorkspace ? AppSpacing.md : AppSpacing.lg,
        AppSpacing.md,
        AppSpacing.lg,
      ),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 980),
          child: Form(
            key: formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (!embeddedInAuthoringWorkspace) ...[
                  Text(
                    'Edit project submission',
                    style: AppTextStyles.display(
                      context,
                    ).copyWith(color: palette.textPrimary),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    submission.status ==
                            LearningProjectSubmissionStatus.pendingReview
                        ? 'This project is still pending review. Saving changes updates what admins will review.'
                        : 'Save changes without resubmitting, or send it back to admin review when ready.',
                    style: AppTextStyles.body(
                      context,
                    ).copyWith(color: palette.textSecondary),
                  ),
                ],
                if (submission.activeFeedback != null) ...[
                  SizedBox(
                    height: embeddedInAuthoringWorkspace
                        ? AppSpacing.md
                        : AppSpacing.md,
                  ),
                  _FeedbackPanel(submission: submission),
                ],
                SizedBox(
                  height: embeddedInAuthoringWorkspace
                      ? AppSpacing.md
                      : AppSpacing.lg,
                ),
                _FormPanel(
                  title: embeddedInAuthoringWorkspace ? 'Basic details' : null,
                  children: [
                    _AuthoringFieldHighlight(
                      active: highlightedFields.contains('title'),
                      child: AppTextField(
                        controller: titleController,
                        label: 'Project title',
                        hint: 'Arduino soil moisture monitor',
                        validator: _validateTitle,
                        textDirection: titleDirection,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    AppTextArea(
                      controller: summaryController,
                      label: 'Short description',
                      hint: 'Summarize what the learner will build.',
                      minLines: 2,
                      maxLines: 4,
                      validator: _validateSummary,
                      textDirection: summaryDirection,
                    ),
                    const SizedBox(height: AppSpacing.md),
                    AppTextArea(
                      controller: descriptionController,
                      label: 'Full description',
                      hint: 'Explain the project goal and expected outcome.',
                      minLines: 4,
                      maxLines: 8,
                      validator: _validateDescription,
                      textDirection: descriptionDirection,
                    ),
                    const SizedBox(height: AppSpacing.md),
                    LayoutBuilder(
                      builder: (context, constraints) {
                        final wide = constraints.maxWidth >= 720;
                        final categoryField = AppDropdownField<String>(
                          label: 'Project category',
                          value: selectedCategoryId,
                          items: [
                            for (final category in projectCategories)
                              DropdownMenuItem(
                                value: category.id,
                                child: Text(category.nameEn),
                              ),
                          ],
                          onChanged: onCategoryChanged,
                        );
                        final difficultyField = AppDropdownField<String>(
                          label: 'Difficulty',
                          value: isValidAuthoringDifficulty(selectedDifficulty)
                              ? selectedDifficulty.trim().toUpperCase()
                              : null,
                          items: const [
                            DropdownMenuItem(
                              value: 'BEGINNER',
                              child: Text('Easy'),
                            ),
                            DropdownMenuItem(
                              value: 'INTERMEDIATE',
                              child: Text('Medium'),
                            ),
                            DropdownMenuItem(
                              value: 'ADVANCED',
                              child: Text('Advanced'),
                            ),
                          ],
                          onChanged: (value) {
                            if (value != null) onDifficultyChanged(value);
                          },
                        );
                        final durationField = _AuthoringFieldHighlight(
                          active: highlightedFields.contains(
                            'estimatedMinutes',
                          ),
                          child: AppTextField(
                            controller: durationController,
                            label: 'Estimated minutes',
                            hint: '120',
                            keyboardType: TextInputType.number,
                            validator: _validateDuration,
                          ),
                        );

                        if (!wide) {
                          return Column(
                            children: [
                              categoryField,
                              const SizedBox(height: AppSpacing.md),
                              difficultyField,
                              const SizedBox(height: AppSpacing.md),
                              durationField,
                            ],
                          );
                        }

                        return Row(
                          children: [
                            Expanded(child: categoryField),
                            const SizedBox(width: AppSpacing.md),
                            Expanded(child: difficultyField),
                            const SizedBox(width: AppSpacing.md),
                            Expanded(child: durationField),
                          ],
                        );
                      },
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.lg),
                _FormPanel(
                  title: 'Required components',
                  children: [
                    LearningProjectComponentEditor(
                      components: components,
                      materialCategories: materialCategories,
                      onChanged: onComponentsChanged,
                      onAdd: onAddComponent,
                      onRemove: onRemoveComponent,
                      validator: (_) => componentValidationMessage,
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.lg),
                _FormPanel(
                  title: 'Build steps and links',
                  children: [
                    AppTextArea(
                      controller: stepsController,
                      label: 'Implementation steps',
                      hint:
                          'One step per line. No need to write Step 1.\nConnect the sensor to the board.\nMount the components.',
                      minLines: 5,
                      maxLines: 10,
                    ),
                    const SizedBox(height: AppSpacing.md),
                    AppTextArea(
                      controller: linksController,
                      label: 'External links',
                      hint: 'One http/https URL per line.',
                      minLines: 3,
                      maxLines: 6,
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.lg),
                Wrap(
                  spacing: AppSpacing.md,
                  runSpacing: AppSpacing.sm,
                  alignment: WrapAlignment.end,
                  children: [
                    if (!embeddedInAuthoringWorkspace)
                      OutlinedButton(
                        onPressed: isSaving ? null : onCancel,
                        style: AppStatusButtonStyle.outlined(
                          context,
                          AppStatusTone.warning,
                        ),
                        child: const Text('Cancel'),
                      ),
                    OutlinedButton.icon(
                      onPressed: isSaving ? null : onSave,
                      style: AppStatusButtonStyle.outlined(
                        context,
                        AppStatusTone.primary,
                      ),
                      icon: const Icon(Icons.save_outlined),
                      label: const Text('Save changes'),
                    ),
                    if (submission.availableActions.canResubmit)
                      SizedBox(
                        width: 220,
                        child: AppPrimaryButton(
                          label: 'Save and resubmit',
                          isLoading: isSaving,
                          onPressed: onSaveAndResubmit,
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _SubmissionCard extends StatelessWidget {
  const _SubmissionCard({required this.submission});

  final LearningProjectSubmission submission;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
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
            children: [
              _StatusChip(status: submission.status),
              Text(
                _formatDateLabel(
                  submission.statusDate,
                  submission.statusDatePrefix,
                ),
                style: AppTextStyles.badgeLabel(
                  context,
                ).copyWith(color: palette.textSecondary),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            submission.title,
            style: AppTextStyles.title(
              context,
            ).copyWith(color: palette.textPrimary),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            submission.shortDescription,
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
            style: AppTextStyles.body(
              context,
            ).copyWith(color: palette.textSecondary),
          ),
          if (submission.activeFeedback != null) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              submission.activeFeedback!,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: AppTextStyles.body(
                context,
              ).copyWith(color: _toneColor(context, submission.status)),
            ),
          ],
          const SizedBox(height: AppSpacing.md),
          _SubmissionActions(submission: submission, compact: true),
        ],
      ),
    );
  }
}

class _SubmissionActions extends ConsumerStatefulWidget {
  const _SubmissionActions({required this.submission, this.compact = false});

  final LearningProjectSubmission submission;
  final bool compact;

  @override
  ConsumerState<_SubmissionActions> createState() => _SubmissionActionsState();
}

class _SubmissionActionsState extends ConsumerState<_SubmissionActions> {
  bool _isSubmitting = false;
  String _submitIdempotencyKey = _newSubmitIdempotencyKey();

  LearningProjectSubmission get submission => widget.submission;

  bool get _isDraft =>
      submission.status == LearningProjectSubmissionStatus.draft;

  Future<void> _submitFromCard() async {
    if (_isSubmitting || !_isDraft) {
      return;
    }

    setState(() => _isSubmitting = true);
    try {
      final repository = ref.read(learningHubRepositoryProvider);
      await repository.submitMyLearningProjectDraft(
        submission.id,
        idempotencyKey: _submitIdempotencyKey,
      );

      if (!mounted) {
        return;
      }

      ref.invalidate(myLearningProjectSubmissionProvider(submission.id));
      ref.invalidate(myLearningProjectSubmissionsProvider);
      showInfoSnackBar(context, 'Project submitted for review.');
      setState(() {
        _isSubmitting = false;
        _submitIdempotencyKey = _newSubmitIdempotencyKey();
      });
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }
      _showSubmissionIncompleteFeedback(
        context,
        error,
        submissionId: submission.id,
        navigateToImages: projectSubmissionIncompleteRequiresImage(error),
        onEdit: () =>
            context.push('/learning/submissions/${submission.id}/edit'),
      );
      setState(() {
        _isSubmitting = false;
        _submitIdempotencyKey = _newSubmitIdempotencyKey();
      });
    } catch (error) {
      if (mounted) {
        showErrorSnackBar(context, error);
        setState(() {
          _isSubmitting = false;
          _submitIdempotencyKey = _newSubmitIdempotencyKey();
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final secondaryActions = <Widget>[
      OutlinedButton(
        onPressed: () => context.push('/learning/submissions/${submission.id}'),
        style: AppStatusButtonStyle.outlined(context, AppStatusTone.neutral),
        child: const Text('View'),
      ),
      if (_isDraft)
        OutlinedButton.icon(
          onPressed: () =>
              context.go('/learning/submissions/${submission.id}/author'),
          style: AppStatusButtonStyle.outlined(context, AppStatusTone.primary),
          icon: const Icon(Icons.auto_awesome_outlined),
          label: Text(_continueWithAiLabel.resolve(context)),
        ),
      if (submission.availableActions.canEdit)
        OutlinedButton.icon(
          onPressed: () =>
              context.push('/learning/submissions/${submission.id}/edit'),
          style: AppStatusButtonStyle.outlined(context, AppStatusTone.primary),
          icon: const Icon(Icons.edit_outlined),
          label: Text(
            submission.availableActions.canResubmit
                ? 'Edit and resubmit'
                : 'Edit',
          ),
        ),
      if (submission.availableActions.canViewPublic)
        OutlinedButton.icon(
          onPressed: () => context.push('/learning/${submission.id}'),
          style: AppStatusButtonStyle.outlined(context, AppStatusTone.neutral),
          icon: const Icon(Icons.open_in_new_rounded),
          label: const Text('View public project'),
        ),
    ];

    if (!widget.compact) {
      return Wrap(
        spacing: AppSpacing.sm,
        runSpacing: AppSpacing.sm,
        children: secondaryActions,
      );
    }

    if (_isDraft) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AppPrimaryButton(
            label: 'Submit for review',
            isLoading: _isSubmitting,
            onPressed: _isSubmitting ? null : _submitFromCard,
          ),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: secondaryActions,
          ),
        ],
      );
    }

    if (submission.status == LearningProjectSubmissionStatus.changesRequested &&
        submission.availableActions.canResubmit) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AppPrimaryButton(
            label: 'Resubmit for review',
            onPressed: () =>
                context.push('/learning/submissions/${submission.id}/edit'),
          ),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: secondaryActions,
          ),
        ],
      );
    }

    return Wrap(
      spacing: AppSpacing.sm,
      runSpacing: AppSpacing.sm,
      children: secondaryActions,
    );
  }
}

class _StatusFilters extends StatelessWidget {
  const _StatusFilters({required this.selectedStatus, required this.onChanged});

  final LearningProjectSubmissionStatus? selectedStatus;
  final ValueChanged<LearningProjectSubmissionStatus?> onChanged;

  @override
  Widget build(BuildContext context) {
    final statuses = [
      null,
      LearningProjectSubmissionStatus.pendingReview,
      LearningProjectSubmissionStatus.changesRequested,
      LearningProjectSubmissionStatus.rejected,
      LearningProjectSubmissionStatus.published,
    ];

    return Wrap(
      spacing: AppSpacing.sm,
      runSpacing: AppSpacing.sm,
      children: statuses
          .map((status) {
            final selected = selectedStatus == status;
            return FilterChip(
              selected: selected,
              label: Text(status?.label() ?? 'All'),
              onSelected: (_) => onChanged(status),
            );
          })
          .toList(growable: false),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.status});

  final LearningProjectSubmissionStatus status;

  @override
  Widget build(BuildContext context) => AppStatusBadge(
    label: status.label(),
    tone: learningProjectStatusTone(status.apiValue),
  );
}

class _FeedbackPanel extends StatelessWidget {
  const _FeedbackPanel({required this.submission});

  final LearningProjectSubmission submission;

  @override
  Widget build(BuildContext context) {
    final color = _toneColor(context, submission.status);
    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.09),
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: color.withValues(alpha: 0.28)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            submission.status == LearningProjectSubmissionStatus.rejected
                ? 'Admin rejection reason'
                : 'Admin feedback',
            style: AppTextStyles.label(context).copyWith(color: color),
          ),
          if (submission.reviewedAt != null) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              _formatDateLabel(submission.reviewedAt, 'Reviewed'),
              style: AppTextStyles.badgeLabel(
                context,
              ).copyWith(color: color.withValues(alpha: 0.85)),
            ),
          ],
          const SizedBox(height: AppSpacing.xs),
          Text(
            submission.activeFeedback ?? '',
            style: AppTextStyles.body(context),
          ),
        ],
      ),
    );
  }
}

class _SummarySection extends StatelessWidget {
  const _SummarySection({
    required this.title,
    required this.emptyLabel,
    required this.children,
  });

  final String title;
  final String emptyLabel;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return _FormPanel(
      title: title,
      children: children.isEmpty
          ? [
              Text(
                emptyLabel,
                style: AppTextStyles.body(
                  context,
                ).copyWith(color: LearningUiPalette.of(context).textSecondary),
              ),
            ]
          : children,
    );
  }
}

class _SummaryRow extends StatelessWidget {
  const _SummaryRow({required this.title, required this.subtitle});

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    return Padding(
      padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: AppTextStyles.label(context)),
          if (subtitle.trim().isNotEmpty)
            Text(
              subtitle,
              style: AppTextStyles.body(
                context,
              ).copyWith(color: palette.textSecondary),
            ),
        ],
      ),
    );
  }
}

class _FormPanel extends StatelessWidget {
  const _FormPanel({required this.children, this.title});

  final String? title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: palette.cardSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (title != null) ...[
            Text(
              title!,
              style: AppTextStyles.title(
                context,
              ).copyWith(color: palette.textPrimary),
            ),
            const SizedBox(height: AppSpacing.md),
          ],
          ...children,
        ],
      ),
    );
  }
}

class _SubmissionsPager extends StatelessWidget {
  const _SubmissionsPager({required this.result, required this.onPageChanged});

  final LearningProjectSubmissionsResult result;
  final ValueChanged<int> onPageChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        OutlinedButton(
          onPressed: result.page > 1
              ? () => onPageChanged(result.page - 1)
              : null,
          style: AppStatusButtonStyle.outlined(context, AppStatusTone.neutral),
          child: const Text('Previous'),
        ),
        Padding(
          padding: const EdgeInsetsDirectional.symmetric(
            horizontal: AppSpacing.md,
          ),
          child: Text('Page ${result.page} of ${result.totalPages}'),
        ),
        OutlinedButton(
          onPressed: result.page < result.totalPages
              ? () => onPageChanged(result.page + 1)
              : null,
          style: AppStatusButtonStyle.outlined(context, AppStatusTone.neutral),
          child: const Text('Next'),
        ),
      ],
    );
  }
}

class _StatePanel extends StatelessWidget {
  const _StatePanel({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.actionLabel,
    required this.onAction,
    this.actionTone = AppStatusTone.primary,
    this.actionProminent = true,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final String actionLabel;
  final VoidCallback onAction;
  final AppStatusTone actionTone;
  final bool actionProminent;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
        child: AppEmptyStateCard(
          icon: icon,
          title: title,
          subtitle: subtitle,
          actions: [
            FilledButton(
              onPressed: onAction,
              style: actionProminent
                  ? AppStatusButtonStyle.filled(context, actionTone)
                  : AppStatusButtonStyle.outlined(context, actionTone),
              child: Text(actionLabel),
            ),
          ],
        ),
      ),
    );
  }
}

Color _toneColor(
  BuildContext context,
  LearningProjectSubmissionStatus status,
) => AppStatusStyle.of(
  context,
  learningProjectStatusTone(status.apiValue),
).foreground;

String _formatDateLabel(DateTime? date, String prefix) {
  if (date == null) {
    return '$prefix: not set';
  }
  return '$prefix: ${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
}

String? _validateTitle(String? value) {
  final trimmed = value?.trim() ?? '';
  if (trimmed.isEmpty) {
    return 'Project title is required.';
  }
  if (trimmed.length < 3) {
    return 'Use at least 3 characters.';
  }
  if (trimmed.length > 200) {
    return 'Keep the title under 200 characters.';
  }
  return null;
}

String? _validateSummary(String? value) {
  final trimmed = value?.trim() ?? '';
  if (trimmed.isEmpty) {
    return 'Short description is required.';
  }
  if (trimmed.length < 10) {
    return 'Use at least 10 characters.';
  }
  if (trimmed.length > 500) {
    return 'Keep the short description under 500 characters.';
  }
  return null;
}

String? _validateDescription(String? value) {
  final trimmed = value?.trim() ?? '';
  if (trimmed.isEmpty) {
    return null;
  }
  if (trimmed.length < 10) {
    return 'Use at least 10 characters when adding a full description.';
  }
  if (trimmed.length > 10000) {
    return 'Keep the full description under 10000 characters.';
  }
  return null;
}

String? _validateDuration(String? value) {
  final trimmed = value?.trim() ?? '';
  if (trimmed.isEmpty) {
    return null;
  }
  final parsed = int.tryParse(trimmed);
  if (parsed == null || parsed <= 0) {
    return 'Enter a positive number.';
  }
  if (parsed > 10000) {
    return 'Use 10000 minutes or fewer.';
  }
  return null;
}

List<Map<String, dynamic>> _parseLinks(String raw) {
  return raw
      .split('\n')
      .map((line) => line.trim())
      .where((line) => line.isNotEmpty)
      .map((url) => {'url': url})
      .toList(growable: false);
}

class _AuthoringFieldHighlight extends StatelessWidget {
  const _AuthoringFieldHighlight({required this.active, required this.child});

  final bool active;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    return AnimatedContainer(
      duration: const Duration(milliseconds: 220),
      padding: active
          ? const EdgeInsetsDirectional.all(AppSpacing.xs)
          : EdgeInsetsDirectional.zero,
      decoration: BoxDecoration(
        borderRadius: AppRadius.mdAll,
        border: active
            ? Border.all(color: palette.heroAccent, width: 2)
            : Border.all(color: Colors.transparent, width: 2),
      ),
      child: child,
    );
  }
}

extension on num {
  String get g => this == roundToDouble() ? toInt().toString() : toString();
}

class _ProjectImagesSection extends StatelessWidget {
  const _ProjectImagesSection({
    super.key,
    required this.coverImageUrl,
    required this.canManageImages,
    required this.isUploading,
    required this.onAddImage,
  });

  final String? coverImageUrl;
  final bool canManageImages;
  final bool isUploading;
  final VoidCallback onAddImage;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final resolvedUrl = coverImageUrl?.trim();
    final hasImage = resolvedUrl?.isNotEmpty == true;

    return _FormPanel(
      title: 'Project images',
      children: [
        if (hasImage)
          ClipRRect(
            borderRadius: AppRadius.mdAll,
            child: AspectRatio(
              aspectRatio: 16 / 9,
              child: Image.network(
                ApiConfig.resolveMediaUrl(resolvedUrl!),
                fit: BoxFit.cover,
                errorBuilder: (context, error, stackTrace) => Container(
                  color: palette.borderSubtle,
                  alignment: Alignment.center,
                  child: Icon(
                    Icons.broken_image_outlined,
                    color: palette.textSecondary,
                  ),
                ),
              ),
            ),
          )
        else
          Text(
            'No project image yet.',
            style: AppTextStyles.body(
              context,
            ).copyWith(color: palette.textSecondary),
          ),
        if (canManageImages) ...[
          const SizedBox(height: AppSpacing.md),
          OutlinedButton.icon(
            onPressed: isUploading ? null : onAddImage,
            style: AppStatusButtonStyle.outlined(
              context,
              AppStatusTone.primary,
            ),
            icon: isUploading
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.add_photo_alternate_outlined),
            label: Text(
              hasImage ? 'Replace project image' : 'Add project image',
            ),
          ),
        ],
      ],
    );
  }
}

class _ReviewStateBanner extends StatelessWidget {
  const _ReviewStateBanner({
    required this.title,
    required this.message,
    required this.tone,
    this.actionLabel,
    this.onAction,
  });

  final String title;
  final String message;
  final AppStatusTone tone;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final color = AppStatusStyle.of(context, tone).foreground;
    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.09),
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: color.withValues(alpha: 0.28)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: AppTextStyles.label(context).copyWith(color: color),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(message, style: AppTextStyles.body(context)),
          if (actionLabel != null && onAction != null) ...[
            const SizedBox(height: AppSpacing.sm),
            TextButton(
              onPressed: onAction,
              style: AppStatusButtonStyle.text(context, tone),
              child: Text(actionLabel!),
            ),
          ],
        ],
      ),
    );
  }
}
