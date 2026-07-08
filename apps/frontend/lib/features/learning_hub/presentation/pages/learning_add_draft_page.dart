import 'dart:async';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_color_tokens.dart';
import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/widgets/app_mobile_bottom_nav_bar.dart';
import '../../../../app/widgets/entry_nav_bar.dart';
import '../../../../shared/widgets/app_dropdown_field.dart';
import '../../../../shared/widgets/app_feedback.dart';
import '../../../../shared/widgets/app_primary_button.dart';
import '../../../../shared/widgets/app_text_area.dart';
import '../../../../shared/widgets/app_text_field.dart';
import '../../../materials/data/models/category.dart';
import '../../application/learning_hub_providers.dart';
import '../../data/learning_project_draft_storage.dart';
import '../../domain/models/learning_project.dart';
import '../../domain/models/learning_project_draft_component.dart';
import '../../domain/models/learning_project_step_text.dart';
import '../theme/learning_ui_palette.dart';
import '../widgets/learning_project_component_editor.dart';

class LearningAddDraftPage extends ConsumerStatefulWidget {
  const LearningAddDraftPage({super.key});

  @override
  ConsumerState<LearningAddDraftPage> createState() =>
      _LearningAddDraftPageState();
}

class _LearningAddDraftPageState extends ConsumerState<LearningAddDraftPage> {
  final _formKey = GlobalKey<FormState>();

  late final TextEditingController _titleController;
  late final TextEditingController _summaryController;
  late final TextEditingController _descriptionController;
  late final TextEditingController _stepsController;
  late final TextEditingController _linksController;

  List<LearningProjectDraftComponent> _componentEntries = [
    LearningProjectDraftComponent.empty(),
  ];
  String? _componentValidationMessage;

  String? _selectedCategoryId;
  String _selectedDifficulty = 'medium';
  String _selectedDuration = 'medium';
  bool _isSubmitting = false;
  bool _isSavingDraft = false;
  late String _submitIdempotencyKey;

  @override
  void initState() {
    super.initState();
    _titleController = TextEditingController();
    _summaryController = TextEditingController();
    _descriptionController = TextEditingController();
    _stepsController = TextEditingController();
    _linksController = TextEditingController();
    _submitIdempotencyKey = _newIdempotencyKey();
    unawaited(_restoreLocalDraft());
  }

  @override
  void dispose() {
    _titleController.dispose();
    _summaryController.dispose();
    _descriptionController.dispose();
    _stepsController.dispose();
    _linksController.dispose();
    super.dispose();
  }

