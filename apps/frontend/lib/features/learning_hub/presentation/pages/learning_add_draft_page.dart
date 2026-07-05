import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_color_tokens.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../core/errors/api_exception.dart';
import '../../application/learning_hub_providers.dart';
import '../../data/learning_hub_mock_data.dart';
import '../../domain/models/learning_project.dart';
import '../widgets/disabled_ai_panel.dart';
import '../widgets/learning_hub_text.dart';

class LearningAddDraftPage extends ConsumerStatefulWidget {
  const LearningAddDraftPage({super.key});

  @override
  ConsumerState<LearningAddDraftPage> createState() =>
      _LearningAddDraftPageState();
}

class _LearningAddDraftPageState extends ConsumerState<LearningAddDraftPage> {
  static const String _legacyTitleExample = 'Solar classroom weather station';
  static const String _legacySummaryExample =
      'A reusable classroom project that teaches sensors, power management, and simple data reporting using reclaimed materials.';
  static const String _legacyComponentsExample =
      'Arduino Uno, ultrasonic sensor, jumper wires, reused plastic box';
  static const String _legacyStepsExample =
      '1. Connect the sensor to the board.\n2. Mount the components inside the reused case.\n3. Test readings and adjust the placement.';
  static const String _legacyLinksExample =
      'https://example.com/reference-guide';

  late final TextEditingController _titleController;
  late final TextEditingController _summaryController;
  late final TextEditingController _componentsController;
  late final TextEditingController _stepsController;
  late final TextEditingController _linksController;

  String? _selectedCategory;
  String _selectedDifficulty = 'medium';
  String _selectedDuration = 'medium';
  bool _normalizedLegacyValues = false;
  bool _isSubmitting = false;

  String _mapDifficulty(String value) {
    switch (value) {
      case 'easy':
        return 'BEGINNER';
      case 'advanced':
        return 'ADVANCED';
      default:
        return 'INTERMEDIATE';
    }
  }

  int _mapDurationMinutes(String value) {
    switch (value) {
      case 'short':
        return 120;
      case 'long':
        return 300;
      default:
        return 240;
    }
  }

  String? _resolveCategoryId() {
    final categories = ref.read(projectCategoriesProvider).value;
    if (categories == null || categories.isEmpty) return null;

    final selected = _selectedCategory?.trim().toLowerCase();
    if (selected != null && selected.isNotEmpty) {
      for (final category in categories) {
        final name = category.nameEn.toLowerCase();
        if (name.contains(selected) || selected.contains(name)) {
          return category.id;
        }
      }
    }

    return categories.first.id;
  }

  List<Map<String, dynamic>> _parseComponents(String raw) {
    return raw
        .split(',')
        .map((part) => part.trim())
        .where((part) => part.isNotEmpty)
        .map((name) => {'name': name})
        .toList();
  }

  List<Map<String, dynamic>> _parseSteps(String raw) {
    final lines = raw
        .split('\n')
        .map((line) => line.trim())
        .where((line) => line.isNotEmpty);
    final steps = <Map<String, dynamic>>[];
    var index = 0;
    for (final line in lines) {
      index += 1;
      final cleaned = line.replaceFirst(RegExp(r'^\d+[\).\s-]+'), '').trim();
      steps.add({
        'title': 'Step $index',
        'description': cleaned.isEmpty ? line : cleaned,
      });
    }
    return steps;
  }

  List<Map<String, dynamic>> _parseLinks(String raw) {
    return raw
        .split('\n')
        .map((line) => line.trim())
        .where((line) => line.startsWith('http'))
        .map((url) => {'url': url})
        .toList();
  }

