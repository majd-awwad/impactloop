import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/widgets/app_mobile_bottom_nav_bar.dart';
import '../../../../app/widgets/entry_nav_bar.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../shared/models/localized_text.dart';
import '../../../../shared/utils/content_text_direction.dart';
import '../../../../shared/widgets/app_dropdown_field.dart';
import '../../../../shared/widgets/app_feedback.dart';
import '../../../../shared/widgets/app_link_button.dart';
import '../../../../shared/widgets/app_section_card.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/app_text_area.dart';
import '../../../ai/application/ai_assistant_shell_provider.dart';
import '../../../ai/application/authoring_workspace_controller.dart';
import '../../../ai/application/ai_chat_controller.dart';
import '../../../ai/domain/authoring_session_models.dart';
import '../../../ai/domain/ai_helpers.dart';
import '../../../ai/domain/ai_models.dart';
import '../../../ai/presentation/l10n/ai_l10n.dart';
import '../../../ai/presentation/widgets/ai_assistant_shell.dart';
import '../../../materials/data/models/category.dart';
import '../../application/learning_hub_providers.dart';
import '../../domain/models/learning_project_submission.dart';
import '../models/authoring_workspace_state.dart';
import '../theme/learning_ui_palette.dart';
import 'learning_project_submissions_page.dart';

const learningProjectCreateRoute = '/learning/create-project';
const learningProjectAiStarterRoute = '/learning/authoring/new';

String learningProjectAuthoringRoute(String projectId) =>
    '/learning/submissions/$projectId/author';

String learningProjectAuthoringAssistantRoute(String projectId) =>
    '/learning/submissions/$projectId/author/assistant';

AuthoringDraftSnapshot? authoringDraftSnapshotFromSubmission(
  LearningProjectSubmission? submission,
) {
  if (submission == null) {
    return null;
  }

  return maskAuthoringDraftPlaceholders(
    AuthoringDraftSnapshot(
      title: submission.title,
      shortDescription: submission.shortDescription,
      description: submission.description ?? '',
      difficulty: submission.difficulty,
      estimatedMinutes: submission.estimatedDurationMinutes,
      components: submission.requiredComponents
          .map(
            (component) => AiAuthoringProposalComponent(
              componentName: component.name,
              materialType: component.materialType ?? '',
              quantity: component.quantity,
              unit: component.unit,
              componentRole: component.role.apiValue,
              isRequired: component.isRequired,
              canBeSubstituted: component.canBeSubstituted,
              searchKeywords: component.searchKeywords,
              notes: component.notes,
            ),
          )
          .toList(growable: false),
      steps: submission.steps
          .map(
            (step) => AiAuthoringProposalStep(
              title: step.title,
              description: step.description,
            ),
          )
          .toList(growable: false),
    ),
  );
}

const int _authoringIdeaMinLength = 10;
const int _authoringIdeaMaxLength = 10000;
const double _authoringLayoutBreakpoint = 1120;
const double _authoringPanelMinWidth = 460;
const double _authoringPanelMaxWidth = 520;
const double _authoringPanelMaxWidthFraction = 0.34;
const double _authoringStarterMaxWidth = 760;
const double _createChoiceCompactBreakpoint = 720;

class LearningAuthoringL10n {
  const LearningAuthoringL10n._();

  static const createProject = LocalizedText(
    en: 'Create project',
    ar: 'إنشاء مشروع',
  );

  static const createChoiceTitle = LocalizedText(
    en: 'How would you like to start?',
    ar: 'كيف تريد البدء؟',
  );

  static const createChoiceSubtitle = LocalizedText(
    en: 'Choose the path that fits how you want to build your learning project.',
    ar: 'اختر الطريقة التي تناسب كيفية بناء مشروعك التعليمي.',
  );

  static const createManually = LocalizedText(
    en: 'Create manually',
    ar: 'إنشاء يدويًا',
  );

  static const createWithAi = LocalizedText(
    en: 'Create with AI',
    ar: 'إنشاء بالذكاء الاصطناعي',
  );

  static const recommendedBadge = LocalizedText(
    en: 'Recommended',
    ar: 'موصى به',
  );

  static const manualDescription = LocalizedText(
    en: 'Fill in the complete project form yourself.',
    ar: 'املأ نموذج المشروع الكامل بنفسك.',
  );

  static const aiDescription = LocalizedText(
    en: 'Start with your project idea and develop it with guided assistance.',
    ar: 'ابدأ بفكرة مشروعك وطوّرها بمساعدة موجهة.',
  );

  static const starterEyebrow = LocalizedText(
    en: 'Create with AI',
    ar: 'إنشاء بالذكاء الاصطناعي',
  );

  static const starterTitle = LocalizedText(
    en: 'Start with your project idea',
    ar: 'ابدأ بفكرة مشروعك',
  );

  static const starterSubtitle = LocalizedText(
    en: 'Describe what you want to build. You can review and edit every detail before submitting it.',
    ar: 'صف ما تريد بناءه. يمكنك مراجعة كل التفاصيل وتعديلها قبل الإرسال.',
  );

  static const ideaLabel = LocalizedText(
    en: 'Project idea',
    ar: 'فكرة المشروع',
  );

  static const ideaHint = LocalizedText(
    en: 'For example: a classroom weather station using recycled materials…',
    ar: 'مثال: محطة طقس صفية باستخدام مواد معاد تدويرها…',
  );

  static const ideaHelper = LocalizedText(
    en: 'A clear idea helps you shape the project as you refine the draft.',
    ar: 'الفكرة الواضحة تساعدك على تشكيل المشروع أثناء تحسين المسودة.',
  );

  static const authoringNotReady = LocalizedText(
    en: 'Guided authoring will appear here once the assistant is ready.',
    ar: 'سيظهر التأليف الموجّه هنا عندما يصبح المساعد جاهزًا.',
  );

  static const ideaExampleWatering = LocalizedText(
    en: 'Smart watering system',
    ar: 'نظام ري ذكي',
  );

