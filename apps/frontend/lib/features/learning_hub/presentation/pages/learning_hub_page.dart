import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/widgets/app_mobile_bottom_nav_bar.dart';
import '../../../../app/widgets/entry_nav_bar.dart';
import '../../application/learning_hub_providers.dart';
import '../../domain/learning_projects_result.dart';
import '../../domain/models/learning_project.dart';
import '../../../materials/data/models/category.dart';
import '../theme/learning_ui_palette.dart';
import '../widgets/featured_project_card.dart';
import '../widgets/learning_category_chips.dart';
import '../widgets/learning_hub_hero.dart';
import '../widgets/learning_project_card.dart';

const _featuredTip = LocalizedText(
  en: ' helps learners turn surplus materials into practical builds. Browse published projects for inspiration, then reserve materials when you are ready.',
  ar: ' يساعد المتعلمين على تحويل المواد الفائضة إلى مشاريع عملية. تصفح المشاريع المنشورة للإلهام، ثم احجز المواد عندما تكون مستعداً.',
);

class LearningHubPage extends ConsumerStatefulWidget {
  const LearningHubPage({super.key});

  @override
  ConsumerState<LearningHubPage> createState() => _LearningHubPageState();
}

class _LearningHubPageState extends ConsumerState<LearningHubPage> {
  static const int _pageSize = 12;

  late final TextEditingController _searchController;
  late final FocusNode _searchFocusNode;
  Timer? _searchDebounce;

  int _currentPage = 1;
  int _selectedCategoryIndex = 0;
  String? _selectedCategoryId;
  String _searchDraft = '';
  String? _searchTerm;
  String? _selectedDifficulty;
  String? _selectedTag;

  LearningProjectsQuery get _query => LearningProjectsQuery(
    page: _currentPage,
    limit: _pageSize,
    q: _searchTerm,
    categoryId: _selectedCategoryId,
    difficulty: _selectedDifficulty,
    tag: _selectedTag,
  );

  bool get _hasActiveFilters =>
      _selectedCategoryId != null ||
      (_searchTerm != null && _searchTerm!.isNotEmpty) ||
      _selectedDifficulty != null ||
      _selectedTag != null;

  @override
  void initState() {
    super.initState();
    _searchController = TextEditingController();
    _searchFocusNode = FocusNode();
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _searchFocusNode.dispose();
    _searchController.dispose();
    super.dispose();
  }

  void _onSearchChanged(String value) {
    _searchDebounce?.cancel();
    setState(() {
      _searchDraft = value;
    });
    _searchDebounce = Timer(const Duration(milliseconds: 350), () {
      if (!mounted) return;
      _applySearch(value);
    });
  }

  void _applySearch(String value) {
    _searchDebounce?.cancel();
    final trimmed = value.trim();
    final nextSearchTerm = trimmed.isEmpty ? null : trimmed;
    if (_searchTerm == nextSearchTerm) {
      return;
    }

    setState(() {
      _searchTerm = nextSearchTerm;
      _currentPage = 1;
    });
  }

  void _setDifficulty(String? difficulty) {
    setState(() {
      _selectedDifficulty = difficulty;
      _currentPage = 1;
    });
  }

  void _setTag(String? tag) {
    setState(() {
      _selectedTag = tag;
      _currentPage = 1;
    });
  }

  void _clearFilters() {
    _searchDebounce?.cancel();
    _searchController.clear();
    setState(() {
      _selectedCategoryIndex = 0;
      _selectedCategoryId = null;
      _searchDraft = '';
      _searchTerm = null;
      _selectedDifficulty = null;
      _selectedTag = null;
      _currentPage = 1;
    });
  }

  void _setPage(int page) {
    if (page == _currentPage || page < 1) {
      return;
    }

    setState(() {
      _currentPage = page;
    });
  }

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final categoriesAsync = ref.watch(projectCategoriesProvider);
    final projectsAsync = ref.watch(learningProjectsProvider(_query));

