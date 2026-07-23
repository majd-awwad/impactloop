import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/navigation_extensions.dart';
import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/widgets/entry_nav_bar.dart';
import '../../../../shared/models/localized_text.dart';
import '../../../../shared/widgets/app_dropdown_field.dart';
import '../../../../shared/widgets/app_empty_state_card.dart';
import '../../../../shared/widgets/app_feedback.dart';
import '../../../../shared/widgets/app_primary_button.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/app_text_area.dart';
import '../../../../shared/widgets/app_text_field.dart';
import '../../../../shared/widgets/learning_project_status_presentation.dart';
import '../../../materials/data/models/category.dart';
import '../../application/learning_hub_providers.dart';
import '../../domain/models/learning_project_draft_component.dart';
import '../../domain/models/learning_project_step_text.dart';
import '../../domain/models/learning_project_submission.dart';
import '../theme/learning_ui_palette.dart';
import '../widgets/learning_project_component_editor.dart';

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
    required this.onStatusChanged,
    required this.onPageChanged,
  });

  final LearningProjectSubmissionsResult result;
  final LearningProjectSubmissionStatus? selectedStatus;
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
                    onPressed: () => context.go('/learning/add-draft'),
                    style: AppStatusButtonStyle.filled(
                      context,
                      AppStatusTone.primary,
                    ),
                    icon: const Icon(Icons.add_rounded),
                    label: const Text('Submit new project'),
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
                  onAction: () => context.go('/learning/add-draft'),
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
                data: (submission) =>
                    _SubmissionDetailContent(submission: submission),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SubmissionDetailContent extends ConsumerWidget {
  const _SubmissionDetailContent({required this.submission});

  final LearningProjectSubmission submission;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
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
                child: TextButton.icon(
                  onPressed: () => context.popOrGo('/learning/submissions'),
                  style: AppStatusButtonStyle.text(
                    context,
                    AppStatusTone.neutral,
                  ),
                  icon: const Icon(Icons.arrow_back_rounded),
                  label: const Text('Back to submissions'),
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
                    const SizedBox(height: AppSpacing.lg),
                    _SubmissionActions(submission: submission),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
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
  });

  final String submissionId;

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
  String? _selectedCategoryId;
  String _selectedDifficulty = 'INTERMEDIATE';
  bool _isSaving = false;
  String? _componentValidationMessage;
  List<LearningProjectDraftComponent> _components = [
    LearningProjectDraftComponent.empty(),
  ];
  List<String?> _componentIds = [null];

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

  void _loadSubmission(LearningProjectSubmission submission) {
    if (_loadedId == submission.id) {
      return;
    }

    _loadedId = submission.id;
    _titleController.text = submission.title;
    _summaryController.text = submission.shortDescription;
    _descriptionController.text =
        submission.description ?? submission.shortDescription;
    _durationController.text =
        submission.estimatedDurationMinutes?.toString() ?? '';
    _selectedCategoryId = null;
    _selectedDifficulty = submission.difficulty;
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
  }

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final submissionAsync = ref.watch(
      myLearningProjectSubmissionProvider(widget.submissionId),
    );
    final projectCategoriesAsync = ref.watch(projectCategoriesProvider);
    final materialCategoriesAsync = ref.watch(materialCategoriesProvider);

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
                data: (submission) {
                  _loadSubmission(submission);
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
                      projectCategoriesAsync.value ??
                      const <MaterialCategory>[];
                  final materialCategories = materialSelectableCategories(
                    materialCategoriesAsync.value ?? const <MaterialCategory>[],
                  );
                  _selectedCategoryId ??= submission.category.resolve(context);

                  return _EditContent(
                    formKey: _formKey,
                    submission: submission,
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
                    onDifficultyChanged: (value) =>
                        setState(() => _selectedDifficulty = value),
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
                    onCancel: () => context.popOrGo(
                      '/learning/submissions/${submission.id}',
                    ),
                    onSave: () => _save(submission, resubmit: false),
                    onSaveAndResubmit: () => _save(submission, resubmit: true),
                  );
                },
              ),
            ),
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
      showInfoSnackBar(
        context,
        resubmit
            ? 'Project resubmitted for admin review.'
            : 'Project submission changes saved.',
      );
      context.go('/learning/submissions/${submission.id}');
    } catch (error) {
      if (mounted) showErrorSnackBar(context, error);
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

    return SingleChildScrollView(
      padding: const EdgeInsetsDirectional.fromSTEB(
        AppSpacing.md,
        AppSpacing.lg,
        AppSpacing.md,
        AppSpacing.xl,
      ),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 980),
          child: Form(
            key: formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
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
                if (submission.activeFeedback != null) ...[
                  const SizedBox(height: AppSpacing.md),
                  _FeedbackPanel(submission: submission),
                ],
                const SizedBox(height: AppSpacing.lg),
                _FormPanel(
                  children: [
                    AppTextField(
                      controller: titleController,
                      label: 'Project title',
                      hint: 'Arduino soil moisture monitor',
                      validator: _validateTitle,
                    ),
                    const SizedBox(height: AppSpacing.md),
                    AppTextArea(
                      controller: summaryController,
                      label: 'Short description',
                      hint: 'Summarize what the learner will build.',
                      minLines: 2,
                      maxLines: 4,
                      validator: _validateSummary,
                    ),
                    const SizedBox(height: AppSpacing.md),
                    AppTextArea(
                      controller: descriptionController,
                      label: 'Full description',
                      hint: 'Explain the project goal and expected outcome.',
                      minLines: 4,
                      maxLines: 8,
                      validator: _validateDescription,
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
                          value: selectedDifficulty,
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
                        final durationField = AppTextField(
                          controller: durationController,
                          label: 'Estimated minutes',
                          hint: '120',
                          keyboardType: TextInputType.number,
                          validator: _validateDuration,
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

class _SubmissionActions extends StatelessWidget {
  const _SubmissionActions({required this.submission, this.compact = false});

  final LearningProjectSubmission submission;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final actions = <Widget>[
      OutlinedButton(
        onPressed: () => context.go('/learning/submissions/${submission.id}'),
        style: AppStatusButtonStyle.outlined(context, AppStatusTone.neutral),
        child: const Text('View'),
      ),
      if (submission.availableActions.canEdit)
        FilledButton.icon(
          onPressed: () =>
              context.go('/learning/submissions/${submission.id}/edit'),
          style: AppStatusButtonStyle.filled(context, AppStatusTone.primary),
          icon: const Icon(Icons.edit_outlined),
          label: Text(
            submission.availableActions.canResubmit
                ? 'Edit and resubmit'
                : 'Edit',
          ),
        ),
      if (submission.availableActions.canViewPublic)
        OutlinedButton.icon(
          onPressed: () => context.go('/learning/${submission.id}'),
          style: AppStatusButtonStyle.outlined(context, AppStatusTone.neutral),
          icon: const Icon(Icons.open_in_new_rounded),
          label: const Text('View public project'),
        ),
    ];

    return Wrap(
      spacing: AppSpacing.sm,
      runSpacing: AppSpacing.sm,
      children: actions,
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

extension on num {
  String get g => this == roundToDouble() ? toInt().toString() : toString();
}