  static const ideaExampleOrganizer = LocalizedText(
    en: 'Recycled wood organizer',
    ar: 'منظم خشب معاد تدويره',
  );

  static const ideaExampleAlarm = LocalizedText(
    en: 'Beginner Arduino alarm',
    ar: 'منبه Arduino للمبتدئين',
  );

  static const replaceIdeaTitle = LocalizedText(
    en: 'Replace your idea?',
    ar: 'هل تريد استبدال فكرتك؟',
  );

  static const replaceIdeaBody = LocalizedText(
    en: 'This will replace the text you already entered.',
    ar: 'سيؤدي ذلك إلى استبدال النص الذي أدخلته بالفعل.',
  );

  static const categoryLabel = LocalizedText(
    en: 'Project category',
    ar: 'فئة المشروع',
  );

  static const difficultyLabel = LocalizedText(en: 'Difficulty', ar: 'الصعوبة');

  static const difficultyBeginner = LocalizedText(en: 'Beginner', ar: 'مبتدئ');

  static const difficultyIntermediate = LocalizedText(
    en: 'Intermediate',
    ar: 'متوسط',
  );

  static const difficultyAdvanced = LocalizedText(en: 'Advanced', ar: 'متقدم');

  static const starterCallout = LocalizedText(
    en: 'You will be able to edit the title, description, components, and steps after the draft is created.',
    ar: 'ستتمكن من تعديل العنوان والوصف والمكونات والخطوات بعد إنشاء المسودة.',
  );

  static const createDraft = LocalizedText(
    en: 'Create draft',
    ar: 'إنشاء المسودة',
  );

  static const back = LocalizedText(en: 'Back', ar: 'رجوع');

  static const openAiAssistant = LocalizedText(
    en: 'Open AI assistant',
    ar: 'فتح مساعد الذكاء الاصطناعي',
  );

  static const continueWithAi = LocalizedText(
    en: 'Continue with AI',
    ar: 'متابعة بالذكاء الاصطناعي',
  );

  static const workspaceTitle = LocalizedText(
    en: 'AI-assisted project draft',
    ar: 'مسودة مشروع بمساعدة الذكاء الاصطناعي',
  );

  static const aiProjectAssistant = LocalizedText(
    en: 'AI project assistant',
    ar: 'مساعد مشروع الذكاء الاصطناعي',
  );

  static const foundationTitle = LocalizedText(
    en: 'Your project space is ready',
    ar: 'مساحة مشروعك جاهزة',
  );

  static const foundationCopy = LocalizedText(
    en: 'Your idea is saved. The assistant will help you refine and structure it in the next step.',
    ar: 'تم حفظ فكرتك. سيساعدك المساعد على تحسينها وتنظيمها في الخطوة التالية.',
  );

  static const draftStatus = LocalizedText(en: 'Draft', ar: 'مسودة');

  static const saveStateUnsaved = LocalizedText(
    en: 'Unsaved changes',
    ar: 'تغييرات غير محفوظة',
  );

  static const saveStateSaving = LocalizedText(
    en: 'Saving…',
    ar: 'جارٍ الحفظ…',
  );

  static const saveStateSaved = LocalizedText(en: 'Saved', ar: 'تم الحفظ');

  static const saveStateFailed = LocalizedText(
    en: 'Save failed',
    ar: 'فشل الحفظ',
  );

  static const loadingAuthoring = LocalizedText(
    en: 'Preparing authoring workspace…',
    ar: 'جارٍ تجهيز مساحة التأليف…',
  );

  static const projectNotDraft = LocalizedText(
    en: 'This project is no longer an editable draft.',
    ar: 'لم يعد هذا المشروع مسودة قابلة للتعديل.',
  );

  static const projectNotFound = LocalizedText(
    en: 'Project draft not found',
    ar: 'لم يتم العثور على مسودة المشروع',
  );

  static const collapseAssistant = LocalizedText(
    en: 'Hide assistant',
    ar: 'إخفاء المساعد',
  );

  static const showAssistant = LocalizedText(
    en: 'Show assistant',
    ar: 'إظهار المساعد',
  );
}

String newAuthoringIdempotencyKey() {
  const alphabet =
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  final random = Random.secure();
  final suffix = List.generate(
    32,
    (_) => alphabet[random.nextInt(alphabet.length)],
  ).join();
  return 'learning-authoring-$suffix';
}

double authoringPanelWidth(BuildContext context) {
  final totalWidth = MediaQuery.sizeOf(context).width;
  final maxByFraction = totalWidth * _authoringPanelMaxWidthFraction;
  return maxByFraction.clamp(_authoringPanelMinWidth, _authoringPanelMaxWidth);
}

bool isWideAuthoringLayout(BuildContext context) {
  return MediaQuery.sizeOf(context).width >= _authoringLayoutBreakpoint;
}

bool isCompactCreateChoiceLayout(BuildContext context) {
  return MediaQuery.sizeOf(context).width < _createChoiceCompactBreakpoint;
}