    return Scaffold(
      backgroundColor: palette.pageBackground,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const EntryNavBar(homeRoute: '/home'),
            Expanded(
              child: projectsAsync.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (error, stackTrace) => _HubStatePanel(
                  icon: Icons.cloud_off_outlined,
                  title: const LocalizedText(
                    en: 'Unable to load learning projects',
                    ar: 'تعذر تحميل مشاريع التعلم',
                  ),
                  subtitle: const LocalizedText(
                    en: 'Check that the backend is running, then try again.',
                    ar: 'تحقق من تشغيل الخادم ثم حاول مرة أخرى.',
                  ),
                  actionLabel: const LocalizedText(
                    en: 'Try again',
                    ar: 'حاول مرة أخرى',
                  ),
                  onAction: () =>
                      ref.invalidate(learningProjectsProvider(_query)),
                ),
                data: (result) {
                  return _HubContent(
                    result: result,
                    categoriesAsync: categoriesAsync,
                    selectedCategoryIndex: _selectedCategoryIndex,
                    searchController: _searchController,
                    searchFocusNode: _searchFocusNode,
                    searchDraft: _searchDraft,
                    selectedDifficulty: _selectedDifficulty,
                    selectedTag: _selectedTag,
                    hasActiveFilters: _hasActiveFilters,
                    onSearchChanged: _onSearchChanged,
                    onSearchSubmitted: _applySearch,
                    onDifficultySelected: _setDifficulty,
                    onTagSelected: _setTag,
                    onClearFilters: _clearFilters,
                    onSubmitProject: () => context.go('/learning/add-draft'),
                    onFocusSearch: () => _searchFocusNode.requestFocus(),
                    onCategorySelected: (index, categoryId) {
                      setState(() {
                        _selectedCategoryIndex = index;
                        _selectedCategoryId = categoryId;
                        _currentPage = 1;
                      });
                    },
                    onPageChanged: _setPage,
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HubContent extends StatelessWidget {
  const _HubContent({
    required this.result,
    required this.categoriesAsync,
    required this.selectedCategoryIndex,
    required this.searchController,
    required this.searchFocusNode,
    required this.searchDraft,
    required this.selectedDifficulty,
    required this.selectedTag,
    required this.hasActiveFilters,
    required this.onSearchChanged,
    required this.onSearchSubmitted,
    required this.onDifficultySelected,
    required this.onTagSelected,
    required this.onClearFilters,
    required this.onSubmitProject,
    required this.onFocusSearch,
    required this.onCategorySelected,
    required this.onPageChanged,
  });

  final LearningProjectsResult result;
  final AsyncValue<List<MaterialCategory>> categoriesAsync;
  final int selectedCategoryIndex;
  final TextEditingController searchController;
  final FocusNode searchFocusNode;
  final String searchDraft;
  final String? selectedDifficulty;
  final String? selectedTag;
  final bool hasActiveFilters;
  final ValueChanged<String> onSearchChanged;
  final ValueChanged<String> onSearchSubmitted;
  final ValueChanged<String?> onDifficultySelected;
  final ValueChanged<String?> onTagSelected;
  final VoidCallback onClearFilters;
  final VoidCallback onSubmitProject;
  final VoidCallback onFocusSearch;
  final void Function(int index, String? categoryId) onCategorySelected;
  final ValueChanged<int> onPageChanged;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final isFirstPage = result.page <= 1;
    final featuredProject = isFirstPage && result.items.isNotEmpty
        ? result.items.first
        : null;
    final gridProjects = featuredProject != null && result.items.length > 1
        ? result.items.sublist(1)
        : result.items;
    final pageStart = result.total == 0
        ? 0
        : ((result.page - 1) * result.limit) + 1;
    final pageEnd = result.total == 0
        ? 0
        : (pageStart + result.items.length - 1).clamp(pageStart, result.total);
    final categoryLabels = _categoryLabels(categoriesAsync);
    final tagOptions = _tagOptions(result.items, selectedTag);
    final heroStats = <LocalizedText, int>{
      const LocalizedText(en: 'Published projects', ar: 'مشاريع منشورة'):
          result.total,
      LocalizedText(en: 'Categories', ar: 'فئات'): categoryLabels.length > 1
          ? categoryLabels.length - 1
          : 0,
    };

    return SingleChildScrollView(
      padding: appMobileAwareScrollPadding(context, top: AppSpacing.md),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1400),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              LearningHubHero(
                title: const LocalizedText(
                  en: 'Learning Hub',
                  ar: 'مركز التعلم',
                ),
                subtitle: const LocalizedText(
                  en: 'Discover practical projects and learn what you can build from reused materials.',
                  ar: 'اكتشف المشاريع وتعلم ما يمكنك بناؤه من مواد معاد تدويرها.',
                ),
                stats: heroStats,
                onSearchPressed: onFocusSearch,
                onSubmitPressed: onSubmitProject,
              ),
              const SizedBox(height: AppSpacing.lg),
              _SubmitProjectCallout(onSubmitProject: onSubmitProject),
              const SizedBox(height: AppSpacing.lg),
              if (categoryLabels.isNotEmpty)
                LearningCategoryChips(
                  categories: categoryLabels,
                  selectedIndex: selectedCategoryIndex,
                  onSelected: (index) {
                    final categoryId = index == 0
                        ? null
                        : _categoryIdAt(categoriesAsync, index - 1);
                    onCategorySelected(index, categoryId);
                  },
                ),
              if (categoryLabels.isNotEmpty)
                const SizedBox(height: AppSpacing.xl),
              _LearningHubFilters(
                searchController: searchController,
                searchFocusNode: searchFocusNode,
                searchDraft: searchDraft,
                selectedDifficulty: selectedDifficulty,
                selectedTag: selectedTag,
                tagOptions: tagOptions,
                hasActiveFilters: hasActiveFilters,
                onSearchChanged: onSearchChanged,
                onSearchSubmitted: onSearchSubmitted,
                onDifficultySelected: onDifficultySelected,
                onTagSelected: onTagSelected,
                onClearFilters: onClearFilters,
              ),
              const SizedBox(height: AppSpacing.xl),
              if (featuredProject == null)
                _HubStatePanel(
                  icon: hasActiveFilters
                      ? Icons.search_off_rounded
                      : Icons.school_outlined,
                  title: hasActiveFilters
                      ? const LocalizedText(
                          en: 'No projects match your filters',
                          ar: 'لا توجد مشاريع تطابق عوامل التصفية',
                        )
                      : const LocalizedText(
                          en: 'No published projects yet',
                          ar: 'لا توجد مشاريع منشورة بعد',
                        ),
                  subtitle: hasActiveFilters
                      ? const LocalizedText(
                          en: 'Try a different search, difficulty, category, or tag.',
                          ar: 'جرّب بحثاً أو مستوى أو فئة أو وسم مختلف.',
                        )
                      : const LocalizedText(
                          en: 'When learning projects are published, they will appear here.',
                          ar: 'عند نشر مشاريع تعليمية، ستظهر هنا.',
                        ),
                  actionLabel: hasActiveFilters
                      ? const LocalizedText(
                          en: 'Clear filters',
                          ar: 'مسح عوامل التصفية',
                        )
                      : null,
                  onAction: hasActiveFilters ? onClearFilters : null,
                )
              else ...[
                Text(
                  const LocalizedText(
                    en: 'Project of the week',
                    ar: 'مشروع الأسبوع',
                  ).resolve(context),
                  style: AppTextStyles.display(
                    context,
                  ).copyWith(color: palette.textPrimary),
                ),
                const SizedBox(height: AppSpacing.md),
                FeaturedProjectCard(project: featuredProject),
              ],
              if (gridProjects.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.xl),
                Text(
                  (isFirstPage
                          ? const LocalizedText(
                              en: 'More projects',
                              ar: 'مشاريع أخرى',
                            )
                          : const LocalizedText(
                              en: 'Projects',
                              ar: 'المشاريع',
                            ))
                      .resolve(context),
                  style: AppTextStyles.display(
                    context,
                  ).copyWith(color: palette.textPrimary),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  _pageSummary(context, pageStart, pageEnd, result.total),
                  style: AppTextStyles.subtitle(
                    context,
                  ).copyWith(color: palette.textSecondary),
                ),
                const SizedBox(height: AppSpacing.md),
                LayoutBuilder(
                  builder: (context, constraints) {
                    final width = constraints.maxWidth;
                    var columns = 1;

                    if (width >= 1160) {
                      columns = 3;
                    } else if (width >= 760) {
                      columns = 2;
                    }
                    final itemWidth =
                        (width - ((columns - 1) * AppSpacing.md)) / columns;

                    return Wrap(
                      spacing: AppSpacing.md,
                      runSpacing: AppSpacing.md,
                      children: gridProjects.map((project) {
                        return SizedBox(
                          width: itemWidth,
                          child: LearningProjectCard(project: project),
                        );
                      }).toList(),
                    );
                  },
                ),
                if (result.totalPages > 1) ...[
                  const SizedBox(height: AppSpacing.lg),
                  _LearningPaginationControls(
                    page: result.page,
                    totalPages: result.totalPages,
                    onPageChanged: onPageChanged,
                  ),
                ],
              ],
              const SizedBox(height: AppSpacing.lg),
              Container(
                width: double.infinity,
                padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
                decoration: BoxDecoration(
                  color: palette.hintSurface,
                  borderRadius: BorderRadius.circular(22),
                  border: Border.all(color: palette.hintBorder),
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.lightbulb_outline_rounded,
                      color: learningLime,
                    ),
                    const SizedBox(width: AppSpacing.md),
                    Expanded(
                      child: RichText(
                        textAlign: TextAlign.start,
                        text: TextSpan(
                          style: AppTextStyles.body(
                            context,
                          ).copyWith(color: palette.textSecondary),
                          children: [
                            TextSpan(
                              text: 'ImpactLoop ',
                              style: AppTextStyles.label(
                                context,
                              ).copyWith(color: palette.textPrimary),
                            ),
                            TextSpan(text: _featuredTip.resolve(context)),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              _LearningHubRoadmapPanel(onSubmitProject: onSubmitProject),
            ],
          ),
        ),
      ),
    );
  }

  List<LocalizedText> _categoryLabels(
    AsyncValue<List<MaterialCategory>> categoriesAsync,
  ) {
    return categoriesAsync.maybeWhen(
      data: (categories) {
        final labels = <LocalizedText>[
          const LocalizedText(en: 'All', ar: 'الكل'),
        ];

        for (final category in categories) {
          labels.add(
            LocalizedText(
              en: category.nameEn,
              ar: category.nameAr.isNotEmpty
                  ? category.nameAr
                  : category.nameEn,
            ),
          );
        }

        return labels;
      },
      orElse: () => const [],
    );
  }

  String? _categoryIdAt(
    AsyncValue<List<MaterialCategory>> categoriesAsync,
    int index,
  ) {
    return categoriesAsync.maybeWhen(
      data: (categories) {
        if (index < 0 || index >= categories.length) {
          return null;
        }

        return categories[index].id;
      },
      orElse: () => null,
    );
  }

  List<String> _tagOptions(List<LearningProject> projects, String? selectedTag) {
    final tags = <String>{};
    if (selectedTag != null && selectedTag.trim().isNotEmpty) {
      tags.add(selectedTag.trim());
    }

    for (final project in projects) {
      for (final tag in project.tags) {
        final trimmed = tag.trim();
        if (trimmed.isNotEmpty) {
          tags.add(trimmed);
        }
      }
    }

    return tags.toList(growable: false)
      ..sort((left, right) => left.toLowerCase().compareTo(right.toLowerCase()));
  }

  String _pageSummary(
    BuildContext context,
    int pageStart,
    int pageEnd,
    int total,
  ) {
    final results = const LocalizedText(en: 'results', ar: 'نتيجة').resolve(
      context,
    );

    if (total == 0) {
      return '0 $results';
    }

    final showing = const LocalizedText(en: 'Showing', ar: 'عرض').resolve(
      context,
    );
    final of = const LocalizedText(en: 'of', ar: 'من').resolve(context);

    return '$showing $pageStart-$pageEnd $of $total $results';
  }
}

class _LearningPaginationControls extends StatelessWidget {
  const _LearningPaginationControls({
    required this.page,
    required this.totalPages,
    required this.onPageChanged,
  });

  final int page;
  final int totalPages;
  final ValueChanged<int> onPageChanged;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final canGoBack = page > 1;
    final canGoForward = page < totalPages;

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: palette.cardSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final compact = constraints.maxWidth < 560;
          final pageLabel = Text(
            LocalizedText(
              en: 'Page $page of $totalPages',
              ar: 'صفحة $page من $totalPages',
            ).resolve(context),
            style: AppTextStyles.label(
              context,
            ).copyWith(color: palette.textPrimary),
            textAlign: TextAlign.center,
          );
          final previous = OutlinedButton.icon(
            onPressed: canGoBack ? () => onPageChanged(page - 1) : null,
            icon: const Icon(Icons.chevron_left_rounded),
            label: Text(
              const LocalizedText(en: 'Previous', ar: 'السابق').resolve(
                context,
              ),
            ),
          );
          final next = FilledButton.icon(
            onPressed: canGoForward ? () => onPageChanged(page + 1) : null,
            icon: const Icon(Icons.chevron_right_rounded),
            label: Text(
              const LocalizedText(en: 'Next', ar: 'التالي').resolve(context),
            ),
          );

          if (compact) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                pageLabel,
                const SizedBox(height: AppSpacing.md),
                Row(
                  children: [
                    Expanded(child: previous),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(child: next),
                  ],
                ),
              ],
            );
          }

