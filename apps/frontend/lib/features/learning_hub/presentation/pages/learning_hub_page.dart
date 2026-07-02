import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/widgets/app_mobile_bottom_nav_bar.dart';
import '../../../../app/widgets/entry_nav_bar.dart';
import '../../application/learning_hub_providers.dart';
import '../../domain/learning_projects_result.dart';
import '../../domain/models/learning_project.dart';
import '../../../materials/data/models/category.dart';
import '../theme/learning_ui_palette.dart';
import '../widgets/disabled_ai_panel.dart';
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
  static const int _chunkSize = 4;

  late final TextEditingController _searchController;
  Timer? _searchDebounce;

  int _visibleProjectCount = _chunkSize;
  int _selectedCategoryIndex = 0;
  String? _selectedCategoryId;
  String _searchDraft = '';
  String? _searchTerm;
  String? _selectedDifficulty;
  String? _selectedTag;

  LearningProjectsQuery get _query => LearningProjectsQuery(
    page: 1,
    limit: 20,
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
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
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
      _visibleProjectCount = _chunkSize;
    });
  }

  void _setDifficulty(String? difficulty) {
    setState(() {
      _selectedDifficulty = difficulty;
      _visibleProjectCount = _chunkSize;
    });
  }

  void _setTag(String? tag) {
    setState(() {
      _selectedTag = tag;
      _visibleProjectCount = _chunkSize;
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
      _visibleProjectCount = _chunkSize;
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
                    searchDraft: _searchDraft,
                    selectedDifficulty: _selectedDifficulty,
                    selectedTag: _selectedTag,
                    hasActiveFilters: _hasActiveFilters,
                    visibleProjectCount: _visibleProjectCount,
                    onSearchChanged: _onSearchChanged,
                    onSearchSubmitted: _applySearch,
                    onDifficultySelected: _setDifficulty,
                    onTagSelected: _setTag,
                    onClearFilters: _clearFilters,
                    onCategorySelected: (index, categoryId) {
                      setState(() {
                        _selectedCategoryIndex = index;
                        _selectedCategoryId = categoryId;
                        _visibleProjectCount = _chunkSize;
                      });
                    },
                    onLoadMore: () {
                      setState(() {
                        _visibleProjectCount =
                            (_visibleProjectCount + _chunkSize).clamp(
                              0,
                              result.items.length - 1,
                            );
                      });
                    },
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
    required this.searchDraft,
    required this.selectedDifficulty,
    required this.selectedTag,
    required this.hasActiveFilters,
    required this.visibleProjectCount,
    required this.onSearchChanged,
    required this.onSearchSubmitted,
    required this.onDifficultySelected,
    required this.onTagSelected,
    required this.onClearFilters,
    required this.onCategorySelected,
    required this.onLoadMore,
  });

  final LearningProjectsResult result;
  final AsyncValue<List<MaterialCategory>> categoriesAsync;
  final int selectedCategoryIndex;
  final TextEditingController searchController;
  final String searchDraft;
  final String? selectedDifficulty;
  final String? selectedTag;
  final bool hasActiveFilters;
  final int visibleProjectCount;
  final ValueChanged<String> onSearchChanged;
  final ValueChanged<String> onSearchSubmitted;
  final ValueChanged<String?> onDifficultySelected;
  final ValueChanged<String?> onTagSelected;
  final VoidCallback onClearFilters;
  final void Function(int index, String? categoryId) onCategorySelected;
  final VoidCallback onLoadMore;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final featuredProject = result.items.isEmpty ? null : result.items.first;
    final otherProjects = result.items.length > 1
        ? result.items.sublist(1)
        : const <LearningProject>[];
    final visibleProjects = otherProjects
        .take(visibleProjectCount)
        .toList(growable: false);
    final hasMoreProjects = visibleProjectCount < otherProjects.length;
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
              ),
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
              if (otherProjects.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.xl),
                Text(
                  const LocalizedText(
                    en: 'More projects',
                    ar: 'مشاريع أخرى',
                  ).resolve(context),
                  style: AppTextStyles.display(
                    context,
                  ).copyWith(color: palette.textPrimary),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  '${otherProjects.length} ${const LocalizedText(en: 'results', ar: 'نتيجة').resolve(context)}',
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
                      children: visibleProjects.map((project) {
                        return SizedBox(
                          width: itemWidth,
                          child: LearningProjectCard(project: project),
                        );
                      }).toList(),
                    );
                  },
                ),
                if (hasMoreProjects) ...[
                  const SizedBox(height: AppSpacing.lg),
                  Align(
                    alignment: AlignmentDirectional.centerStart,
                    child: OutlinedButton.icon(
                      onPressed: onLoadMore,
                      icon: const Icon(Icons.expand_more_rounded),
                      label: Text(
                        const LocalizedText(
                          en: 'Load more projects',
                          ar: 'عرض المزيد من المشاريع',
                        ).resolve(context),
                      ),
                    ),
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
              const DisabledAiPanel(compact: true),
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
}

class _LearningHubFilters extends StatelessWidget {
  const _LearningHubFilters({
    required this.searchController,
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
