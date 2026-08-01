import 'dart:async';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_color_tokens.dart';
import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../app/widgets/app_mobile_bottom_nav_bar.dart';
import '../../../../app/widgets/entry_nav_bar.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../shared/models/localized_text.dart';
import '../../../../shared/utils/content_text_direction.dart';
import '../../../../shared/widgets/app_dropdown_field.dart';
import '../../../../shared/widgets/app_feedback.dart';
import '../../../../shared/widgets/app_primary_button.dart';
import '../../../../shared/widgets/app_text_area.dart';
import '../../../../shared/widgets/app_text_field.dart';
import '../../../ai/data/ai_repository.dart';
import '../../../ai/domain/ai_helpers.dart';
import '../../../materials/data/models/category.dart';
import '../../application/learning_hub_providers.dart';
import '../../domain/models/learning_project.dart';
import '../../domain/models/learning_project_submission.dart';
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
  bool _isSavingDraft = false;
  late String _saveIdempotencyKey;
  String? _savedProjectId;
  bool _savedHasProjectImage = false;

  bool _copilotOpen = false;
  bool _copilotSending = false;
  String? _copilotError;
  final List<_ManualDraftCopilotTurn> _copilotMessages = [];
  final TextEditingController _copilotComposer = TextEditingController();
  final ScrollController _copilotScrollController = ScrollController();
  final FocusNode _copilotComposerFocus = FocusNode();

  @override
  void initState() {
    super.initState();
    _titleController = TextEditingController();
    _summaryController = TextEditingController();
    _descriptionController = TextEditingController();
    _stepsController = TextEditingController();
    _linksController = TextEditingController();
    _saveIdempotencyKey = _newIdempotencyKey();
    unawaited(_restoreLocalDraft());
  }

  @override
  void dispose() {
    _titleController.dispose();
    _summaryController.dispose();
    _descriptionController.dispose();
    _stepsController.dispose();
    _linksController.dispose();
    _copilotComposer.dispose();
    _copilotScrollController.dispose();
    _copilotComposerFocus.dispose();
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

  Future<void> _saveCanonicalDraft() async {
    FocusScope.of(context).unfocus();
    if (_isSavingDraft) {
      return;
    }

    final minimumError = _validateMinimumDraftSave();
    if (minimumError != null) {
      showInfoSnackBar(context, minimumError);
      return;
    }

    final categories =
        ref.read(projectCategoriesProvider).value ?? const <MaterialCategory>[];
    final category = _selectedProjectCategory(categories)!;
    final repository = ref.read(learningHubRepositoryProvider);
    final locale = resolveAiLocale(context);

    setState(() => _isSavingDraft = true);
    try {
      var projectId = _savedProjectId;
      if (projectId == null) {
        final session = await repository.createAiAuthoringDraft(
          ideaText: _deriveIdeaText(),
          categoryId: category.id,
          difficulty: _mapDifficulty(_selectedDifficulty),
          idempotencyKey: _saveIdempotencyKey,
          locale: locale,
        );
        projectId = session.learningProjectId;
      }

      final updated = await repository.updateMyLearningProjectSubmission(
        projectId,
        _buildSavePayload(category.id),
      );

      await ref.read(learningProjectDraftStorageProvider).clearDraft();
      if (!mounted) {
        return;
      }

      setState(() {
        _savedProjectId = projectId;
        _savedHasProjectImage = _submissionHasPersistedImage(updated);
        _isSavingDraft = false;
      });

      showInfoSnackBar(
        context,
        const LocalizedText(
          en:
              'Draft saved. You can add images and submit it for review when it is ready.',
          ar:
              'تم حفظ المسودة. يمكنك إضافة الصور وإرسالها للمراجعة عندما تصبح جاهزة.',
        ).resolve(context),
      );
      context.go('/learning/submissions/$projectId');
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() => _isSavingDraft = false);
      showErrorSnackBar(context, error);
    }
  }

  String _deriveIdeaText() {
    final parts = <String>[
      _titleController.text.trim(),
      _summaryController.text.trim(),
      _descriptionController.text.trim(),
    ].where((part) => part.isNotEmpty);
    return parts.join('. ');
  }

  String? _validateMinimumDraftSave() {
    final categories =
        ref.read(projectCategoriesProvider).value ?? const <MaterialCategory>[];
    if (_selectedProjectCategory(categories) == null) {
      return const LocalizedText(
        en: 'Select an available project category before saving.',
        ar: 'اختر فئة مشروع متاحة قبل الحفظ.',
      ).resolve(context);
    }

    if (_deriveIdeaText().length < 10) {
      return const LocalizedText(
        en: 'Add at least 10 characters of project content before saving.',
        ar: 'أضف 10 أحرف على الأقل من محتوى المشروع قبل الحفظ.',
      ).resolve(context);
    }

    return null;
  }

  Map<String, dynamic> _buildSavePayload(String categoryId) {
    final shortDescription = _summaryController.text.trim();
    final fullDescription = _descriptionController.text.trim();
    final title = _titleController.text.trim();
    final fallbackDescription = _deriveIdeaText();

    return {
      if (title.isNotEmpty) 'title': title,
      if (shortDescription.isNotEmpty) 'shortDescription': shortDescription,
      'description': fullDescription.isNotEmpty
          ? fullDescription
          : shortDescription.isNotEmpty
          ? shortDescription
          : fallbackDescription,
      'categoryId': categoryId,
      'difficulty': _mapDifficulty(_selectedDifficulty),
      'estimatedDurationMinutes': _mapDurationMinutes(_selectedDuration),
      'requiredComponents': _buildSubmitComponents(),
      'steps': LearningProjectStepText.parseStepsFromText(_stepsController.text),
      'links': _parseLinks(_linksController.text),
    };
  }

  bool _submissionHasPersistedImage(LearningProjectSubmission submission) {
    return submission.coverImageUrl?.trim().isNotEmpty == true;
  }

  double _pageContentGutter(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    const maxContentWidth = 1180.0;
    final centeredInset = width > maxContentWidth
        ? (width - maxContentWidth) / 2
        : 0.0;
    return centeredInset + AppSpacing.lg;
  }

  double _copilotPanelInset(BuildContext context) {
    return AppSpacing.lg;
  }

  double _copilotPanelWidth(BuildContext context) {
    final viewportWidth = MediaQuery.sizeOf(context).width;
    if (viewportWidth < 900) {
      return viewportWidth;
    }

    final maxPanelWidth = viewportWidth * 0.34;
    final target = switch (viewportWidth) {
      >= 1400 => 480.0,
      >= 1200 => 460.0,
      >= 1000 => 420.0,
      _ => 400.0,
    };
    final cappedTarget = min(target, maxPanelWidth);
    final lowerBound = min(390.0, maxPanelWidth);
    return cappedTarget.clamp(lowerBound, maxPanelWidth);
  }

  double _copilotFormEndPadding(BuildContext context) {
    if (!_copilotOpen || MediaQuery.sizeOf(context).width < 900) {
      return 0;
    }
    return _copilotPanelWidth(context) + (_copilotPanelInset(context) * 2);
  }

  String _newIdempotencyKey() {
    const alphabet =
        'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    final random = Random.secure();
    final suffix = List.generate(
      32,
      (_) => alphabet[random.nextInt(alphabet.length)],
    ).join();
    return 'learning-draft-save-$suffix';
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

  Map<String, dynamic> _buildCopilotDraftContext(
    List<MaterialCategory> categories,
  ) {
    final category = _selectedProjectCategory(categories);
    final categoryLabel = category == null
        ? null
        : LocalizedText(
            en: category.nameEn,
            ar: category.nameAr.isEmpty ? category.nameEn : category.nameAr,
          ).resolve(context);

    return {
      'title': _titleController.text.trim(),
      'categoryLabel': categoryLabel,
      'difficulty': _selectedDifficulty,
      'durationLabel': _selectedDuration,
      'shortDescription': _summaryController.text.trim(),
      'fullDescription': _resolvedFullDescription(),
      'components': _componentEntries
          .where((component) => component.name.trim().isNotEmpty)
          .map(
            (component) => {
              'name': component.name.trim(),
              'quantity': component.quantity.toString(),
              'unit': component.unit,
              'role': component.role.apiValue,
            },
          )
          .toList(growable: false),
      'steps': _nonEmptyLines(_stepsController.text),
      'links': _nonEmptyLines(_linksController.text),
      'draftSaved': _savedProjectId != null,
      'projectId': _savedProjectId,
      'hasPersistedProjectImage': _savedHasProjectImage,
    };
  }

  Future<void> _sendCopilotMessage(String text) async {
    final trimmed = text.trim();
    if (trimmed.isEmpty || _copilotSending) {
      return;
    }

    final categories = ref.read(projectCategoriesProvider).value ??
        const <MaterialCategory>[];
    final locale = resolveAiLocale(context);
    final userTurn = _ManualDraftCopilotTurn(role: 'user', text: trimmed);

    setState(() {
      _copilotSending = true;
      _copilotError = null;
      _copilotMessages.add(userTurn);
    });
    _copilotComposer.clear();
    _scheduleCopilotScroll();

    try {
      final response = await ref.read(aiApiProvider).sendManualDraftCopilotMessage(
            text: trimmed,
            locale: locale,
            clientMessageId: createClientMessageId(),
            draftContext: _buildCopilotDraftContext(categories),
            history: _copilotMessages
                .take(_copilotMessages.length - 1)
                .map(
                  (message) => {
                    'role': message.role,
                    'text': message.text,
                  },
                )
                .toList(growable: false),
          );

      if (!mounted) return;
      setState(() {
        _copilotMessages.add(
          _ManualDraftCopilotTurn(
            role: 'assistant',
            text: response.assistantText,
          ),
        );
        _copilotSending = false;
      });
      _scheduleCopilotScroll();
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _copilotSending = false;
        _copilotError = error.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _copilotSending = false;
        _copilotError = _ManualDraftCopilotL10n.errorGeneric.resolve(context);
      });
    }
  }

  void _scheduleCopilotScroll() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_copilotScrollController.hasClients) return;
      _copilotScrollController.animateTo(
        _copilotScrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeOut,
      );
    });
  }

  void _openCopilotPanel() {
    setState(() => _copilotOpen = true);
  }

  void _closeCopilotPanel() {
    setState(() => _copilotOpen = false);
  }

  Future<void> _copyCopilotText(String text) async {
    await Clipboard.setData(ClipboardData(text: text));
    if (!mounted) return;
    showInfoSnackBar(
      context,
      _ManualDraftCopilotL10n.copied.resolve(context),
    );
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
    final isWide = MediaQuery.sizeOf(context).width >= 900;
    final bottomInset = MediaQuery.paddingOf(context).bottom;
    final fabBottom = bottomInset + 24.0;
    final pageGutter = _pageContentGutter(context);
    final copilotPanelWidth = _copilotPanelWidth(context);
    final copilotPanelInset = _copilotPanelInset(context);
    final copilotPanel = _ManualDraftCopilotPanel(
      messages: _copilotMessages,
      sending: _copilotSending,
      error: _copilotError,
      composer: _copilotComposer,
      composerFocus: _copilotComposerFocus,
      scrollController: _copilotScrollController,
      draftSaved: _savedProjectId != null,
      hasPersistedProjectImage: _savedHasProjectImage,
      onClose: _closeCopilotPanel,
      onSend: _sendCopilotMessage,
      onQuickAction: _sendCopilotMessage,
      onCopy: _copyCopilotText,
    );

    return Scaffold(
      backgroundColor: palette.pageBackground,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const EntryNavBar(homeRoute: '/home', phoneTitle: 'Add project'),
            Expanded(
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  SingleChildScrollView(
                    padding: appMobileAwareScrollPadding(
                      context,
                      top: AppSpacing.md,
                      end: _copilotFormEndPadding(context),
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
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
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
                  if (_copilotOpen && isWide)
                    PositionedDirectional(
                      top: AppSpacing.md,
                      bottom: copilotPanelInset,
                      end: copilotPanelInset,
                      width: copilotPanelWidth,
                      child: Material(
                        elevation: 8,
                        borderRadius: AppRadius.xlAll,
                        clipBehavior: Clip.antiAlias,
                        child: copilotPanel,
                      ),
                    ),
                  if (_copilotOpen && !isWide)
                    Positioned.fill(
                      child: Material(
                        color: palette.pageBackground.withValues(alpha: 0.98),
                        child: copilotPanel,
                      ),
                    ),
                  if (!_copilotOpen)
                    Positioned(
                      left: 0,
                      right: 0,
                      bottom: fabBottom,
                      child: Padding(
                        padding: EdgeInsetsDirectional.only(end: pageGutter),
                        child: Align(
                          alignment: AlignmentDirectional.bottomEnd,
                          child: Semantics(
                            button: true,
                            label: _ManualDraftCopilotL10n.launcherTooltip
                                .resolve(context),
                            child: Tooltip(
                              message: _ManualDraftCopilotL10n.launcherTooltip
                                  .resolve(context),
                              child: Material(
                                elevation: 6,
                                color: AppThemeColors.of(context).primary,
                                shape: const CircleBorder(),
                                child: InkWell(
                                  customBorder: const CircleBorder(),
                                  onTap: _openCopilotPanel,
                                  child: const SizedBox(
                                    width: 56,
                                    height: 56,
                                    child: Icon(
                                      Icons.auto_awesome_rounded,
                                      color: Colors.white,
                                      size: 26,
                                    ),
                                  ),
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
          Text(
            const LocalizedText(
              en:
                  'Images are required before submitting for review. You can add them after saving the draft.',
              ar:
                  'الصور مطلوبة قبل الإرسال للمراجعة. يمكنك إضافتها بعد حفظ المسودة.',
            ).resolve(context),
            style: AppTextStyles.body(context).copyWith(
              color: palette.textSecondary,
            ),
          ),
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
          AppPrimaryButton(
            label: _isSavingDraft ? 'Saving draft...' : 'Save draft',
            isLoading: _isSavingDraft,
            onPressed: _isSavingDraft ? null : _saveCanonicalDraft,
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            const LocalizedText(
              en:
                  'Saving creates a private draft. You can add images and submit it for admin review afterward.',
              ar:
                  'الحفظ ينشئ مسودة خاصة. يمكنك إضافة الصور وإرسالها لمراجعة الإدارة لاحقاً.',
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
                    en:
                        'Document your project, save it as a private draft, then add images and submit for review.',
                    ar:
                        'وثّق مشروعك، واحفظه كمسودة خاصة، ثم أضف الصور وأرسله للمراجعة.',
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
              en: 'What happens after you save?',
              ar: 'ماذا يحدث بعد الحفظ؟',
            ),
            subtitle: const LocalizedText(
              en:
                  'Your draft is saved privately. Add project images on the draft details page, then submit for admin review when ready.',
              ar:
                  'تُحفظ مسودتك بشكل خاص. أضف صور المشروع في صفحة التفاصيل، ثم أرسلها لمراجعة الإدارة عندما تصبح جاهزة.',
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
              selectedColor: palette.limeSoft,
              checkmarkColor: palette.lime,
              backgroundColor: palette.cardSurfaceAlt,
              side: BorderSide(
                color: selected
                    ? palette.lime.withValues(alpha: 0.42)
                    : palette.borderSubtle,
              ),
              labelStyle: AppTextStyles.label(context).copyWith(
                color: selected ? palette.lime : palette.textPrimary,
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

class _ManualDraftCopilotTurn {
  const _ManualDraftCopilotTurn({required this.role, required this.text});

  final String role;
  final String text;
}

class _ManualDraftCopilotL10n {
  static const launcherTooltip = LocalizedText(
    en: 'AI writing assistant',
    ar: 'مساعد الكتابة بالذكاء الاصطناعي',
  );
  static const panelTitle = LocalizedText(
    en: 'Project writing assistant',
    ar: 'مساعد كتابة المشروع',
  );
  static const intro = LocalizedText(
    en:
        'Tell me what you built, even in simple words. I can help you turn it into a clear project title, description, component list, and steps.',
    ar:
        'أخبرني ماذا بنيت، حتى بكلمات بسيطة. أستطيع مساعدتك في تحويل ذلك إلى عنوان مشروع ووصف وقائمة مكوّنات وخطوات واضحة.',
  );
  static const composerHint = LocalizedText(
    en: 'Ask about your project draft...',
    ar: 'اسأل عن مسودة مشروعك...',
  );
  static const copied = LocalizedText(en: 'Copied', ar: 'تم النسخ');
  static const copy = LocalizedText(en: 'Copy', ar: 'نسخ');
  static const send = LocalizedText(en: 'Send', ar: 'إرسال');
  static const errorGeneric = LocalizedText(
    en: 'The writing assistant is temporarily unavailable. Try again.',
    ar: 'مساعد الكتابة غير متاح مؤقتاً. حاول مرة أخرى.',
  );
}

class _CopilotImageReminderCard extends StatelessWidget {
  const _CopilotImageReminderCard({
    required this.draftSaved,
    required this.hasPersistedProjectImage,
  });

  final bool draftSaved;
  final bool hasPersistedProjectImage;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final colors = AppThemeColors.of(context);

    if (draftSaved && hasPersistedProjectImage) {
      return Container(
        padding: const EdgeInsetsDirectional.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: colors.primarySoft,
          borderRadius: AppRadius.lgAll,
          border: Border.all(color: palette.borderSubtle),
        ),
        child: Row(
          children: [
            Icon(Icons.check_circle_rounded, color: colors.primary, size: 18),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Text(
                const LocalizedText(
                  en: 'Project image added.',
                  ar: 'تمت إضافة صورة المشروع.',
                ).resolve(context),
                style: AppTextStyles.label(context),
              ),
            ),
          ],
        ),
      );
    }

    final message = draftSaved
        ? const LocalizedText(
            en: 'Add at least one project image before submitting for review.',
            ar: 'أضف صورة مشروع واحدة على الأقل قبل الإرسال للمراجعة.',
          )
        : const LocalizedText(
            en:
                'Save the draft first. You can then add a project image before submitting it for review.',
            ar:
                'احفظ المسودة أولاً. يمكنك بعدها إضافة صورة مشروع قبل الإرسال للمراجعة.',
          );

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: palette.cardSurfaceAlt,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.photo_library_outlined, color: colors.primary, size: 18),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  message.resolve(context),
                  style: AppTextStyles.label(context),
                ),
              ),
            ],
          ),
          if (!draftSaved) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              const LocalizedText(
                en: 'You can add it after saving the draft.',
                ar: 'يمكنك إضافتها بعد حفظ المسودة.',
              ).resolve(context),
              style: AppTextStyles.body(context).copyWith(
                color: palette.textSecondary,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _ManualDraftCopilotPanel extends StatelessWidget {
  const _ManualDraftCopilotPanel({
    required this.messages,
    required this.sending,
    required this.error,
    required this.composer,
    required this.composerFocus,
    required this.scrollController,
    required this.draftSaved,
    required this.hasPersistedProjectImage,
    required this.onClose,
    required this.onSend,
    required this.onQuickAction,
    required this.onCopy,
  });

  final List<_ManualDraftCopilotTurn> messages;
  final bool sending;
  final String? error;
  final TextEditingController composer;
  final FocusNode composerFocus;
  final ScrollController scrollController;
  final bool draftSaved;
  final bool hasPersistedProjectImage;
  final VoidCallback onClose;
  final Future<void> Function(String text) onSend;
  final Future<void> Function(String text) onQuickAction;
  final Future<void> Function(String text) onCopy;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final colors = AppThemeColors.of(context);

    return Shortcuts(
      shortcuts: {
        LogicalKeySet(LogicalKeyboardKey.escape): const _CloseCopilotIntent(),
      },
      child: Actions(
        actions: {
          _CloseCopilotIntent: CallbackAction<_CloseCopilotIntent>(
            onInvoke: (_) {
              onClose();
              return null;
            },
          ),
        },
        child: Focus(
          autofocus: true,
          child: ColoredBox(
            color: palette.pageBackground,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Padding(
                  padding: const EdgeInsetsDirectional.fromSTEB(
                    AppSpacing.sm,
                    AppSpacing.sm,
                    AppSpacing.sm,
                    AppSpacing.xs,
                  ),
                  child: Row(
                    children: [
                      IconButton(
                        tooltip: MaterialLocalizations.of(context)
                            .closeButtonTooltip,
                        onPressed: onClose,
                        icon: const Icon(Icons.close_rounded),
                      ),
                      Icon(Icons.auto_awesome_rounded, color: colors.primary),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: Text(
                          _ManualDraftCopilotL10n.panelTitle.resolve(context),
                          style: AppTextStyles.title(context),
                        ),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: CustomScrollView(
                    controller: scrollController,
                    slivers: [
                      SliverPadding(
                        padding: const EdgeInsetsDirectional.fromSTEB(
                          AppSpacing.md,
                          0,
                          AppSpacing.md,
                          AppSpacing.sm,
                        ),
                        sliver: SliverToBoxAdapter(
                          child: Text(
                            _ManualDraftCopilotL10n.intro.resolve(context),
                            style: AppTextStyles.body(context).copyWith(
                              color: palette.textSecondary,
                            ),
                          ),
                        ),
                      ),
                      SliverPadding(
                        padding: const EdgeInsetsDirectional.fromSTEB(
                          AppSpacing.md,
                          0,
                          AppSpacing.md,
                          AppSpacing.sm,
                        ),
                        sliver: SliverToBoxAdapter(
                          child: Wrap(
                            spacing: AppSpacing.xs,
                            runSpacing: AppSpacing.xs,
                            children: _quickActions()
                                .map(
                                  (action) => ActionChip(
                                    label: Text(action.resolve(context)),
                                    onPressed: sending
                                        ? null
                                        : () => onQuickAction(
                                            action.resolve(context),
                                          ),
                                  ),
                                )
                                .toList(),
                          ),
                        ),
                      ),
                      SliverPadding(
                        padding: const EdgeInsetsDirectional.fromSTEB(
                          AppSpacing.md,
                          0,
                          AppSpacing.md,
                          AppSpacing.sm,
                        ),
                        sliver: SliverList(
                          delegate: SliverChildBuilderDelegate(
                            (context, index) {
                              if (index >= messages.length) {
                                return const Align(
                                  alignment: AlignmentDirectional.centerStart,
                                  child: SizedBox(
                                    width: 20,
                                    height: 20,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                    ),
                                  ),
                                );
                              }

                              final message = messages[index];
                              return Padding(
                                padding: const EdgeInsetsDirectional.only(
                                  bottom: AppSpacing.sm,
                                ),
                                child: LayoutBuilder(
                                  builder: (context, constraints) {
                                    return _ManualDraftCopilotMessageBubble(
                                      message: message,
                                      onCopy: onCopy,
                                      maxBubbleWidth:
                                          constraints.maxWidth * 0.96,
                                    );
                                  },
                                ),
                              );
                            },
                            childCount: messages.length + (sending ? 1 : 0),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                if (error != null)
                  Padding(
                    padding: const EdgeInsetsDirectional.fromSTEB(
                      AppSpacing.md,
                      0,
                      AppSpacing.md,
                      AppSpacing.xs,
                    ),
                    child: Text(
                      error!,
                      style: AppTextStyles.label(context).copyWith(
                        color: colors.danger,
                      ),
                    ),
                  ),
                Padding(
                  padding: const EdgeInsetsDirectional.fromSTEB(
                    AppSpacing.md,
                    0,
                    AppSpacing.md,
                    AppSpacing.xs,
                  ),
                  child: _CopilotImageReminderCard(
                    draftSaved: draftSaved,
                    hasPersistedProjectImage: hasPersistedProjectImage,
                  ),
                ),
                _ManualDraftCopilotComposer(
                  controller: composer,
                  focusNode: composerFocus,
                  sending: sending,
                  onSend: () => onSend(composer.text),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  List<LocalizedText> _quickActions() {
    return const [
      LocalizedText(
        en: 'Help me describe my project',
        ar: 'ساعدني في وصف مشروعي',
      ),
      LocalizedText(
        en: 'Suggest a project title',
        ar: 'اقترح عنواناً للمشروع',
      ),
      LocalizedText(
        en: 'Write a short description',
        ar: 'اكتب وصفاً قصيراً',
      ),
      LocalizedText(
        en: 'Improve my full description',
        ar: 'حسّن الوصف الكامل',
      ),
      LocalizedText(
        en: 'Organize my components',
        ar: 'نظّم المكوّنات',
      ),
      LocalizedText(
        en: 'Turn my notes into steps',
        ar: 'حوّل ملاحظاتي إلى خطوات',
      ),
      LocalizedText(
        en: 'Review my current draft',
        ar: 'راجع مسودتي الحالية',
      ),
      LocalizedText(
        en: 'What information is missing?',
        ar: 'ما المعلومات الناقصة؟',
      ),
    ];
  }
}

class _CloseCopilotIntent extends Intent {
  const _CloseCopilotIntent();
}

class _ManualDraftCopilotMessageBubble extends StatelessWidget {
  const _ManualDraftCopilotMessageBubble({
    required this.message,
    required this.onCopy,
    this.maxBubbleWidth,
  });

  final _ManualDraftCopilotTurn message;
  final Future<void> Function(String text) onCopy;
  final double? maxBubbleWidth;

  @override
  Widget build(BuildContext context) {
    final isUser = message.role == 'user';
    final palette = LearningUiPalette.of(context);
    final colors = AppThemeColors.of(context);
    final alignment = isUser
        ? AlignmentDirectional.centerEnd
        : AlignmentDirectional.centerStart;
    final background = isUser ? colors.primarySoft : palette.cardSurfaceAlt;

    return Align(
      alignment: alignment,
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxWidth: maxBubbleWidth ?? min(MediaQuery.sizeOf(context).width * 0.82, 420),
        ),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: background,
            borderRadius: AppRadius.lgAll,
            border: Border.all(color: palette.borderSubtle),
          ),
          child: Padding(
            padding: const EdgeInsetsDirectional.all(AppSpacing.md),
            child: isUser
                ? Text(
                    message.text,
                    textDirection: resolveContentTextDirection(message.text),
                    style: AppTextStyles.body(context),
                  )
                : _ManualDraftCopilotAssistantBody(
                    text: message.text,
                    onCopy: onCopy,
                  ),
          ),
        ),
      ),
    );
  }
}

class _ManualDraftCopilotAssistantBody extends StatelessWidget {
  const _ManualDraftCopilotAssistantBody({
    required this.text,
    required this.onCopy,
  });

  final String text;
  final Future<void> Function(String text) onCopy;

  @override
  Widget build(BuildContext context) {
    final sections = _parseCopilotSections(text);
    if (sections.length <= 1 && !text.contains('### ')) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            text,
            textDirection: resolveContentTextDirection(text),
            style: AppTextStyles.body(context),
          ),
          const SizedBox(height: AppSpacing.sm),
          Align(
            alignment: AlignmentDirectional.centerEnd,
            child: TextButton.icon(
              onPressed: () => onCopy(text),
              icon: const Icon(Icons.copy_rounded, size: 16),
              label: Text(_ManualDraftCopilotL10n.copy.resolve(context)),
            ),
          ),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final section in sections) ...[
          if (section.title != null)
            Text(
              section.title!,
              style: AppTextStyles.label(context),
            ),
          if (section.body.isNotEmpty) ...[
            if (section.title != null) const SizedBox(height: AppSpacing.xs),
            Text(
              section.body,
              textDirection: resolveContentTextDirection(section.body),
              style: AppTextStyles.body(context),
            ),
          ],
          Align(
            alignment: AlignmentDirectional.centerEnd,
            child: TextButton.icon(
              onPressed: () => onCopy(section.copyText),
              icon: const Icon(Icons.copy_rounded, size: 16),
              label: Text(_ManualDraftCopilotL10n.copy.resolve(context)),
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
        ],
      ],
    );
  }
}

class _CopilotSection {
  const _CopilotSection({this.title, required this.body});

  final String? title;
  final String body;

  String get copyText =>
      title == null ? body : '$title\n$body'.trim();
}

List<_CopilotSection> _parseCopilotSections(String text) {
  final lines = text.split('\n');
  final sections = <_CopilotSection>[];
  String? currentTitle;
  final buffer = StringBuffer();

  void flush() {
    final body = buffer.toString().trim();
    if (currentTitle != null || body.isNotEmpty) {
      sections.add(_CopilotSection(title: currentTitle, body: body));
    }
    buffer.clear();
    currentTitle = null;
  }

  for (final line in lines) {
    if (line.startsWith('### ')) {
      flush();
      currentTitle = line.substring(4).trim();
    } else {
      if (buffer.isNotEmpty) {
        buffer.writeln();
      }
      buffer.write(line);
    }
  }
  flush();
  return sections;
}

class _ManualDraftCopilotComposer extends StatelessWidget {
  const _ManualDraftCopilotComposer({
    required this.controller,
    required this.focusNode,
    required this.sending,
    required this.onSend,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final bool sending;
  final VoidCallback onSend;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);

    return Material(
      elevation: 6,
      child: Padding(
        padding: EdgeInsetsDirectional.fromSTEB(
          AppSpacing.md,
          AppSpacing.sm,
          AppSpacing.md,
          AppSpacing.md + MediaQuery.paddingOf(context).bottom,
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(
              child: TextField(
                controller: controller,
                focusNode: focusNode,
                minLines: 1,
                maxLines: 5,
                textInputAction: TextInputAction.newline,
                onSubmitted: (_) => onSend(),
                decoration: InputDecoration(
                  hintText: _ManualDraftCopilotL10n.composerHint.resolve(context),
                  filled: true,
                  fillColor: palette.cardSurfaceAlt,
                  border: OutlineInputBorder(
                    borderRadius: AppRadius.lgAll,
                    borderSide: BorderSide(color: palette.borderSubtle),
                  ),
                ),
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            IconButton.filled(
              tooltip: _ManualDraftCopilotL10n.send.resolve(context),
              onPressed: sending ? null : onSend,
              icon: sending
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.send_rounded),
            ),
          ],
        ),
      ),
    );
  }
}