          return Row(
            children: [
              previous,
              Expanded(child: pageLabel),
              next,
            ],
          );
        },
      ),
    );
  }
}

class _LearningHubRoadmapPanel extends StatelessWidget {
  const _LearningHubRoadmapPanel({required this.onSubmitProject});

  final VoidCallback onSubmitProject;

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
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final compact = constraints.maxWidth < 760;
          final content = Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.route_outlined, color: palette.lime),
              const SizedBox(height: AppSpacing.md),
              Text(
                const LocalizedText(
                  en: 'Build tools are coming next',
                  ar: 'أدوات البناء قادمة لاحقاً',
                ).resolve(context),
                style: AppTextStyles.title(
                  context,
                ).copyWith(color: palette.textPrimary),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                const LocalizedText(
                  en: 'The next Learning Hub steps are saved projects, project likes, reviews, and build checklists that connect projects to materials without automated matching.',
                  ar: 'الخطوات القادمة في مركز التعلم هي حفظ المشاريع، الإعجابات، المراجعات، وقوائم البناء التي تربط المشاريع بالمواد بدون مطابقة آلية.',
                ).resolve(context),
                style: AppTextStyles.body(
                  context,
                ).copyWith(color: palette.textSecondary, height: 1.45),
              ),
            ],
          );
          final actions = Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              FilledButton.icon(
                onPressed: onSubmitProject,
                icon: const Icon(Icons.edit_note_rounded),
                label: Text(
                  const LocalizedText(
                    en: 'Submit a project',
                    ar: 'إرسال مشروع',
                  ).resolve(context),
                ),
              ),
              OutlinedButton.icon(
                onPressed: () => context.go('/materials'),
                icon: const Icon(Icons.inventory_2_outlined),
                label: Text(
                  const LocalizedText(
                    en: 'Browse materials',
                    ar: 'تصفح المواد',
                  ).resolve(context),
                ),
              ),
            ],
          );

          if (compact) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                content,
                const SizedBox(height: AppSpacing.lg),
                actions,
              ],
            );
          }

          return Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(child: content),
              const SizedBox(width: AppSpacing.lg),
              ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 360),
                child: actions,
              ),
            ],
          );
        },
      ),
    );
  }
}