  Future<void> _restoreLocalDraft() async {
    final draft = await ref
        .read(learningProjectDraftStorageProvider)
        .readDraft();
    if (!mounted || draft == null) return;

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      setState(() {
        _titleController.text = draft.title;
        _summaryController.text = draft.summary;
        _descriptionController.text = draft.fullDescription;
        _componentEntries = draft.components;
        _stepsController.text = draft.steps;
        _linksController.text = draft.links;
        _selectedCategoryId = draft.categoryId;
        _selectedDifficulty = draft.difficulty;
        _selectedDuration = draft.duration;
      });
    });
  }

  Future<void> _saveLocalDraft() async {
    FocusScope.of(context).unfocus();
    setState(() => _isSavingDraft = true);
    await ref
        .read(learningProjectDraftStorageProvider)
        .saveDraft(_currentDraftData());
    if (!mounted) return;

    setState(() => _isSavingDraft = false);
    showInfoSnackBar(
      context,
      const LocalizedText(
        en: 'Draft saved on this device.',
        ar: '╪ز┘à ╪ص┘╪╕ ╪د┘┘à╪│┘ê╪»╪ر ╪╣┘┘ë ┘ç╪░╪د ╪د┘╪ش┘ç╪د╪▓.',
      ).resolve(context),
    );
  }

  LearningProjectDraftData _currentDraftData() {
    final categories =
        ref.read(projectCategoriesProvider).value ?? const <MaterialCategory>[];

    return LearningProjectDraftData(
      title: _titleController.text,
      summary: _summaryController.text,
      fullDescription: _descriptionController.text,
      components: _componentEntries,
      steps: _stepsController.text,
      links: _linksController.text,
      categoryId: _selectedProjectCategory(categories)?.id,
      difficulty: _selectedDifficulty,
      duration: _selectedDuration,
    );
  }

  Future<void> _submitForReview() async {
    FocusScope.of(context).unfocus();
    if (_isSubmitting) {
      return;
    }

    if (!(_formKey.currentState?.validate() ?? false)) {
      return;
    }

    final componentError = _validateComponentEntries(
      requireNamedComponents: true,
      materialCategories: materialSelectableCategories(
        ref.read(materialCategoriesProvider).value ?? const <MaterialCategory>[],
      ),
    );
    if (componentError != null) {
      setState(() => _componentValidationMessage = componentError);
      return;
    }

    final categories =
        ref.read(projectCategoriesProvider).value ?? const <MaterialCategory>[];
    final category = _selectedProjectCategory(categories);
    if (category == null) {
      showInfoSnackBar(
        context,
        const LocalizedText(
          en: 'Select an available project category before submitting.',
          ar: '╪د╪«╪ز╪▒ ┘╪خ╪ر ┘à╪┤╪▒┘ê╪╣ ┘à╪ز╪د╪ص╪ر ┘é╪ذ┘ ╪د┘╪ح╪▒╪│╪د┘.',
        ).resolve(context),
      );
      return;
    }

    setState(() => _isSubmitting = true);
    try {
      final repository = ref.read(learningHubRepositoryProvider);
      await repository.submitProjectForReview(
        idempotencyKey: _submitIdempotencyKey,
        title: _titleController.text.trim(),
        shortDescription: _summaryController.text.trim(),
        description: _resolvedFullDescription(),
        categoryId: category.id,
        difficulty: _mapDifficulty(_selectedDifficulty),
        estimatedDurationMinutes: _mapDurationMinutes(_selectedDuration),
        requiredComponents: _buildSubmitComponents(),
        steps: LearningProjectStepText.parseStepsFromText(_stepsController.text),
        links: _parseLinks(_linksController.text),
      );
      await ref.read(learningProjectDraftStorageProvider).clearDraft();
      if (!mounted) return;

      _resetFormForNextDraft();
      showInfoSnackBar(
        context,
        const LocalizedText(
          en: 'Your project was submitted for admin review.',
          ar: '╪ز┘à ╪ح╪▒╪│╪د┘ ┘à╪┤╪▒┘ê╪╣┘â ┘┘à╪▒╪د╪ش╪╣╪ر ╪د┘╪ح╪»╪د╪▒╪ر.',
        ).resolve(context),
      );
      context.go('/learning');
    } catch (error) {
      if (!mounted) return;
      showErrorSnackBar(context, error);
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  void _resetFormForNextDraft() {
    _formKey.currentState?.reset();
    _titleController.clear();
    _summaryController.clear();
    _descriptionController.clear();
    _componentEntries = [LearningProjectDraftComponent.empty()];
    _componentValidationMessage = null;
    _stepsController.clear();
    _linksController.clear();
    _selectedCategoryId = null;
    _selectedDifficulty = 'medium';
    _selectedDuration = 'medium';
    _submitIdempotencyKey = _newIdempotencyKey();
  }

  String _newIdempotencyKey() {
    const alphabet =
        'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    final random = Random.secure();
    final suffix = List.generate(
      32,
      (_) => alphabet[random.nextInt(alphabet.length)],
    ).join();
    return 'learning-submit-$suffix';
  }

  MaterialCategory? _selectedProjectCategory(
    List<MaterialCategory> categories,
  ) {
    final selected = _selectedCategoryId?.trim();
    if (selected == null || selected.isEmpty) return null;

    for (final category in categories) {
      if (category.id == selected) {
        return category;
      }
    }

    return null;
  }

  String _mapDifficulty(String value) {
    return switch (value) {
      'easy' => 'BEGINNER',
      'advanced' => 'ADVANCED',
      _ => 'INTERMEDIATE',
    };
  }

  int _mapDurationMinutes(String value) {
    return switch (value) {
      'short' => 120,
      'long' => 300,
      _ => 240,
    };
  }

  List<Map<String, dynamic>> _buildSubmitComponents() {
    return _componentEntries
        .where((component) => component.name.trim().isNotEmpty)
        .map((component) => component.toSubmitPayload())
        .toList(growable: false);
  }

  LearningProjectSubmitSummary _submitSummary() {
    final namedComponents = _componentEntries
        .where((component) => component.name.trim().isNotEmpty)
        .toList(growable: false);

    return LearningProjectSubmitSummary(
      componentCount: namedComponents.length,
      toolCount: namedComponents
          .where((component) => component.role == LearningProjectComponentRole.tool)
          .length,
      stepCount: _nonEmptyLines(_stepsController.text).length,
    );
  }

  String? _validateComponentEntries({
    required bool requireNamedComponents,
    List<MaterialCategory> materialCategories = const [],
  }) {
    final namedComponents = _componentEntries
        .where((component) => component.name.trim().isNotEmpty)
        .toList(growable: false);

    if (requireNamedComponents && namedComponents.isEmpty) {
      return 'Add at least one component with a name.';
    }

    if (_componentEntries.length > 50) {
      return 'Use 50 components or fewer.';
    }

    final seen = <String>{};
    for (final component in _componentEntries) {
      final trimmedName = component.name.trim();
      if (trimmedName.isEmpty) {
        continue;
      }

      final error = component.validate(
        requireName: true,
        materialCategories: materialCategories,
      );
      if (error != null) {
        return error;
      }

      final key = trimmedName.toLowerCase();
      if (seen.contains(key)) {
        return 'Each component must have a unique name.';
      }
      seen.add(key);
    }

    return null;
  }

  String? _validateComponentsField() {
    return _validateComponentEntries(
      requireNamedComponents: false,
      materialCategories: materialSelectableCategories(
        ref.read(materialCategoriesProvider).value ?? const <MaterialCategory>[],
      ),
    );
  }

  String _resolvedFullDescription() {
    final full = _descriptionController.text.trim();
    if (full.isNotEmpty) {
      return full;
    }
    return _summaryController.text.trim();
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

  List<Map<String, dynamic>> _parseLinks(String raw) {
    return _nonEmptyLines(raw).map((url) => {'url': url}).toList();
  }

  List<String> _nonEmptyLines(String raw) {
    return raw
        .split('\n')
        .map((line) => line.trim())
        .where((line) => line.isNotEmpty)
        .toList(growable: false);
  }

  String? _validateTitle(String? value) {
    final trimmed = value?.trim() ?? '';
    if (trimmed.isEmpty) return 'Project title is required.';
    if (trimmed.length < 3) return 'Use at least 3 characters.';
    if (trimmed.length > 200) return 'Keep the title under 200 characters.';
    return null;
  }

  String? _validateSummary(String? value) {
    final trimmed = value?.trim() ?? '';
    if (trimmed.isEmpty) return 'Short description is required.';
    if (trimmed.length < 10) return 'Use at least 10 characters.';
    if (trimmed.length > 500) return 'Keep the short description under 500 characters.';
    return null;
  }

  String? _validateCategory(
    String? value,
    AsyncValue<List<MaterialCategory>> categoriesAsync,
  ) {
    final categories = categoriesAsync.value ?? const <MaterialCategory>[];
    if (categoriesAsync.hasError) return 'Project categories could not load.';
    if (categories.isEmpty) return 'Project categories are not available yet.';
    if (value == null || value.trim().isEmpty) return 'Select a category.';
    final exists = categories.any((category) => category.id == value);
    return exists ? null : 'Select an available category.';
  }

  String? _validateSteps(String? value) {
    final steps = _nonEmptyLines(value ?? '');
    if (steps.length > 100) return 'Use 100 steps or fewer.';
    for (final step in steps) {
      if (step.length > 5000) return 'Keep each step under 5000 characters.';
    }
    return null;
  }

  String? _validateLinks(String? value) {
    final links = _nonEmptyLines(value ?? '');
    if (links.length > 20) return 'Use 20 links or fewer.';
    for (final link in links) {
      if (!_isHttpUrl(link)) {
        return 'Use valid http or https links, one per line.';
      }
    }
    return null;
  }

  bool _isHttpUrl(String value) {
    final uri = Uri.tryParse(value);
    return uri != null &&
        uri.hasAuthority &&
        (uri.scheme == 'http' || uri.scheme == 'https');
  }

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final categoriesAsync = ref.watch(projectCategoriesProvider);
    final materialCategoriesAsync = ref.watch(materialCategoriesProvider);
    final categories = categoriesAsync.value ?? const <MaterialCategory>[];
    final materialCategories = materialSelectableCategories(
      materialCategoriesAsync.value ?? const <MaterialCategory>[],
    );
    final selectedCategoryId = _selectedProjectCategory(categories)?.id;

    return Scaffold(
      backgroundColor: palette.pageBackground,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const EntryNavBar(homeRoute: '/home', phoneTitle: 'Add project'),
            Expanded(
              child: SingleChildScrollView(
                padding: appMobileAwareScrollPadding(
                  context,
                  top: AppSpacing.md,
                ),
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 1180),
                    child: Form(
                      key: _formKey,
                      child: LayoutBuilder(
                        builder: (context, constraints) {
                          final twoColumn = constraints.maxWidth >= 940;
                          final form = _buildFormCard(
                            context,
                            categoriesAsync: categoriesAsync,
                            categories: categories,
                            materialCategories: materialCategories,
                            selectedCategoryId: selectedCategoryId,
                          );
                          final side = _SupportColumn(
                            onBack: () {
                              if (context.canPop()) {
                                context.pop();
                              } else {
                                context.go('/learning');
                              }
                            },
                          );

                          return Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              _AddDraftHeader(
                                onBack: () => context.go('/learning'),
                              ),
                              const SizedBox(height: AppSpacing.lg),
                              if (twoColumn)
                                Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Expanded(flex: 7, child: form),
                                    const SizedBox(width: AppSpacing.lg),
                                    Expanded(flex: 3, child: side),
                                  ],
                                )
                              else ...[
                                form,
                                const SizedBox(height: AppSpacing.lg),
                                side,
                              ],
                            ],
                          );
                        },
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

  Widget _buildFormCard(
    BuildContext context, {
    required AsyncValue<List<MaterialCategory>> categoriesAsync,
    required List<MaterialCategory> categories,
    required List<MaterialCategory> materialCategories,
    required String? selectedCategoryId,
  }) {
    final palette = LearningUiPalette.of(context);
    final summary = _submitSummary();
    final categoryHint = categoriesAsync.hasError
        ? 'Could not load categories'
        : categoriesAsync.isLoading && categories.isEmpty
        ? 'Loading categories...'
        : 'Select a category';

    return _LearningPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _SectionHeading(
            title: const LocalizedText(
              en: 'Project basics',
              ar: '╪ث╪│╪د╪│┘è╪د╪ز ╪د┘┘à╪┤╪▒┘ê╪╣',
            ),
            subtitle: const LocalizedText(
              en: 'Share enough detail for admin review and future learners.',
              ar: '╪ث╪╢┘ ╪ز┘╪د╪╡┘è┘ ┘â╪د┘┘è╪ر ┘┘à╪▒╪د╪ش╪╣╪ر ╪د┘╪ح╪»╪د╪▒╪ر ┘ê┘┘┘à╪ز╪╣┘┘à┘è┘ ┘╪د╪ص┘é╪د┘ï.',
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          LayoutBuilder(
            builder: (context, constraints) {
              final wide = constraints.maxWidth >= 720;
              final fieldWidth = wide
                  ? (constraints.maxWidth - AppSpacing.md) / 2
                  : constraints.maxWidth;

              return Wrap(
                spacing: AppSpacing.md,
                runSpacing: AppSpacing.md,
                children: [
                  SizedBox(
                    width: fieldWidth,
                    child: AppTextField(
                      controller: _titleController,
                      label: 'Project title',
                      hint: 'Solar classroom weather station',
                      textInputAction: TextInputAction.next,
                      validator: _validateTitle,
                    ),
                  ),
                  SizedBox(
                    width: fieldWidth,
                    child: AppDropdownField<String>(
                      label: 'Category',
                      value: selectedCategoryId,
                      hint: categoryHint,
                      items: categories.map((category) {
                        return DropdownMenuItem<String>(
                          value: category.id,
                          child: Text(
                            LocalizedText(
                              en: category.nameEn,
                              ar: category.nameAr.isEmpty
                                  ? category.nameEn
                                  : category.nameAr,
                            ).resolve(context),
                          ),
                        );
                      }).toList(),
                      onChanged: categories.isEmpty
                          ? null
                          : (value) {
                              setState(() => _selectedCategoryId = value);
                            },
                      validator: (value) =>
                          _validateCategory(value, categoriesAsync),
                    ),
                  ),
                ],
              );
            },
          ),
          const SizedBox(height: AppSpacing.lg),
          _LearningChoiceGroup(
            title: const LocalizedText(en: 'Difficulty', ar: '╪د┘┘à╪│╪ز┘ê┘ë'),
            selectedValue: _selectedDifficulty,
            options: const [
              _ChoiceOption(
                value: 'easy',
                label: LocalizedText(en: 'Easy', ar: '╪│┘ç┘'),
              ),
              _ChoiceOption(
                value: 'medium',
                label: LocalizedText(en: 'Medium', ar: '┘à╪ز┘ê╪│╪╖'),
              ),
              _ChoiceOption(
                value: 'advanced',
                label: LocalizedText(en: 'Advanced', ar: '┘à╪ز┘é╪»┘à'),
              ),
            ],
            onSelected: (value) => setState(() => _selectedDifficulty = value),
          ),
          const SizedBox(height: AppSpacing.lg),
          _LearningChoiceGroup(
            title: const LocalizedText(en: 'Duration', ar: '╪د┘┘à╪»╪ر'),
            selectedValue: _selectedDuration,
            options: const [
              _ChoiceOption(
                value: 'short',
                label: LocalizedText(en: '1-2 hours', ar: '1-2 ╪│╪د╪╣╪ر'),
              ),
              _ChoiceOption(
                value: 'medium',
                label: LocalizedText(en: '3-4 hours', ar: '3-4 ╪│╪د╪╣╪د╪ز'),
              ),
              _ChoiceOption(
                value: 'long',
                label: LocalizedText(en: '5+ hours', ar: '5+ ╪│╪د╪╣╪د╪ز'),
              ),
            ],
            onSelected: (value) => setState(() => _selectedDuration = value),
          ),
          const SizedBox(height: AppSpacing.xl),
          _SectionHeading(
            title: const LocalizedText(
              en: 'Description and build notes',
              ar: '╪د┘┘ê╪╡┘ ┘ê┘à┘╪د╪ص╪╕╪د╪ز ╪د┘╪ز┘┘┘è╪░',
            ),
            subtitle: const LocalizedText(
              en: 'Components, steps, and links are optional, but they improve review quality.',
              ar: '╪د┘┘à┘â┘ê┘╪د╪ز ┘ê╪د┘╪«╪╖┘ê╪د╪ز ┘ê╪د┘╪▒┘ê╪د╪ذ╪╖ ╪د╪«╪ز┘è╪د╪▒┘è╪ر╪î ┘┘â┘┘ç╪د ╪ز╪│╪د╪╣╪» ┘┘è ╪ز╪ص╪│┘è┘ ╪ش┘ê╪»╪ر ╪د┘┘à╪▒╪د╪ش╪╣╪ر.',
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          AppTextArea(
            controller: _summaryController,
            label: 'Short description',
            hint: 'Summarize what the learner will build.',
            minLines: 2,
            maxLines: 4,
            validator: _validateSummary,
          ),
          const SizedBox(height: AppSpacing.md),
          AppTextArea(
            controller: _descriptionController,
            label: 'Full description (optional)',
            hint: 'Explain the project goal and expected outcome.',
            minLines: 4,
            maxLines: 8,
            validator: _validateDescription,
          ),
          const SizedBox(height: AppSpacing.md),
          LearningProjectComponentEditor(
            components: _componentEntries,
            materialCategories: materialCategories,
            validator: (_) => _validateComponentsField(),
            onChanged: (components) {
              setState(() {
                _componentEntries = components;
                _componentValidationMessage = null;
              });
            },
            onAdd: () {
              setState(() {
                _componentEntries = [
                  ..._componentEntries,
                  LearningProjectDraftComponent.empty(),
                ];
              });
            },
            onRemove: (index) {
              setState(() {
                final next = [..._componentEntries]..removeAt(index);
                _componentEntries = next.isEmpty
                    ? [LearningProjectDraftComponent.empty()]
                    : next;
              });
            },
          ),
          if (_componentValidationMessage != null) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              _componentValidationMessage!,
              style: AppTextStyles.body(context).copyWith(
                color: Theme.of(context).colorScheme.error,
              ),
            ),
          ],
          const SizedBox(height: AppSpacing.md),
          AppTextArea(
            controller: _stepsController,
            label: 'Implementation steps',
            hint:
                'One step per line. No need to write Step 1.\nConnect the sensor to the board.\nMount the components.\nTest readings.',
            minLines: 5,
            maxLines: 8,
            validator: _validateSteps,
          ),
          const SizedBox(height: AppSpacing.md),
          AppTextArea(
            controller: _linksController,
            label: 'Helpful links',
            hint: 'https://example.com/reference-guide',
            minLines: 2,
            maxLines: 4,
            validator: _validateLinks,
          ),
          const SizedBox(height: AppSpacing.xl),
          Text(
            LocalizedText(
              en: summary.resolveEn(),
              ar: summary.resolveAr(),
            ).resolve(context),
            style: AppTextStyles.body(context).copyWith(
              color: palette.textSecondary,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          LayoutBuilder(
            builder: (context, constraints) {
              final compact = constraints.maxWidth < 560;
              final saveButton = OutlinedButton.icon(
                onPressed: _isSavingDraft || _isSubmitting
                    ? null
                    : _saveLocalDraft,
                icon: _isSavingDraft
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.save_outlined),
                label: Text(
                  _isSavingDraft ? 'Saving draft...' : 'Save draft locally',
                ),
              );
              final submitButton = AppPrimaryButton(
                label: _isSubmitting ? 'Submitting...' : 'Submit for review',
                isLoading: _isSubmitting,
                onPressed: _isSavingDraft ? null : _submitForReview,
              );

              if (compact) {
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    saveButton,
                    const SizedBox(height: AppSpacing.md),
                    submitButton,
                  ],
                );
              }

              return Row(
                children: [
                  Expanded(child: saveButton),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(child: submitButton),
                ],
              );
            },
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            const LocalizedText(
              en: 'Submitting sends the project to admin review. Local drafts stay on this device only.',
              ar: '╪د┘╪ح╪▒╪│╪د┘ ┘è┘ê╪ش┘ّ┘ç ╪د┘┘à╪┤╪▒┘ê╪╣ ┘┘à╪▒╪د╪ش╪╣╪ر ╪د┘╪ح╪»╪د╪▒╪ر. ╪د┘┘à╪│┘ê╪»╪د╪ز ╪د┘┘à╪ص┘┘è╪ر ╪ز╪ذ┘é┘ë ╪╣┘┘ë ┘ç╪░╪د ╪د┘╪ش┘ç╪د╪▓ ┘┘é╪╖.',
            ).resolve(context),
            style: AppTextStyles.body(
              context,
            ).copyWith(color: palette.textSecondary),
          ),
        ],
      ),
    );
  }
}