Future<void> showLearningProjectCreateChoice(BuildContext context) {
  if (isCompactCreateChoiceLayout(context)) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (sheetContext) {
        return SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsetsDirectional.fromSTEB(
              AppSpacing.md,
              AppSpacing.sm,
              AppSpacing.md,
              AppSpacing.lg,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  LearningAuthoringL10n.createChoiceTitle.resolve(context),
                  style: AppTextStyles.title(context),
                ),
                const SizedBox(height: AppSpacing.lg),
                _CreateChoiceCard(
                  icon: Icons.auto_awesome_outlined,
                  title: LearningAuthoringL10n.createWithAi,
                  description: LearningAuthoringL10n.aiDescription,
                  onPressed: () {
                    Navigator.of(sheetContext).pop();
                    context.go(learningProjectAiStarterRoute);
                  },
                  emphasized: true,
                ),
                const SizedBox(height: AppSpacing.md),
                _CreateChoiceCard(
                  icon: Icons.edit_note_outlined,
                  title: LearningAuthoringL10n.createManually,
                  description: LearningAuthoringL10n.manualDescription,
                  onPressed: () {
                    Navigator.of(sheetContext).pop();
                    context.go('/learning/add-draft');
                  },
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  return showDialog<void>(
    context: context,
    builder: (dialogContext) {
      return Dialog(
        insetPadding: const EdgeInsets.all(AppSpacing.lg),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 820),
          child: Padding(
            padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  LearningAuthoringL10n.createChoiceTitle.resolve(context),
                  style: AppTextStyles.title(context),
                ),
                const SizedBox(height: AppSpacing.lg),
                _CreateChoiceCard(
                  icon: Icons.auto_awesome_outlined,
                  title: LearningAuthoringL10n.createWithAi,
                  description: LearningAuthoringL10n.aiDescription,
                  onPressed: () {
                    Navigator.of(dialogContext).pop();
                    context.go(learningProjectAiStarterRoute);
                  },
                  emphasized: true,
                ),
                const SizedBox(height: AppSpacing.md),
                _CreateChoiceCard(
                  icon: Icons.edit_note_outlined,
                  title: LearningAuthoringL10n.createManually,
                  description: LearningAuthoringL10n.manualDescription,
                  onPressed: () {
                    Navigator.of(dialogContext).pop();
                    context.go('/learning/add-draft');
                  },
                ),
              ],
            ),
          ),
        ),
      );
    },
  );
}

class LearningProjectCreateChoicePage extends StatelessWidget {
  const LearningProjectCreateChoicePage({super.key});

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);

    return Scaffold(
      backgroundColor: palette.pageBackground,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const EntryNavBar(homeRoute: '/home'),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsetsDirectional.all(AppSpacing.md),
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 720),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          LearningAuthoringL10n.createChoiceTitle.resolve(
                            context,
                          ),
                          style: AppTextStyles.display(
                            context,
                          ).copyWith(color: palette.textPrimary),
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        Text(
                          LearningAuthoringL10n.createChoiceSubtitle.resolve(
                            context,
                          ),
                          style: AppTextStyles.body(
                            context,
                          ).copyWith(color: palette.textSecondary),
                        ),
                        const SizedBox(height: AppSpacing.lg),
                        _CreateChoiceCard(
                          icon: Icons.edit_note_outlined,
                          title: LearningAuthoringL10n.createManually,
                          description: LearningAuthoringL10n.manualDescription,
                          onPressed: () => context.go('/learning/add-draft'),
                        ),
                        const SizedBox(height: AppSpacing.md),
                        _CreateChoiceCard(
                          icon: Icons.auto_awesome_outlined,
                          title: LearningAuthoringL10n.createWithAi,
                          description: LearningAuthoringL10n.aiDescription,
                          onPressed: () =>
                              context.go(learningProjectAiStarterRoute),
                          emphasized: true,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: const AppMobileBottomNavBar(),
    );
  }
}

class _CreateChoiceCard extends StatelessWidget {
  const _CreateChoiceCard({
    required this.icon,
    required this.title,
    required this.description,
    required this.onPressed,
    this.emphasized = false,
  });