class _SubmitProjectCallout extends StatelessWidget {
  const _SubmitProjectCallout({required this.onSubmitProject});

  final VoidCallback onSubmitProject;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: palette.cardSurface,
        borderRadius: AppRadius.xlAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final compact = constraints.maxWidth < 720;
          final copy = Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                const LocalizedText(
                  en: 'Have a project idea?',
                  ar: 'هل لديك فكرة مشروع؟',
                ).resolve(context),
                style: AppTextStyles.title(
                  context,
                ).copyWith(color: palette.textPrimary),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                const LocalizedText(
                  en: 'Create a draft and submit it for admin review.',
                  ar: 'أنشئ مسودة وأرسلها لمراجعة الإدارة.',
                ).resolve(context),
                style: AppTextStyles.body(
                  context,
                ).copyWith(color: palette.textSecondary),
              ),
            ],
          );
          final action = FilledButton.icon(
            onPressed: onSubmitProject,
            icon: const Icon(Icons.edit_note_rounded),
            label: Text(
              const LocalizedText(
                en: 'Add project draft',
                ar: 'إضافة مسودة مشروع',
              ).resolve(context),
            ),
          );

          if (compact) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                copy,
                const SizedBox(height: AppSpacing.md),
                action,
              ],
            );
          }

          return Row(
            children: [
              Expanded(child: copy),
              const SizedBox(width: AppSpacing.lg),
              SizedBox(width: 240, child: action),
            ],
          );
        },
      ),
    );
  }
}