class _AddDraftHeader extends StatelessWidget {
  const _AddDraftHeader({required this.onBack});

  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      decoration: BoxDecoration(
        borderRadius: AppRadius.xlAll,
        gradient: LinearGradient(
          begin: AlignmentDirectional.topStart,
          end: AlignmentDirectional.bottomEnd,
          colors: [palette.heroStart, palette.heroAccent, palette.heroEnd],
        ),
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Wrap(
        spacing: AppSpacing.lg,
        runSpacing: AppSpacing.md,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          SizedBox(
            width: 56,
            height: 56,
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: palette.cardSurface.withValues(alpha: 0.14),
                borderRadius: AppRadius.lgAll,
                border: Border.all(color: palette.borderSubtle),
              ),
              child: Icon(
                Icons.edit_note_rounded,
                color: palette.lime,
                size: 30,
              ),
            ),
          ),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 760),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  const LocalizedText(
                    en: 'Add project draft',
                    ar: '╪ح╪╢╪د┘╪ر ┘à╪│┘ê╪»╪ر ┘à╪┤╪▒┘ê╪╣',
                  ).resolve(context),
                  style: AppTextStyles.brandingHeadline(context).copyWith(
                    color: palette.textPrimary,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  const LocalizedText(
                    en: 'Save your work locally, then submit a complete project for admin review.',
                    ar: '╪د╪ص┘╪╕ ╪╣┘à┘┘â ┘à╪ص┘┘è╪د┘ï╪î ╪س┘à ╪ث╪▒╪│┘ ┘à╪┤╪▒┘ê╪╣╪د┘ï ┘à┘â╪ز┘à┘╪د┘ï ┘┘à╪▒╪د╪ش╪╣╪ر ╪د┘╪ح╪»╪د╪▒╪ر.',
                  ).resolve(context),
                  style: AppTextStyles.brandingSubtitle(
                    context,
                  ).copyWith(color: palette.textSecondary),
                ),
              ],
            ),
          ),
          TextButton.icon(
            onPressed: onBack,
            icon: const Icon(Icons.arrow_back_rounded),
            label: Text(
              const LocalizedText(
                en: 'Back to hub',
                ar: '╪د┘╪╣┘ê╪»╪ر ┘┘┘à╪▒┘â╪▓',
              ).resolve(context),
            ),
          ),
        ],
      ),
    );
  }
}