  Future<void> _submitForReview() async {
    final title = _titleController.text.trim();
    final summary = _summaryController.text.trim();
    if (title.length < 3 || summary.length < 10) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            const LocalizedText(
              en: 'Add a title and summary before submitting.',
              ar: 'أضف عنواناً وملخصاً قبل الإرسال.',
            ).resolve(context),
          ),
        ),
      );
      return;
    }

    final categoryId = _resolveCategoryId();
    if (categoryId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            const LocalizedText(
              en: 'Project categories are not available yet.',
              ar: 'فئات المشاريع غير متاحة بعد.',
            ).resolve(context),
          ),
        ),
      );
      return;
    }

    setState(() => _isSubmitting = true);
    try {
      final repository = ref.read(learningHubRepositoryProvider);
      await repository.submitProjectForReview(
        title: title,
        shortDescription: summary,
        description: summary,
        categoryId: categoryId,
        difficulty: _mapDifficulty(_selectedDifficulty),
        estimatedDurationMinutes: _mapDurationMinutes(_selectedDuration),
        requiredComponents: _parseComponents(_componentsController.text),
        steps: _parseSteps(_stepsController.text),
        links: _parseLinks(_linksController.text),
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            const LocalizedText(
              en: 'Your project was submitted for admin review.',
              ar: 'تم إرسال مشروعك لمراجعة الإدارة.',
            ).resolve(context),
          ),
        ),
      );
    } on ApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.displayMessage)));
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            const LocalizedText(
              en: 'Could not submit project for review.',
              ar: 'تعذر إرسال المشروع للمراجعة.',
            ).resolve(context),
          ),
        ),
      );
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  static const List<_ChoiceOption> _categoryOptions = [
    _ChoiceOption(
      value: 'robotics',
      text: LocalizedText(en: 'Robotics', ar: 'روبوتات'),
    ),
    _ChoiceOption(
      value: 'iot',
      text: LocalizedText(en: 'Internet of Things', ar: 'إنترنت الأشياء'),
    ),
    _ChoiceOption(
      value: 'energy',
      text: LocalizedText(en: 'Energy', ar: 'طاقة'),
    ),
    _ChoiceOption(
      value: 'handmade',
      text: LocalizedText(en: 'Handmade', ar: 'حرف يدوية'),
    ),
    _ChoiceOption(
      value: 'agriculture',
      text: LocalizedText(en: 'Agriculture', ar: 'زراعة'),
    ),
  ];

  static const List<_ChoiceOption> _difficultyOptions = [
    _ChoiceOption(
      value: 'easy',
      text: LocalizedText(en: 'Easy', ar: 'سهل'),
    ),
    _ChoiceOption(
      value: 'medium',
      text: LocalizedText(en: 'Medium', ar: 'متوسط'),
    ),
    _ChoiceOption(
      value: 'advanced',
      text: LocalizedText(en: 'Advanced', ar: 'متقدم'),
    ),
  ];

  static const List<_ChoiceOption> _durationOptions = [
    _ChoiceOption(
      value: 'short',
      text: LocalizedText(en: '1-2 hours', ar: '1-2 ساعة'),
    ),
    _ChoiceOption(
      value: 'medium',
      text: LocalizedText(en: '3-4 hours', ar: '3-4 ساعات'),
    ),
    _ChoiceOption(
      value: 'long',
      text: LocalizedText(en: '5+ hours', ar: '5+ ساعات'),
    ),
  ];

  @override
  void initState() {
    super.initState();
    _titleController = TextEditingController();
    _summaryController = TextEditingController();
    _componentsController = TextEditingController();
    _stepsController = TextEditingController();
    _linksController = TextEditingController();
    _selectedCategory = _categoryOptions[1].value;
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_normalizedLegacyValues) {
      return;
    }

    _clearLegacyMockValue(_titleController, _legacyTitleExample);
    _clearLegacyMockValue(_summaryController, _legacySummaryExample);
    _clearLegacyMockValue(_componentsController, _legacyComponentsExample);
    _clearLegacyMockValue(_stepsController, _legacyStepsExample);
    _clearLegacyMockValue(_linksController, _legacyLinksExample);

    _normalizedLegacyValues = true;
  }

  @override
  void dispose() {
    _titleController.dispose();
    _summaryController.dispose();
    _componentsController.dispose();
    _stepsController.dispose();
    _linksController.dispose();
    super.dispose();
  }

  void _clearLegacyMockValue(
    TextEditingController controller,
    String legacyValue,
  ) {
    if (controller.text.trim() == legacyValue.trim()) {
      controller.clear();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: learningPageBackground,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsetsDirectional.fromSTEB(
            AppSpacing.md,
            AppSpacing.md,
            AppSpacing.md,
            AppSpacing.xl,
          ),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 980),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _AddDraftHero(
                    title: const LocalizedText(
                      en: 'Add project draft',
                      ar: 'إضافة مسودة مشروع',
                    ),
                    subtitle: const LocalizedText(
                      en: 'Build a polished draft and submit it for admin review before it appears publicly.',
                      ar: 'أنشئ مسودة مشروع جاهزة وأرسلها لمراجعة الإدارة قبل أن تظهر علناً.',
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  _DraftSectionCard(
                    title: const LocalizedText(
                      en: 'Project basics',
                      ar: 'أساسيات المشروع',
                    ).resolve(context),
                    subtitle: const LocalizedText(
                      en: 'Define the project identity and the quick facts learners will scan first.',
                      ar: 'حدد هوية المشروع والمعلومات السريعة التي سيراها المتعلم أولاً.',
                    ).resolve(context),
                    child: LayoutBuilder(
                      builder: (context, constraints) {
                        final wide = constraints.maxWidth >= 720;
                        return Wrap(
                          spacing: AppSpacing.md,
                          runSpacing: AppSpacing.md,
                          children: [
                            _FormFieldShell(
                              width: wide
                                  ? (constraints.maxWidth - AppSpacing.md) / 2
                                  : constraints.maxWidth,
                              child: _DraftInputField(
                                controller: _titleController,
                                label: const LocalizedText(
                                  en: 'Project title',
                                  ar: 'عنوان المشروع',
                                ).resolve(context),
                                hint: const LocalizedText(
                                  en: 'Solar classroom weather station',
                                  ar: 'محطة طقس صفية شمسية',
                                ).resolve(context),
                              ),
                            ),
                            _FormFieldShell(
                              width: wide
                                  ? (constraints.maxWidth - AppSpacing.md) / 2
                                  : constraints.maxWidth,
                              child: _DraftDropdownField<String>(
                                label: const LocalizedText(
                                  en: 'Category',
                                  ar: 'الفئة',
                                ).resolve(context),
                                value: _selectedCategory,
                                hint: const LocalizedText(
                                  en: 'Select a category',
                                  ar: 'اختر فئة',
                                ).resolve(context),
                                items: _categoryOptions.map((option) {
                                  return DropdownMenuItem<String>(
                                    value: option.value,
                                    child: Text(option.text.resolve(context)),
                                  );
                                }).toList(),
                                onChanged: (value) {
                                  setState(() {
                                    _selectedCategory = value;
                                  });
                                },
                              ),
                            ),
                            _FormFieldShell(
                              width: wide
                                  ? (constraints.maxWidth - AppSpacing.md) / 2
                                  : constraints.maxWidth,
                              child: _ChoiceField(
                                label: const LocalizedText(
                                  en: 'Difficulty',
                                  ar: 'المستوى',
                                ).resolve(context),
                                options: _difficultyOptions,
                                selectedValue: _selectedDifficulty,
                                onSelected: (value) {
                                  setState(() {
                                    _selectedDifficulty = value;
                                  });
                                },
                              ),
                            ),
                            _FormFieldShell(
                              width: wide
                                  ? (constraints.maxWidth - AppSpacing.md) / 2
                                  : constraints.maxWidth,
                              child: _ChoiceField(
                                label: const LocalizedText(
                                  en: 'Duration',
                                  ar: 'المدة',
                                ).resolve(context),
                                options: _durationOptions,
                                selectedValue: _selectedDuration,
                                onSelected: (value) {
                                  setState(() {
                                    _selectedDuration = value;
                                  });
                                },
                              ),
                            ),
                          ],
                        );
                      },
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  _DraftSectionCard(
                    title: const LocalizedText(
                      en: 'Description and build notes',
                      ar: 'الوصف وملاحظات التنفيذ',
                    ).resolve(context),
                    subtitle: const LocalizedText(
                      en: 'Describe the idea clearly so future review and AI-assisted matching can connect to the right components later.',
                      ar: 'اشرح الفكرة بوضوح حتى تتمكن المراجعة والربط الذكي بالمكونات لاحقاً من فهم المشروع بدقة.',
                    ).resolve(context),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _DraftTextAreaField(
                          controller: _summaryController,
                          label: const LocalizedText(
                            en: 'Summary / description',
                            ar: 'الملخص / الوصف',
                          ).resolve(context),
                          hint: const LocalizedText(
                            en: 'Explain what learners will build and why the project matters. Example: A reusable classroom project that teaches sensors, power management, and simple data reporting using reclaimed materials.',
                            ar: 'اشرح ما الذي سيبنيه المتعلمون ولماذا هذا المشروع مهم. مثال: مشروع صفي معاد الاستخدام يعلّم الحساسات وإدارة الطاقة وعرض البيانات بمواد معاد تدويرها.',
                          ).resolve(context),
                          minLines: 4,
                          maxLines: 6,
                        ),
                        const SizedBox(height: AppSpacing.md),
                        _DraftTextAreaField(
                          controller: _componentsController,
                          label: const LocalizedText(
                            en: 'Required components',
                            ar: 'المكونات المطلوبة',
                          ).resolve(context),
                          hint: const LocalizedText(
                            en: 'Arduino Uno, ultrasonic sensor, jumper wires, reused plastic box',
                            ar: 'Arduino Uno، حساس فوق صوتي، أسلاك توصيل، علبة بلاستيكية معاد استخدامها',
                          ).resolve(context),
                          minLines: 3,
                          maxLines: 5,
                        ),
                        const SizedBox(height: AppSpacing.md),
                        _DraftTextAreaField(
                          controller: _stepsController,
                          label: const LocalizedText(
                            en: 'Implementation steps',
                            ar: 'خطوات التنفيذ',
                          ).resolve(context),
                          hint: const LocalizedText(
                            en: '1. Connect the sensor to the board.\n2. Mount the components inside the reused case.\n3. Test readings and adjust the placement.',
                            ar: '1. صل الحساس باللوحة.\n2. ثبّت المكونات داخل الغلاف المعاد استخدامه.\n3. اختبر القراءات واضبط الترتيب.',
                          ).resolve(context),
                          minLines: 5,
                          maxLines: 8,
                        ),
                        const SizedBox(height: AppSpacing.md),
                        _DraftInputField(
                          controller: _linksController,
                          label: const LocalizedText(
                            en: 'Helpful links',
                            ar: 'روابط مفيدة',
                          ).resolve(context),
                          hint: const LocalizedText(
                            en: 'https://example.com/reference-guide',
                            ar: 'https://example.com/reference-guide',
                          ).resolve(context),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  const DisabledAiPanel(),
                  const SizedBox(height: AppSpacing.lg),
                  LayoutBuilder(
                    builder: (context, constraints) {
                      final wide = constraints.maxWidth >= 640;
                      final saveButton = OutlinedButton.icon(
                        onPressed: () {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text(
                                const LocalizedText(
                                  en: 'Draft saving will be connected later.',
                                  ar: 'سيتم ربط حفظ المسودة لاحقاً.',
                                ).resolve(context),
                              ),
                            ),
                          );
                        },
                        icon: const Icon(Icons.save_outlined),
                        label: Text(
                          const LocalizedText(
                            en: 'Save draft',
                            ar: 'حفظ المسودة',
                          ).resolve(context),
                        ),
                        style: OutlinedButton.styleFrom(
                          minimumSize: const Size.fromHeight(54),
                          side: const BorderSide(color: learningBorderSubtle),
                          foregroundColor: learningTextPrimary,
                          backgroundColor: learningDarkSurfaceSoft,
                          shape: RoundedRectangleBorder(
                            borderRadius: AppRadius.lgAll,
                          ),
                        ),
                      );
                      final submitButton = FilledButton.icon(
                        onPressed: _isSubmitting ? null : _submitForReview,
                        icon: _isSubmitting
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : const Icon(Icons.arrow_forward_rounded),
                        label: Text(
                          const LocalizedText(
                            en: 'Submit for review',
                            ar: 'إرسال للمراجعة',
                          ).resolve(context),
                        ),
                        style: FilledButton.styleFrom(
                          minimumSize: const Size.fromHeight(54),
                          backgroundColor: learningLime,
                          foregroundColor: AppColorTokens.emeraldDeep,
                          shape: RoundedRectangleBorder(
                            borderRadius: AppRadius.lgAll,
                          ),
                        ),
                      );

                      return wide
                          ? Row(
                              children: [
                                Expanded(child: saveButton),
                                const SizedBox(width: AppSpacing.md),
                                Expanded(child: submitButton),
                              ],
                            )
                          : Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                saveButton,
                                const SizedBox(height: AppSpacing.md),
                                submitButton,
                              ],
                            );
                    },
                  ),
                  const SizedBox(height: AppSpacing.md),
                  Text(
                    const LocalizedText(
                      en: 'Submit sends your draft for admin review. It will not appear publicly until approved.',
                      ar: 'الإرسال يوجّه مسودتك لمراجعة الإدارة. لن تظهر علناً حتى تتم الموافقة.',
                    ).resolve(context),
                    style: AppTextStyles.subtitle(
                      context,
                    ).copyWith(color: learningTextSecondary),
                    textAlign: TextAlign.start,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _AddDraftHero extends StatelessWidget {
  const _AddDraftHero({required this.title, required this.subtitle});

  final LocalizedText title;
  final LocalizedText subtitle;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsetsDirectional.all(AppSpacing.xl),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: AlignmentDirectional.topStart,
          end: AlignmentDirectional.bottomEnd,
          colors: [learningHeroStart, learningHeroAccent, learningHeroEnd],
        ),
        borderRadius: AppRadius.xlAll,
        border: Border.all(color: learningBorderSubtle),
      ),
      child: Stack(
        children: [
          PositionedDirectional(
            top: -12,
            end: -4,
            child: Container(
              width: 132,
              height: 132,
              decoration: BoxDecoration(
                color: learningLime.withValues(alpha: 0.08),
                shape: BoxShape.circle,
              ),
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsetsDirectional.symmetric(
                  horizontal: AppSpacing.sm,
                  vertical: AppSpacing.xs,
                ),
                decoration: BoxDecoration(
                  color: learningDarkSurfaceSoft,
                  borderRadius: AppRadius.pillAll,
                  border: Border.all(color: learningBorderSubtle),
                ),
                child: Text(
                  const LocalizedText(
                    en: 'Review draft',
                    ar: 'مسودة للمراجعة',
                  ).resolve(context),
                  style: AppTextStyles.label(
                    context,
                  ).copyWith(color: learningTextPrimary),
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 56,
                    height: 56,
                    decoration: BoxDecoration(
                      color: learningDarkSurfaceSoft,
                      borderRadius: AppRadius.lgAll,
                      border: Border.all(color: learningBorderSubtle),
                    ),
                    child: const Icon(
                      Icons.edit_note_rounded,
                      color: learningLime,
                      size: 28,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          title.resolve(context),
                          style: AppTextStyles.brandingHeadline(context)
                              .copyWith(
                                color: learningTextPrimary,
                                fontWeight: FontWeight.w800,
                              ),
                          textAlign: TextAlign.start,
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        Text(
                          subtitle.resolve(context),
                          style: AppTextStyles.brandingSubtitle(
                            context,
                          ).copyWith(color: learningTextSecondary),
                          textAlign: TextAlign.start,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _DraftSectionCard extends StatelessWidget {
  const _DraftSectionCard({
    required this.title,
    required this.subtitle,
    required this.child,
  });

  final String title;
  final String subtitle;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: learningCardSurface,
        borderRadius: AppRadius.xlAll,
        border: Border.all(color: learningBorderSubtle),
        boxShadow: const [
          BoxShadow(
            color: AppColorTokens.shadow,
            blurRadius: 18,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: AppTextStyles.title(
              context,
            ).copyWith(color: learningTextPrimary),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            subtitle,
            style: AppTextStyles.subtitle(
              context,
            ).copyWith(color: learningTextSecondary),
            textAlign: TextAlign.start,
          ),
          const SizedBox(height: AppSpacing.lg),
          child,
        ],
      ),
    );
  }
}

class _FormFieldShell extends StatelessWidget {
  const _FormFieldShell({required this.width, required this.child});

  final double width;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return SizedBox(width: width, child: child);
  }
}

class _DraftInputField extends StatelessWidget {
  const _DraftInputField({
    required this.controller,
    required this.label,
    required this.hint,
  });

  final TextEditingController controller;
  final String label;
  final String hint;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      style: const TextStyle(color: learningTextPrimary),
      decoration: _draftDecoration(context: context, label: label, hint: hint),
    );
  }
}

class _DraftTextAreaField extends StatelessWidget {
  const _DraftTextAreaField({
    required this.controller,
    required this.label,
    required this.hint,
    required this.minLines,
    required this.maxLines,
  });

  final TextEditingController controller;
  final String label;
  final String hint;
  final int minLines;
  final int maxLines;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      minLines: minLines,
      maxLines: maxLines,
      keyboardType: TextInputType.multiline,
      style: const TextStyle(color: learningTextPrimary),
      decoration: _draftDecoration(
        context: context,
        label: label,
        hint: hint,
        alignLabelWithHint: true,
      ),
    );
  }
}

class _DraftDropdownField<T> extends StatelessWidget {
  const _DraftDropdownField({
    required this.label,
    required this.value,
    required this.hint,
    required this.items,
    required this.onChanged,
  });

  final String label;
  final T? value;
  final String hint;
  final List<DropdownMenuItem<T>> items;
  final ValueChanged<T?> onChanged;

  @override
  Widget build(BuildContext context) {
    return DropdownButtonFormField<T>(
      initialValue: value,
      items: items,
      onChanged: onChanged,
      dropdownColor: learningDarkSurface,
      style: const TextStyle(color: learningTextPrimary),
      iconEnabledColor: learningLime,
      decoration: _draftDecoration(context: context, label: label, hint: hint),
    );
  }
}

class _ChoiceField extends StatelessWidget {
  const _ChoiceField({
    required this.label,
    required this.options,
    required this.selectedValue,
    required this.onSelected,
  });

  final String label;
  final List<_ChoiceOption> options;
  final String selectedValue;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    return InputDecorator(
      decoration: _draftDecoration(context: context, label: label, hint: ''),
      child: Wrap(
        spacing: AppSpacing.sm,
        runSpacing: AppSpacing.sm,
        children: options.map((option) {
          final selected = option.value == selectedValue;
          return ChoiceChip(
            label: Text(option.text.resolve(context)),
            selected: selected,
            onSelected: (_) => onSelected(option.value),
            showCheckmark: false,
            selectedColor: learningLime,
            backgroundColor: learningDarkSurfaceSoft,
            side: BorderSide(
              color: selected ? learningLime : learningBorderSubtle,
            ),
            labelStyle: TextStyle(
              color: selected
                  ? AppColorTokens.emeraldDeep
                  : learningTextPrimary,
              fontWeight: FontWeight.w600,
            ),
          );
        }).toList(),
      ),
    );
  }
}

class _ChoiceOption {
  const _ChoiceOption({required this.value, required this.text});

  final String value;
  final LocalizedText text;
}

InputDecoration _draftDecoration({
  required BuildContext context,
  required String label,
  required String hint,
  bool alignLabelWithHint = false,
}) {
  return InputDecoration(
    labelText: label,
    hintText: hint,
    alignLabelWithHint: alignLabelWithHint,
    floatingLabelBehavior: FloatingLabelBehavior.always,
    filled: true,
    fillColor: learningCardSurfaceAlt,
    labelStyle: AppTextStyles.label(
      context,
    ).copyWith(color: learningTextPrimary),
    hintStyle: AppTextStyles.body(
      context,
    ).copyWith(color: learningTextSecondary),
    contentPadding: const EdgeInsetsDirectional.fromSTEB(
      AppSpacing.md,
      AppSpacing.md,
      AppSpacing.md,
      AppSpacing.md,
    ),
    enabledBorder: OutlineInputBorder(
      borderRadius: AppRadius.lgAll,
      borderSide: const BorderSide(color: learningBorderSubtle),
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: AppRadius.lgAll,
      borderSide: const BorderSide(color: learningLime, width: 1.5),
    ),
    border: OutlineInputBorder(
      borderRadius: AppRadius.lgAll,
      borderSide: const BorderSide(color: learningBorderSubtle),
    ),
  );
}