class _LearningHubFilters extends StatelessWidget {
  const _LearningHubFilters({
    required this.searchController,
    required this.searchFocusNode,
    required this.searchDraft,
    required this.selectedDifficulty,
    required this.selectedTag,
    required this.tagOptions,
    required this.hasActiveFilters,
    required this.onSearchChanged,
    required this.onSearchSubmitted,
    required this.onDifficultySelected,
    required this.onTagSelected,
    required this.onClearFilters,
  });

  static const _difficultyOptions = <_DifficultyFilterOption>[
    _DifficultyFilterOption(
      value: 'BEGINNER',
      label: LocalizedText(en: 'Easy', ar: 'سهل'),
    ),
    _DifficultyFilterOption(
      value: 'INTERMEDIATE',
      label: LocalizedText(en: 'Medium', ar: 'متوسط'),
    ),
    _DifficultyFilterOption(
      value: 'ADVANCED',
      label: LocalizedText(en: 'Advanced', ar: 'متقدم'),
    ),
  ];

  final TextEditingController searchController;
  final FocusNode searchFocusNode;
  final String searchDraft;
  final String? selectedDifficulty;
  final String? selectedTag;
  final List<String> tagOptions;
  final bool hasActiveFilters;
  final ValueChanged<String> onSearchChanged;
  final ValueChanged<String> onSearchSubmitted;
  final ValueChanged<String?> onDifficultySelected;
  final ValueChanged<String?> onTagSelected;
  final VoidCallback onClearFilters;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: palette.cardSurface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          LayoutBuilder(
            builder: (context, constraints) {
              final isCompact = constraints.maxWidth < 720;
              final searchField = TextField(
                controller: searchController,
                focusNode: searchFocusNode,
                textInputAction: TextInputAction.search,
                onChanged: onSearchChanged,
                onSubmitted: onSearchSubmitted,
                decoration: InputDecoration(
                  labelText: const LocalizedText(
                    en: 'Search projects',
                    ar: 'ابحث في المشاريع',
                  ).resolve(context),
                  hintText: const LocalizedText(
                    en: 'Title, summary, or component',
                    ar: 'العنوان أو الملخص أو المكوّن',
                  ).resolve(context),
                  floatingLabelBehavior: FloatingLabelBehavior.always,
                  prefixIcon: const Icon(Icons.search_rounded),
                  suffixIcon: searchDraft.trim().isEmpty
                      ? null
                      : IconButton(
                          tooltip: const LocalizedText(
                            en: 'Clear search',
                            ar: 'مسح البحث',
                          ).resolve(context),
                          onPressed: () {
                            searchController.clear();
                            onSearchChanged('');
                            onSearchSubmitted('');
                          },
                          icon: const Icon(Icons.close_rounded),
                        ),
                ),
              );
              final clearButton = Align(
                alignment: AlignmentDirectional.centerStart,
                child: TextButton.icon(
                  onPressed: hasActiveFilters ? onClearFilters : null,
                  icon: const Icon(Icons.refresh_rounded),
                  label: Text(
                    const LocalizedText(
                      en: 'Clear filters',
                      ar: 'مسح عوامل التصفية',
                    ).resolve(context),
                  ),
                ),
              );

              if (isCompact) {
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    searchField,
                    const SizedBox(height: AppSpacing.sm),
                    clearButton,
                  ],
                );
              }