class _SupportColumn extends StatelessWidget {
  const _SupportColumn({required this.onBack});

  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _LearningPanel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.rule_rounded, color: AppColorTokens.lime),
              const SizedBox(height: AppSpacing.md),
              _SectionHeading(
                title: const LocalizedText(
                  en: 'Review checklist',
                  ar: '┘é╪د╪خ┘à╪ر ╪د┘┘à╪▒╪د╪ش╪╣╪ر',
                ),
                subtitle: const LocalizedText(
                  en: 'Required fields are title, category, summary, difficulty, and duration.',
                  ar: '╪د┘╪ص┘é┘ê┘ ╪د┘┘à╪╖┘┘ê╪ذ╪ر ┘ç┘è ╪د┘╪╣┘┘ê╪د┘ ┘ê╪د┘┘╪خ╪ر ┘ê╪د┘┘à┘╪«╪╡ ┘ê╪د┘┘à╪│╪ز┘ê┘ë ┘ê╪د┘┘à╪»╪ر.',
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              _ChecklistItem(
                text: const LocalizedText(
                  en: 'Use clear learner-facing language.',
                  ar: '╪د╪│╪ز╪«╪»┘à ┘╪║╪ر ┘ê╪د╪╢╪ص╪ر ┘┘┘à╪ز╪╣┘┘à┘è┘.',
                ),
              ),
              _ChecklistItem(
                text: const LocalizedText(
                  en: 'Add components and steps when you have them.',
                  ar: '╪ث╪╢┘ ╪د┘┘à┘â┘ê┘╪د╪ز ┘ê╪د┘╪«╪╖┘ê╪د╪ز ╪╣┘╪»┘à╪د ╪ز┘â┘ê┘ ┘à╪ز╪د╪ص╪ر.',
                ),
              ),
              _ChecklistItem(
                text: const LocalizedText(
                  en: 'Links must be valid http or https URLs.',
                  ar: '┘è╪ش╪ذ ╪ث┘ ╪ز┘â┘ê┘ ╪د┘╪▒┘ê╪د╪ذ╪╖ ╪ذ╪╡┘è╪║╪ر http ╪ث┘ê https ╪╡╪ص┘è╪ص╪ر.',
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        const _DraftReviewScopePanel(),
        const SizedBox(height: AppSpacing.lg),
        OutlinedButton.icon(
          onPressed: onBack,
          icon: const Icon(Icons.school_outlined),
          label: Text(
            const LocalizedText(
              en: 'Browse Learning Hub',
              ar: '╪ز╪╡┘╪ص ┘à╪▒┘â╪▓ ╪د┘╪ز╪╣┘┘à',
            ).resolve(context),
          ),
        ),
      ],
    );
  }
}