  final IconData icon;
  final LocalizedText title;
  final LocalizedText description;
  final VoidCallback onPressed;
  final bool emphasized;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);

    return Material(
      color: palette.cardSurface,
      borderRadius: AppRadius.lgAll,
      child: InkWell(
        onTap: onPressed,
        borderRadius: AppRadius.lgAll,
        child: Container(
          padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
          decoration: BoxDecoration(
            borderRadius: AppRadius.lgAll,
            border: Border.all(
              color: emphasized
                  ? palette.heroAccent.withValues(alpha: 0.45)
                  : palette.borderSubtle,
            ),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                icon,
                color: emphasized ? palette.heroAccent : palette.textSecondary,
                size: 28,
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
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
                      description.resolve(context),
                      style: AppTextStyles.body(
                        context,
                      ).copyWith(color: palette.textSecondary),
                    ),
                  ],
                ),
              ),
              Icon(
                Icons.arrow_forward_ios_rounded,
                size: 16,
                color: palette.textSecondary,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class LearningProjectAiStarterPage extends ConsumerStatefulWidget {
  const LearningProjectAiStarterPage({super.key});

  @override
  ConsumerState<LearningProjectAiStarterPage> createState() =>
      _LearningProjectAiStarterPageState();
}

class _LearningProjectAiStarterPageState
    extends ConsumerState<LearningProjectAiStarterPage> {
  final _formKey = GlobalKey<FormState>();
  final _ideaController = TextEditingController();
  String? _selectedCategoryId;
  String? _selectedDifficulty;
  bool _isSubmitting = false;
  late String _idempotencyKey;

  @override
  void initState() {
    super.initState();
    _idempotencyKey = newAuthoringIdempotencyKey();
  }

  Future<void> _applyIdeaExample(String example) async {
    if (_ideaController.text.trim().isNotEmpty) {
      final replace = await showDialog<bool>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: Text(LearningAuthoringL10n.replaceIdeaTitle.resolve(context)),
          content: Text(LearningAuthoringL10n.replaceIdeaBody.resolve(context)),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: Text(LearningAuthoringL10n.back.resolve(context)),
            ),
            FilledButton(
              onPressed: () => Navigator.of(dialogContext).pop(true),
              child: Text(LearningAuthoringL10n.createDraft.resolve(context)),
            ),
          ],
        ),
      );
      if (replace != true || !mounted) {
        return;
      }
    }
    setState(() => _ideaController.text = example);
  }

  @override
  void dispose() {
    _ideaController.dispose();
    super.dispose();
  }

  String? _validateIdea(String? value) {
    final trimmed = value?.trim() ?? '';
    if (trimmed.isEmpty) {
      return const LocalizedText(
        en: 'Project idea is required.',
        ar: 'فكرة المشروع مطلوبة.',
      ).resolve(context);
    }
    if (trimmed.length < _authoringIdeaMinLength) {
      return const LocalizedText(
        en: 'Project idea must be at least 10 characters.',
        ar: 'يجب أن تتكون فكرة المشروع من 10 أحرف على الأقل.',
      ).resolve(context);
    }
    if (trimmed.length > _authoringIdeaMaxLength) {
      return const LocalizedText(
        en: 'Project idea is too long.',
        ar: 'فكرة المشروع طويلة جداً.',
      ).resolve(context);
    }
    return null;
  }

  Future<void> _submit(List<MaterialCategory> categories) async {
    FocusScope.of(context).unfocus();
    if (!_formKey.currentState!.validate()) {
      return;
    }

    final categoryId = _selectedCategoryId;
    final difficulty = _selectedDifficulty;
    if (categoryId == null || difficulty == null) {
      return;
    }

    setState(() => _isSubmitting = true);
    try {
      final session = await ref
          .read(learningHubRepositoryProvider)
          .createAiAuthoringDraft(
            ideaText: _ideaController.text.trim(),
            categoryId: categoryId,
            difficulty: difficulty,
            idempotencyKey: _idempotencyKey,
            locale: resolveAiLocale(context),
          );

      if (!session.isTrustedDraftAuthoring) {
        throw const ApiException(
          message: 'Unexpected authoring response.',
          code: 'INVALID_AUTHORING_RESPONSE',
        );
      }

      _idempotencyKey = newAuthoringIdempotencyKey();
      if (!mounted) {
        return;
      }

      context.go(learningProjectAuthoringRoute(session.learningProjectId));
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }
      showErrorSnackBar(context, error);
    } on Object catch (_) {
      if (!mounted) {
        return;
      }
      showErrorSnackBar(
        context,
        const ApiException(
          message: 'Could not create the project draft. Please try again.',
          code: 'NETWORK_ERROR',
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final categoriesAsync = ref.watch(projectCategoriesProvider);
    final wideFields = MediaQuery.sizeOf(context).width >= 720;
    final ideaDirection = resolveContentTextDirection(_ideaController.text);

    return Scaffold(
      backgroundColor: palette.pageBackground,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const EntryNavBar(homeRoute: '/home'),
            Expanded(
              child: categoriesAsync.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (error, stackTrace) => _AuthoringStatePanel(
                  icon: Icons.cloud_off_outlined,
                  title: const LocalizedText(
                    en: 'Unable to load categories',
                    ar: 'تعذر تحميل الفئات',
                  ),
                  subtitle: const LocalizedText(
                    en: 'Check your connection and try again.',
                    ar: 'تحقق من الاتصال وحاول مرة أخرى.',
                  ),
                  actionLabel: AiL10n.retry,
                  onAction: () => ref.invalidate(projectCategoriesProvider),
                ),
                data: (categories) {
                  if (categories.isEmpty) {
                    return _AuthoringStatePanel(
                      icon: Icons.category_outlined,
                      title: const LocalizedText(
                        en: 'No project categories available',
                        ar: 'لا توجد فئات مشاريع متاحة',
                      ),
                      subtitle: const LocalizedText(
                        en: 'Try again later or create manually.',
                        ar: 'حاول لاحقًا أو أنشئ يدويًا.',
                      ),
                      actionLabel: LearningAuthoringL10n.createManually,
                      onAction: () => context.go('/learning/add-draft'),
                    );
                  }

                  return Align(
                    alignment: Alignment.topCenter,
                    child: SingleChildScrollView(
                      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
                      child: AppSectionCard(
                        padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(
                            maxWidth: _authoringStarterMaxWidth,
                          ),
                          child: Form(
                            key: _formKey,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Row(
                                  children: [
                                    Container(
                                      width: 40,
                                      height: 40,
                                      decoration: BoxDecoration(
                                        color: palette.heroAccent.withValues(
                                          alpha: 0.12,
                                        ),
                                        borderRadius: AppRadius.mdAll,
                                      ),
                                      child: Icon(
                                        Icons.auto_awesome_rounded,
                                        color: palette.heroAccent,
                                      ),
                                    ),
                                    const SizedBox(width: AppSpacing.sm),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            LearningAuthoringL10n.starterEyebrow
                                                .resolve(context),
                                            style: AppTextStyles.label(context)
                                                .copyWith(
                                                  color: palette.heroAccent,
                                                ),
                                          ),
                                          Text(
                                            LearningAuthoringL10n.starterTitle
                                                .resolve(context),
                                            style: AppTextStyles.title(context)
                                                .copyWith(
                                                  color: palette.textPrimary,
                                                ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: AppSpacing.sm),
                                Text(
                                  LearningAuthoringL10n.starterSubtitle.resolve(
                                    context,
                                  ),
                                  style: AppTextStyles.body(
                                    context,
                                  ).copyWith(color: palette.textSecondary),
                                ),
                                const SizedBox(height: AppSpacing.lg),
                                AppTextArea(
                                  controller: _ideaController,
                                  label: LearningAuthoringL10n.ideaLabel
                                      .resolve(context),
                                  hint: LearningAuthoringL10n.ideaHint.resolve(
                                    context,
                                  ),
                                  minLines: 4,
                                  maxLines: 8,
                                  validator: _validateIdea,
                                  textDirection: ideaDirection,
                                ),
                                const SizedBox(height: AppSpacing.xs),
                                Text(
                                  LearningAuthoringL10n.ideaHelper.resolve(
                                    context,
                                  ),
                                  style: AppTextStyles.label(
                                    context,
                                  ).copyWith(color: palette.textSecondary),
                                ),
                                const SizedBox(height: AppSpacing.sm),
                                Wrap(
                                  spacing: AppSpacing.xs,
                                  runSpacing: AppSpacing.xs,
                                  children: [
                                    for (final example in [
                                      LearningAuthoringL10n.ideaExampleWatering,
                                      LearningAuthoringL10n
                                          .ideaExampleOrganizer,
                                      LearningAuthoringL10n.ideaExampleAlarm,
                                    ])
                                      ActionChip(
                                        label: Text(example.resolve(context)),
                                        onPressed: _isSubmitting
                                            ? null
                                            : () => _applyIdeaExample(
                                                example.resolve(context),
                                              ),
                                      ),
                                  ],
                                ),
                                const SizedBox(height: AppSpacing.lg),
                                if (wideFields)
                                  Row(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Expanded(
                                        child: AppDropdownField<String>(
                                          label: LearningAuthoringL10n
                                              .categoryLabel
                                              .resolve(context),
                                          value: _selectedCategoryId,
                                          items: [
                                            for (final category in categories)
                                              DropdownMenuItem(
                                                value: category.id,
                                                child: Text(category.nameEn),
                                              ),
                                          ],
                                          onChanged: _isSubmitting
                                              ? null
                                              : (value) => setState(
                                                  () => _selectedCategoryId =
                                                      value,
                                                ),
                                          validator: (value) {
                                            if (value == null ||
                                                value.isEmpty) {
                                              return const LocalizedText(
                                                en: 'Select a project category.',
                                                ar: 'اختر فئة المشروع.',
                                              ).resolve(context);
                                            }
                                            return null;
                                          },
                                        ),
                                      ),
                                      const SizedBox(width: AppSpacing.md),
                                      Expanded(
                                        child: AppDropdownField<String>(
                                          label: LearningAuthoringL10n
                                              .difficultyLabel
                                              .resolve(context),
                                          value: _selectedDifficulty,
                                          items: [
                                            DropdownMenuItem(
                                              value: 'BEGINNER',
                                              child: Text(
                                                LearningAuthoringL10n
                                                    .difficultyBeginner
                                                    .resolve(context),
                                              ),
                                            ),
                                            DropdownMenuItem(
                                              value: 'INTERMEDIATE',
                                              child: Text(
                                                LearningAuthoringL10n
                                                    .difficultyIntermediate
                                                    .resolve(context),
                                              ),
                                            ),
                                            DropdownMenuItem(
                                              value: 'ADVANCED',
                                              child: Text(
                                                LearningAuthoringL10n
                                                    .difficultyAdvanced
                                                    .resolve(context),
                                              ),
                                            ),
                                          ],
                                          onChanged: _isSubmitting
                                              ? null
                                              : (value) {
                                                  if (value != null) {
                                                    setState(
                                                      () =>
                                                          _selectedDifficulty =
                                                              value,
                                                    );
                                                  }
                                                },
                                          validator: (value) {
                                            if (value == null ||
                                                value.isEmpty) {
                                              return const LocalizedText(
                                                en: 'Select a difficulty level.',
                                                ar: 'اختر مستوى الصعوبة.',
                                              ).resolve(context);
                                            }
                                            return null;
                                          },
                                        ),
                                      ),
                                    ],
                                  )
                                else ...[
                                  AppDropdownField<String>(
                                    label: LearningAuthoringL10n.categoryLabel
                                        .resolve(context),
                                    value: _selectedCategoryId,
                                    items: [
                                      for (final category in categories)
                                        DropdownMenuItem(
                                          value: category.id,
                                          child: Text(category.nameEn),
                                        ),
                                    ],
                                    onChanged: _isSubmitting
                                        ? null
                                        : (value) => setState(
                                            () => _selectedCategoryId = value,
                                          ),
                                    validator: (value) {
                                      if (value == null || value.isEmpty) {
                                        return const LocalizedText(
                                          en: 'Select a project category.',
                                          ar: 'اختر فئة المشروع.',
                                        ).resolve(context);
                                      }
                                      return null;
                                    },
                                  ),
                                  const SizedBox(height: AppSpacing.md),
                                  AppDropdownField<String>(
                                    label: LearningAuthoringL10n.difficultyLabel
                                        .resolve(context),
                                    value: _selectedDifficulty,
                                    items: [
                                      DropdownMenuItem(
                                        value: 'BEGINNER',
                                        child: Text(
                                          LearningAuthoringL10n
                                              .difficultyBeginner
                                              .resolve(context),
                                        ),
                                      ),
                                      DropdownMenuItem(
                                        value: 'INTERMEDIATE',
                                        child: Text(
                                          LearningAuthoringL10n
                                              .difficultyIntermediate
                                              .resolve(context),
                                        ),
                                      ),
                                      DropdownMenuItem(
                                        value: 'ADVANCED',
                                        child: Text(
                                          LearningAuthoringL10n
                                              .difficultyAdvanced
                                              .resolve(context),
                                        ),
                                      ),
                                    ],
                                    onChanged: _isSubmitting
                                        ? null
                                        : (value) {
                                            if (value != null) {
                                              setState(
                                                () =>
                                                    _selectedDifficulty = value,
                                              );
                                            }
                                          },
                                    validator: (value) {
                                      if (value == null || value.isEmpty) {
                                        return const LocalizedText(
                                          en: 'Select a difficulty level.',
                                          ar: 'اختر مستوى الصعوبة.',
                                        ).resolve(context);
                                      }
                                      return null;
                                    },
                                  ),
                                ],
                                const SizedBox(height: AppSpacing.md),
                                _StarterCallout(
                                  message: LearningAuthoringL10n.starterCallout
                                      .resolve(context),
                                ),
                                const SizedBox(height: AppSpacing.lg),
                                Row(
                                  children: [
                                    AppLinkButton(
                                      label: LearningAuthoringL10n.back.resolve(
                                        context,
                                      ),
                                      alignment: Alignment.centerLeft,
                                      onPressed: _isSubmitting
                                          ? null
                                          : () => context.go(
                                              learningProjectCreateRoute,
                                            ),
                                    ),
                                    const Spacer(),
                                    FilledButton(
                                      onPressed: _isSubmitting
                                          ? null
                                          : () => _submit(categories),
                                      child: _isSubmitting
                                          ? const SizedBox(
                                              width: 20,
                                              height: 20,
                                              child: CircularProgressIndicator(
                                                strokeWidth: 2,
                                              ),
                                            )
                                          : Text(
                                              LearningAuthoringL10n.createDraft
                                                  .resolve(context),
                                            ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: const AppMobileBottomNavBar(),
    );
  }
}

class _StarterCallout extends StatelessWidget {
  const _StarterCallout({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);

    return DecoratedBox(
      decoration: BoxDecoration(
        color: palette.hintSurface,
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: palette.hintBorder),
      ),
      child: Padding(
        padding: const EdgeInsetsDirectional.all(AppSpacing.md),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(
              Icons.lightbulb_outline_rounded,
              size: 18,
              color: palette.heroAccent,
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Text(
                message,
                style: AppTextStyles.body(
                  context,
                ).copyWith(color: palette.textSecondary),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class LearningProjectAuthoringWorkspacePage extends ConsumerStatefulWidget {
  const LearningProjectAuthoringWorkspacePage({
    super.key,
    required this.projectId,
  });

  final String projectId;

  @override
  ConsumerState<LearningProjectAuthoringWorkspacePage> createState() =>
      _LearningProjectAuthoringWorkspacePageState();
}

class _LearningProjectAuthoringWorkspacePageState
    extends ConsumerState<LearningProjectAuthoringWorkspacePage> {
  bool _initializing = true;
  Object? _initError;
  LearningProjectAuthoringSession? _session;
  bool _assistantPanelOpen = true;
  final ValueNotifier<AuthoringWorkspaceSaveState> _saveStateNotifier =
      ValueNotifier(AuthoringWorkspaceSaveState.unsaved);

  @override
  void dispose() {
    _saveStateNotifier.dispose();
    super.dispose();
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _initialize());
  }

  Future<void> _initialize() async {
    final locale = resolveAiLocale(context);
    setState(() {
      _initializing = true;
      _initError = null;
    });

    try {
      final submission = await ref.read(
        myLearningProjectSubmissionProvider(widget.projectId).future,
      );

      if (submission.status != LearningProjectSubmissionStatus.draft) {
        throw const ApiException(
          message: 'Project is not an editable draft.',
          code: 'PROJECT_NOT_DRAFT',
        );
      }

      final session = await ref
          .read(learningHubRepositoryProvider)
          .getOrCreateAuthoringConversation(
            projectId: widget.projectId,
            locale: locale,
          );

      if (session.learningProjectId != widget.projectId ||
          !session.isTrustedDraftAuthoring) {
        throw const ApiException(
          message: 'Authoring conversation could not be verified.',
          code: 'INVALID_AUTHORING_SESSION',
        );
      }

      ref.read(aiAssistantShellProvider.notifier).clearBuildGuideContext();
      ref
          .read(authoringActiveWorkspaceProvider.notifier)
          .activate(
            projectId: widget.projectId,
            conversationId: session.conversationId,
          );
      await ref
          .read(aiAssistantControllerProvider.notifier)
          .openConversation(session.conversationId);
      final chatState = ref.read(aiAssistantControllerProvider);
      final hasLegacyBlocks = ref
          .read(aiAssistantControllerProvider.notifier)
          .hasLegacyAuthoringWithoutSession;
      await ref
          .read(authoringWorkspaceControllerProvider.notifier)
          .activateAndLoad(
            projectId: widget.projectId,
            conversationId: session.conversationId,
            hasLegacyBlocks: hasLegacyBlocks,
          );

      if (!mounted) {
        return;
      }

      if (chatState.loadStatus == AiChatLoadStatus.ready &&
          !hasLegacyBlocks &&
          ref.read(authoringWorkspaceControllerProvider).snapshot == null) {
        // Session bootstrap handled by workspace controller.
      }

      setState(() {
        _session = session;
        _initializing = false;
      });
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _initError = error;
        _initializing = false;
      });
    } on Object catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _initError = error;
        _initializing = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final wide = isWideAuthoringLayout(context);
    final workspaceState = ref.watch(authoringWorkspaceControllerProvider);
    final submissionAsync = ref.watch(
      myLearningProjectSubmissionProvider(widget.projectId),
    );

    ref.listen(myLearningProjectSubmissionProvider(widget.projectId), (
      previous,
      next,
    ) {
      final submission = next.asData?.value;
      if (submission != null &&
          submission.status != LearningProjectSubmissionStatus.draft) {
        setState(() {
          _initError = const ApiException(
            message: 'Project is no longer an editable draft.',
            code: 'PROJECT_NOT_DRAFT',
          );
        });
      }
    });

    return Scaffold(
      backgroundColor: palette.pageBackground,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const EntryNavBar(homeRoute: '/home'),
            if (_initializing && workspaceState.snapshot == null)
              const Expanded(child: Center(child: CircularProgressIndicator()))
            else if (_initError != null)
              Expanded(
                child: _AuthoringStatePanel(
                  icon: Icons.error_outline,
                  title: LearningAuthoringL10n.projectNotFound,
                  subtitle: _initError is ApiException
                      ? LocalizedText(
                          en: (_initError as ApiException).message,
                          ar: (_initError as ApiException).message,
                        )
                      : const LocalizedText(
                          en: 'Something went wrong.',
                          ar: 'حدث خطأ ما.',
                        ),
                  actionLabel: AiL10n.retry,
                  onAction: _initialize,
                ),
              )
            else
              Expanded(
                child: submissionAsync.when(
                  loading: () =>
                      const Center(child: CircularProgressIndicator()),
                  error: (error, stackTrace) => _AuthoringStatePanel(
                    icon: Icons.search_off_outlined,
                    title: LearningAuthoringL10n.projectNotFound,
                    subtitle: const LocalizedText(
                      en: 'This draft may not exist or may belong to another learner.',
                      ar: 'قد لا توجد هذه المسودة أو قد تخص متعلمًا آخر.',
                    ),
                    actionLabel: const LocalizedText(
                      en: 'Back to submissions',
                      ar: 'العودة إلى الإرسالات',
                    ),
                    onAction: () => context.go('/learning/submissions'),
                  ),
                  data: (submission) {
                    if (submission.status !=
                        LearningProjectSubmissionStatus.draft) {
                      return _AuthoringStatePanel(
                        icon: Icons.lock_outline,
                        title: LearningAuthoringL10n.projectNotDraft,
                        subtitle: const LocalizedText(
                          en: 'Open the submission details to see its current status.',
                          ar: 'افتح تفاصيل الإرسال لمعرفة حالته الحالية.',
                        ),
                        actionLabel: const LocalizedText(
                          en: 'View submission',
                          ar: 'عرض الإرسال',
                        ),
                        onAction: () => context.go(
                          '/learning/submissions/${submission.id}',
                        ),
                      );
                    }

                    final editor = LearningProjectSubmissionEditPage(
                      submissionId: widget.projectId,
                      embeddedInAuthoringWorkspace: true,
                      saveStateNotifier: _saveStateNotifier,
                    );

                    final projectTitle = maskAuthoringDraftFieldTitle(
                      submission.title,
                    );

                    if (wide && _session != null && _assistantPanelOpen) {
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          _AuthoringWorkspaceToolbar(
                            projectTitle: projectTitle,
                            saveStateListenable: _saveStateNotifier,
                            showAssistantAction: true,
                            assistantPanelOpen: true,
                            onBack: () {
                              ref
                                  .read(
                                    authoringWorkspaceControllerProvider
                                        .notifier,
                                  )
                                  .deactivate();
                              ref
                                  .read(
                                    authoringActiveWorkspaceProvider.notifier,
                                  )
                                  .deactivate();
                              context.go('/learning/submissions');
                            },
                            onToggleAssistant: () =>
                                setState(() => _assistantPanelOpen = false),
                          ),
                          Expanded(
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Expanded(
                                  child: Padding(
                                    padding:
                                        const EdgeInsetsDirectional.fromSTEB(
                                          AppSpacing.md,
                                          0,
                                          AppSpacing.sm,
                                          AppSpacing.md,
                                        ),
                                    child: AppSectionCard(
                                      padding: EdgeInsets.zero,
                                      child: editor,
                                    ),
                                  ),
                                ),
                                AiProjectAuthoringSidePanel(
                                  width: authoringPanelWidth(context),
                                  projectUpdatedAt:
                                      submissionAsync.asData?.value.updatedAt ??
                                      _session?.updatedAt,
                                  draftSnapshot:
                                      authoringDraftSnapshotFromSubmission(
                                        submissionAsync.asData?.value,
                                      ),
                                  onClose: () => setState(
                                    () => _assistantPanelOpen = false,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      );
                    }

                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        _AuthoringWorkspaceToolbar(
                          projectTitle: projectTitle,
                          saveStateListenable: _saveStateNotifier,
                          showAssistantAction: _session != null,
                          assistantPanelOpen: false,
                          onBack: () {
                            ref
                                .read(
                                  authoringWorkspaceControllerProvider.notifier,
                                )
                                .deactivate();
                            ref
                                .read(authoringActiveWorkspaceProvider.notifier)
                                .deactivate();
                            context.go('/learning/submissions');
                          },
                          onOpenAssistant: () => context.go(
                            learningProjectAuthoringAssistantRoute(
                              widget.projectId,
                            ),
                          ),
                          onToggleAssistant: wide && _session != null
                              ? () => setState(() => _assistantPanelOpen = true)
                              : null,
                        ),
                        Expanded(
                          child: Padding(
                            padding: const EdgeInsetsDirectional.all(
                              AppSpacing.md,
                            ),
                            child: AppSectionCard(
                              padding: EdgeInsets.zero,
                              child: editor,
                            ),
                          ),
                        ),
                      ],
                    );
                  },
                ),
              ),
          ],
        ),
      ),
      bottomNavigationBar: const AppMobileBottomNavBar(),
    );
  }
}

class LearningProjectAuthoringAssistantPage extends ConsumerStatefulWidget {
  const LearningProjectAuthoringAssistantPage({
    super.key,
    required this.projectId,
  });

  final String projectId;

  @override
  ConsumerState<LearningProjectAuthoringAssistantPage> createState() =>
      _LearningProjectAuthoringAssistantPageState();
}

class _LearningProjectAuthoringAssistantPageState
    extends ConsumerState<LearningProjectAuthoringAssistantPage> {
  bool _initializing = true;
  Object? _initError;
  DateTime? _projectUpdatedAt;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _initialize());
  }

  @override
  void dispose() {
    super.dispose();
  }

  Future<void> _initialize() async {
    setState(() {
      _initializing = true;
      _initError = null;
    });

    try {
      final locale = resolveAiLocale(context);
      final submission = await ref.read(
        myLearningProjectSubmissionProvider(widget.projectId).future,
      );

      if (submission.status != LearningProjectSubmissionStatus.draft) {
        throw const ApiException(
          message: 'Project is not an editable draft.',
          code: 'PROJECT_NOT_DRAFT',
        );
      }

      final session = await ref
          .read(learningHubRepositoryProvider)
          .getOrCreateAuthoringConversation(
            projectId: widget.projectId,
            locale: locale,
          );

      if (session.learningProjectId != widget.projectId ||
          !session.isTrustedDraftAuthoring) {
        throw const ApiException(
          message: 'Authoring conversation could not be verified.',
          code: 'INVALID_AUTHORING_SESSION',
        );
      }

      ref.read(aiAssistantShellProvider.notifier).clearBuildGuideContext();
      await ref
          .read(aiAssistantControllerProvider.notifier)
          .openConversation(session.conversationId);

      if (!mounted) {
        return;
      }

      setState(() {
        _initializing = false;
        _projectUpdatedAt = session.updatedAt;
      });
    } on Object catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _initError = error;
        _initializing = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);

    return Scaffold(
      backgroundColor: palette.pageBackground,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsetsDirectional.fromSTEB(
                AppSpacing.xs,
                AppSpacing.sm,
                AppSpacing.md,
                AppSpacing.sm,
              ),
              child: Row(
                children: [
                  IconButton(
                    tooltip: LearningAuthoringL10n.back.resolve(context),
                    onPressed: () => context.go(
                      learningProjectAuthoringRoute(widget.projectId),
                    ),
                    icon: const Icon(Icons.arrow_back_rounded),
                  ),
                  Expanded(
                    child: Text(
                      LearningAuthoringL10n.aiProjectAssistant.resolve(context),
                      style: AppTextStyles.title(context),
                    ),
                  ),
                  AppStatusBadge(
                    label: LearningAuthoringL10n.draftStatus.resolve(context),
                    tone: AppStatusTone.neutral,
                  ),
                ],
              ),
            ),
            Expanded(
              child: _initializing
                  ? const Center(child: CircularProgressIndicator())
                  : _initError != null
                  ? _AuthoringStatePanel(
                      icon: Icons.error_outline,
                      title: LearningAuthoringL10n.projectNotFound,
                      subtitle: const LocalizedText(
                        en: 'Could not open the authoring assistant.',
                        ar: 'تعذر فتح مساعد التأليف.',
                      ),
                      actionLabel: AiL10n.retry,
                      onAction: _initialize,
                    )
                  : AiEmbeddedAuthoringAssistant(
                      projectUpdatedAt: _projectUpdatedAt,
                      draftSnapshot: authoringDraftSnapshotFromSubmission(
                        ref
                            .watch(
                              myLearningProjectSubmissionProvider(
                                widget.projectId,
                              ),
                            )
                            .asData
                            ?.value,
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AuthoringWorkspaceToolbar extends StatelessWidget {
  const _AuthoringWorkspaceToolbar({
    required this.projectTitle,
    required this.saveStateListenable,
    required this.showAssistantAction,
    required this.assistantPanelOpen,
    required this.onBack,
    this.onOpenAssistant,
    this.onToggleAssistant,
  });

  final String projectTitle;
  final ValueListenable<AuthoringWorkspaceSaveState> saveStateListenable;
  final bool showAssistantAction;
  final bool assistantPanelOpen;
  final VoidCallback onBack;
  final VoidCallback? onOpenAssistant;
  final VoidCallback? onToggleAssistant;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final wide = isWideAuthoringLayout(context);

    return Material(
      color: palette.cardSurface,
      child: Container(
        padding: const EdgeInsetsDirectional.fromSTEB(
          AppSpacing.xs,
          AppSpacing.sm,
          AppSpacing.md,
          AppSpacing.sm,
        ),
        decoration: BoxDecoration(
          border: Border(bottom: BorderSide(color: palette.borderSubtle)),
        ),
        child: Row(
          children: [
            IconButton(
              tooltip: LearningAuthoringL10n.back.resolve(context),
              onPressed: onBack,
              icon: const Icon(Icons.arrow_back_rounded),
            ),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    LearningAuthoringL10n.workspaceTitle.resolve(context),
                    style: AppTextStyles.title(
                      context,
                    ).copyWith(color: palette.textPrimary),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Row(
                    children: [
                      AppStatusBadge(
                        label: LearningAuthoringL10n.draftStatus.resolve(
                          context,
                        ),
                        tone: AppStatusTone.neutral,
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      ValueListenableBuilder<AuthoringWorkspaceSaveState>(
                        valueListenable: saveStateListenable,
                        builder: (context, saveState, _) =>
                            _SaveStateChip(saveState: saveState),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: ContentDirectionalText(
                          projectTitle,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTextStyles.label(
                            context,
                          ).copyWith(color: palette.textSecondary),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            if (showAssistantAction)
              wide
                  ? TextButton.icon(
                      onPressed: onToggleAssistant,
                      icon: Icon(
                        assistantPanelOpen
                            ? Icons.close_fullscreen_rounded
                            : Icons.auto_awesome_outlined,
                      ),
                      label: Text(
                        assistantPanelOpen
                            ? LearningAuthoringL10n.collapseAssistant.resolve(
                                context,
                              )
                            : LearningAuthoringL10n.showAssistant.resolve(
                                context,
                              ),
                      ),
                    )
                  : FilledButton.icon(
                      onPressed: onOpenAssistant,
                      icon: const Icon(Icons.auto_awesome_outlined),
                      label: Text(
                        LearningAuthoringL10n.openAiAssistant.resolve(context),
                      ),
                    ),
          ],
        ),
      ),
    );
  }
}

class _SaveStateChip extends StatelessWidget {
  const _SaveStateChip({required this.saveState});

  final AuthoringWorkspaceSaveState saveState;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final label = switch (saveState) {
      AuthoringWorkspaceSaveState.unsaved =>
        LearningAuthoringL10n.saveStateUnsaved,
      AuthoringWorkspaceSaveState.saving =>
        LearningAuthoringL10n.saveStateSaving,
      AuthoringWorkspaceSaveState.saved => LearningAuthoringL10n.saveStateSaved,
      AuthoringWorkspaceSaveState.failed =>
        LearningAuthoringL10n.saveStateFailed,
    };
    final color = switch (saveState) {
      AuthoringWorkspaceSaveState.failed => Theme.of(context).colorScheme.error,
      AuthoringWorkspaceSaveState.unsaved => palette.heroAccent,
      AuthoringWorkspaceSaveState.saving => palette.textSecondary,
      AuthoringWorkspaceSaveState.saved => palette.textSecondary,
    };

    return Text(
      label.resolve(context),
      style: AppTextStyles.label(context).copyWith(color: color),
    );
  }
}

class _AuthoringStatePanel extends StatelessWidget {
  const _AuthoringStatePanel({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.actionLabel,
    required this.onAction,
  });

  final IconData icon;
  final LocalizedText title;
  final LocalizedText subtitle;
  final LocalizedText actionLabel;
  final VoidCallback onAction;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);

    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 520),
        child: Padding(
          padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 40, color: palette.textSecondary),
              const SizedBox(height: AppSpacing.md),
              Text(
                title.resolve(context),
                textAlign: TextAlign.center,
                style: AppTextStyles.title(context),
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                subtitle.resolve(context),
                textAlign: TextAlign.center,
                style: AppTextStyles.body(
                  context,
                ).copyWith(color: palette.textSecondary),
              ),
              const SizedBox(height: AppSpacing.lg),
              FilledButton(
                onPressed: onAction,
                child: Text(actionLabel.resolve(context)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