              return Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(child: searchField),
                  const SizedBox(width: AppSpacing.md),
                  clearButton,
                ],
              );
            },
          ),
          const SizedBox(height: AppSpacing.md),
          _FilterGroup(
            title: const LocalizedText(en: 'Difficulty', ar: 'المستوى'),
            children: [
              _LearningFilterChip(
                label: const LocalizedText(
                  en: 'All levels',
                  ar: 'كل المستويات',
                ).resolve(context),
                selected: selectedDifficulty == null,
                onSelected: () => onDifficultySelected(null),
              ),
              for (final option in _difficultyOptions)
                _LearningFilterChip(
                  label: option.label.resolve(context),
                  selected: selectedDifficulty == option.value,
                  onSelected: () => onDifficultySelected(option.value),
                ),
            ],
          ),
          if (tagOptions.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.md),
            _FilterGroup(
              title: const LocalizedText(en: 'Tags', ar: 'الوسوم'),
              children: [
                for (final tag in tagOptions)
                  _LearningFilterChip(
                    label: tag,
                    selected: selectedTag == tag,
                    onSelected: () =>
                        onTagSelected(selectedTag == tag ? null : tag),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _FilterGroup extends StatelessWidget {
  const _FilterGroup({required this.title, required this.children});

  final LocalizedText title;
  final List<Widget> children;

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
          children: children,
        ),
      ],
    );
  }
}