class _DraftReviewScopePanel extends StatelessWidget {
  const _DraftReviewScopePanel();

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);

    return _LearningPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.fact_check_outlined, color: palette.lime),
          const SizedBox(height: AppSpacing.md),
          _SectionHeading(
            title: const LocalizedText(
              en: 'What happens after submit?',
              ar: 'ماذا يحدث بعد الإرسال؟',
            ),
            subtitle: const LocalizedText(
              en: 'Your draft enters the project review queue. Once approved, it becomes visible in Learning Hub for browsing, ratings, likes, saves, and future build workflows.',
              ar: 'تدخل مسودتك في قائمة مراجعة المشاريع. بعد الموافقة، تظهر في مركز التعلم للتصفح والتقييمات والإعجابات والحفظ ومسارات البناء القادمة.',
            ),
          ),
        ],
      ),
    );
  }
}

class _LearningPanel extends StatelessWidget {
  const _LearningPanel({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);

    return Container(
      width: double.infinity,
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: palette.cardSurface,
        borderRadius: AppRadius.xlAll,
        border: Border.all(color: palette.borderSubtle),
        boxShadow: [
          BoxShadow(
            color: palette.cardShadow.withValues(alpha: 0.48),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: child,
    );
  }
}

class _SectionHeading extends StatelessWidget {
  const _SectionHeading({required this.title, required this.subtitle});

  final LocalizedText title;
  final LocalizedText subtitle;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title.resolve(context),
          style: AppTextStyles.title(
            context,
          ).copyWith(color: palette.textPrimary),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          subtitle.resolve(context),
          style: AppTextStyles.body(
            context,
          ).copyWith(color: palette.textSecondary),
        ),
      ],
    );
  }
}