class _LearningFilterChip extends StatelessWidget {
  const _LearningFilterChip({
    required this.label,
    required this.selected,
    required this.onSelected,
  });

  final String label;
  final bool selected;
  final VoidCallback onSelected;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);

    return FilterChip(
      label: Text(label),
      selected: selected,
      onSelected: (_) => onSelected(),
      selectedColor: palette.lime,
      checkmarkColor: palette.textPrimary,
      labelStyle: AppTextStyles.label(context).copyWith(
        color: palette.textPrimary,
        fontWeight: selected ? FontWeight.w800 : FontWeight.w700,
      ),
      backgroundColor: palette.cardSurfaceAlt,
      side: BorderSide(color: selected ? palette.lime : palette.borderSubtle),
    );
  }
}

class _DifficultyFilterOption {
  const _DifficultyFilterOption({required this.value, required this.label});

  final String value;
  final LocalizedText label;
}

class _HubStatePanel extends StatelessWidget {
  const _HubStatePanel({
    required this.icon,
    required this.title,
    required this.subtitle,
    this.actionLabel,
    this.onAction,
  });

  final IconData icon;
  final LocalizedText title;
  final LocalizedText subtitle;
  final LocalizedText? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);

    return Center(
      child: Padding(
        padding: const EdgeInsetsDirectional.all(AppSpacing.xl),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 520),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 40, color: palette.textSecondary),
              const SizedBox(height: AppSpacing.md),
              Text(
                title.resolve(context),
                style: AppTextStyles.title(
                  context,
                ).copyWith(color: palette.textPrimary),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                subtitle.resolve(context),
                style: AppTextStyles.body(
                  context,
                ).copyWith(color: palette.textSecondary),
                textAlign: TextAlign.center,
              ),
              if (actionLabel != null && onAction != null) ...[
                const SizedBox(height: AppSpacing.lg),
                OutlinedButton(
                  onPressed: onAction,
                  child: Text(actionLabel!.resolve(context)),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