class _LearningChoiceGroup extends StatelessWidget {
  const _LearningChoiceGroup({
    required this.title,
    required this.options,
    required this.selectedValue,
    required this.onSelected,
  });

  final LocalizedText title;
  final List<_ChoiceOption> options;
  final String selectedValue;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title.resolve(context),
          style: AppTextStyles.label(
            context,
          ).copyWith(color: palette.textPrimary),
        ),
        const SizedBox(height: AppSpacing.xs),
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: options.map((option) {
            final selected = option.value == selectedValue;
            return FilterChip(
              label: Text(option.label.resolve(context)),
              selected: selected,
              onSelected: (_) => onSelected(option.value),
              selectedColor: palette.lime,
              checkmarkColor: AppColorTokens.emeraldDeep,
              backgroundColor: palette.cardSurfaceAlt,
              side: BorderSide(
                color: selected ? palette.lime : palette.borderSubtle,
              ),
              labelStyle: AppTextStyles.label(context).copyWith(
                color: selected
                    ? AppColorTokens.emeraldDeep
                    : palette.textPrimary,
                fontWeight: selected ? FontWeight.w800 : FontWeight.w700,
              ),
            );
          }).toList(),
        ),
      ],
    );
  }
}

class _ChoiceOption {
  const _ChoiceOption({required this.value, required this.label});

  final String value;
  final LocalizedText label;
}

class _ChecklistItem extends StatelessWidget {
  const _ChecklistItem({required this.text});

  final LocalizedText text;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);

    return Padding(
      padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.sm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.check_circle_rounded, size: 18, color: palette.lime),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              text.resolve(context),
              style: AppTextStyles.body(
                context,
              ).copyWith(color: palette.textSecondary),
            ),
          ),
        ],
      ),
    );
  }
}
