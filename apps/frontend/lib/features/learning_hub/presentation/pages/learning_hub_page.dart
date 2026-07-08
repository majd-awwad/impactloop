import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_color_tokens.dart';
import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/widgets/app_mobile_bottom_nav_bar.dart';
import '../../../../app/widgets/entry_nav_bar.dart';
import '../../../../shared/widgets/app_feedback.dart';
import '../../../auth/application/auth_controller.dart';
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

enum _LearningProjectListMode { all, saved, followed }

class LearningHubPage extends ConsumerStatefulWidget {
  const LearningHubPage({super.key, this.initialSearch});

  final String? initialSearch;

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
  _LearningProjectListMode _listMode = _LearningProjectListMode.all;
  LearningProjectsResult? _lastResult;

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
    final initialSearch = _normalizedSearch(widget.initialSearch);
    _searchController = TextEditingController(text: initialSearch ?? '');
    _searchFocusNode = FocusNode();
    _searchDraft = initialSearch ?? '';
    _searchTerm = initialSearch;
  }

  @override
  void didUpdateWidget(covariant LearningHubPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    final nextSearch = _normalizedSearch(widget.initialSearch);
    if (_normalizedSearch(oldWidget.initialSearch) == nextSearch ||
        nextSearch == _searchTerm) {
      return;
    }

    _searchDebounce?.cancel();
    _searchController.text = nextSearch ?? '';
    setState(() {
      _searchDraft = nextSearch ?? '';
      _searchTerm = nextSearch;
      _currentPage = 1;
    });
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

  String? _normalizedSearch(String? value) {
    final trimmed = value?.trim();
    return trimmed == null || trimmed.isEmpty ? null : trimmed;
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

  void _setListMode(_LearningProjectListMode mode) {
    if (mode == _listMode) {
      return;
    }

    if (mode != _LearningProjectListMode.all) {
      final authState = ref.read(authControllerProvider);
      if (authState.status != AuthStatus.authenticated) {
        context.go('/login?from=${Uri.encodeQueryComponent('/learning')}');
        return;
      }

      if (authState.user?.hasRole('LEARNER') != true) {
        showInfoSnackBar(
          context,
          'Use a learner account to view saved and followed projects.',
        );
        return;
      }
    }

    setState(() {
      _listMode = mode;
      _currentPage = 1;
    });
  }

  void _invalidateCurrentProjects(LearningProjectsQuery query) {
    switch (_listMode) {
      case _LearningProjectListMode.all:
        ref.invalidate(learningProjectsProvider(query));
        break;
      case _LearningProjectListMode.saved:
        ref.invalidate(savedLearningProjectsProvider(query));
        break;
      case _LearningProjectListMode.followed:
        ref.invalidate(followedLearningProjectsProvider(query));
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final categoriesAsync = ref.watch(projectCategoriesProvider);
    final query = _query;
    final projectsAsync = switch (_listMode) {
      _LearningProjectListMode.all => ref.watch(
        learningProjectsProvider(query),
      ),
      _LearningProjectListMode.saved => ref.watch(
        savedLearningProjectsProvider(query),
      ),
      _LearningProjectListMode.followed => ref.watch(
        followedLearningProjectsProvider(query),
      ),
    };

    return Scaffold(
      backgroundColor: palette.pageBackground,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const EntryNavBar(homeRoute: '/home'),
            Expanded(child: _buildProjectsBody(projectsAsync, categoriesAsync)),
          ],
        ),
      ),
    );
  }

  Widget _buildProjectsBody(
    AsyncValue<LearningProjectsResult> projectsAsync,
    AsyncValue<List<MaterialCategory>> categoriesAsync,
  ) {
    final query = _query;
    final authState = ref.watch(authControllerProvider);
    final canManageSubmissions =
        authState.status == AuthStatus.authenticated &&
        authState.user?.hasRole('LEARNER') == true;

    Widget contentFor(
      LearningProjectsResult result, {
      required bool isRefreshing,
      Object? refreshError,
    }) {
      return _HubContent(
        result: result,
        categoriesAsync: categoriesAsync,
        selectedCategoryIndex: _selectedCategoryIndex,
        searchController: _searchController,
        searchFocusNode: _searchFocusNode,
        searchDraft: _searchDraft,
        selectedDifficulty: _selectedDifficulty,
        selectedTag: _selectedTag,
        listMode: _listMode,
        hasActiveFilters: _hasActiveFilters,
        isRefreshing: isRefreshing,
        refreshError: refreshError,
        onSearchChanged: _onSearchChanged,
        onSearchSubmitted: _applySearch,
        onDifficultySelected: _setDifficulty,
        onTagSelected: _setTag,
        onListModeSelected: _setListMode,
        onClearFilters: _clearFilters,
        onRetry: () => _invalidateCurrentProjects(query),
        onSubmitProject: () => context.go('/learning/add-draft'),
        onMySubmissions: canManageSubmissions
            ? () => context.go('/learning/submissions')
            : null,
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
    }

    return projectsAsync.when(
      loading: () {
        final cached = _lastResult;
        if (cached != null) {
          return contentFor(cached, isRefreshing: true);
        }

        return const Center(child: CircularProgressIndicator());
      },
      error: (error, stackTrace) {
        final cached = _lastResult;
        if (cached != null) {
          return contentFor(cached, isRefreshing: false, refreshError: error);
        }

        return _HubStatePanel(
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
          onAction: () => _invalidateCurrentProjects(query),
        );
      },
      data: (result) {
        _lastResult = result;
        return contentFor(result, isRefreshing: false);
      },
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
    required this.listMode,
    required this.hasActiveFilters,
    required this.isRefreshing,
    required this.refreshError,
    required this.onSearchChanged,
    required this.onSearchSubmitted,
    required this.onDifficultySelected,
    required this.onTagSelected,
    required this.onListModeSelected,
    required this.onClearFilters,
    required this.onRetry,
    required this.onSubmitProject,
    required this.onMySubmissions,
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
  final _LearningProjectListMode listMode;
  final bool hasActiveFilters;
  final bool isRefreshing;
  final Object? refreshError;
  final ValueChanged<String> onSearchChanged;
  final ValueChanged<String> onSearchSubmitted;
  final ValueChanged<String?> onDifficultySelected;
  final ValueChanged<String?> onTagSelected;
  final ValueChanged<_LearningProjectListMode> onListModeSelected;
  final VoidCallback onClearFilters;
  final VoidCallback onRetry;
  final VoidCallback onSubmitProject;
  final VoidCallback? onMySubmissions;
  final VoidCallback onFocusSearch;
  final void Function(int index, String? categoryId) onCategorySelected;
  final ValueChanged<int> onPageChanged;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final isFirstPage = result.page <= 1;
    final canShowFeatured =
        listMode == _LearningProjectListMode.all && isFirstPage;
    // TODO: Restore "Project of the week" when admins/moderators can select an
    // explicit spotlight project in the backend. Do not infer it from newest.
    final featuredProject = canShowFeatured
        ? _explicitFeaturedProject(result.items)
        : null;
    final gridProjects = featuredProject == null
        ? result.items
        : result.items
              .where((project) => project.id != featuredProject.id)
              .toList(growable: false);
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
      padding: appMobileAwareScrollPadding(context, top: AppSpacing.xl),
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
              _SubmitProjectCallout(
                onSubmitProject: onSubmitProject,
                onMySubmissions: onMySubmissions,
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
              _LearningListModeTabs(
                selectedMode: listMode,
                onModeSelected: onListModeSelected,
              ),
              const SizedBox(height: AppSpacing.md),
              if (isRefreshing)
                const _HubInlineStatusBanner(
                  icon: Icons.sync_rounded,
                  message: LocalizedText(
                    en: 'Updating results...',
                    ar: 'جار تحديث النتائج...',
                  ),
                  showProgress: true,
                )
              else if (refreshError != null)
                _HubInlineStatusBanner(
                  icon: Icons.cloud_off_outlined,
                  message: const LocalizedText(
                    en: 'Could not refresh results. Showing the previous list.',
                    ar: 'تعذر تحديث النتائج. يتم عرض القائمة السابقة.',
                  ),
                  actionLabel: const LocalizedText(
                    en: 'Retry',
                    ar: 'إعادة المحاولة',
                  ),
                  onAction: onRetry,
                ),
              const SizedBox(height: AppSpacing.xl),
              if (result.items.isEmpty)
                _HubStatePanel(
                  icon: hasActiveFilters
                      ? Icons.search_off_rounded
                      : Icons.school_outlined,
                  title: hasActiveFilters
                      ? const LocalizedText(
                          en: 'No projects match your filters',
                          ar: 'لا توجد مشاريع تطابق عوامل التصفية',
                        )
                      : _emptyTitleForMode(listMode),
                  subtitle: hasActiveFilters
                      ? const LocalizedText(
                          en: 'Try a different search, difficulty, category, or tag.',
                          ar: 'جرّب بحثاً أو مستوى أو فئة أو وسم مختلف.',
                        )
                      : _emptySubtitleForMode(listMode),
                  actionLabel: hasActiveFilters
                      ? const LocalizedText(
                          en: 'Clear filters',
                          ar: 'مسح عوامل التصفية',
                        )
                      : null,
                  onAction: hasActiveFilters ? onClearFilters : null,
                )
              else if (featuredProject != null) ...[
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
                  (listMode == _LearningProjectListMode.all && isFirstPage
                          ? const LocalizedText(
                              en: 'More projects',
                              ar: 'مشاريع أخرى',
                            )
                          : _sectionTitleForMode(listMode))
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

  List<String> _tagOptions(
    List<LearningProject> projects,
    String? selectedTag,
  ) {
    const visibleTagLimit = 12;
    final tags = <String>{};
    final selected = _userFacingTag(selectedTag);
    if (selected != null) {
      tags.add(selected);
    }

    for (final project in projects) {
      for (final tag in project.tags) {
        final visibleTag = _userFacingTag(tag);
        if (visibleTag != null) {
          tags.add(visibleTag);
        }
      }
    }

    final sorted = tags.toList(
      growable: false,
    )..sort((left, right) => left.toLowerCase().compareTo(right.toLowerCase()));

    return sorted.take(visibleTagLimit).toList(growable: false);
  }

  LearningProject? _explicitFeaturedProject(List<LearningProject> projects) {
    for (final project in projects) {
      if (project.isFeatured) {
        return project;
      }
    }

    return null;
  }

  String? _userFacingTag(String? tag) {
    final trimmed = tag?.trim();
    if (trimmed == null || trimmed.isEmpty) {
      return null;
    }

    final normalized = trimmed.toLowerCase();
    if (normalized == 'mock' ||
        normalized == 'pagination' ||
        normalized == 'test') {
      return null;
    }

    if (RegExp(r'^project[-_]\d+$').hasMatch(normalized)) {
      return null;
    }

    return trimmed;
  }

  String _pageSummary(
    BuildContext context,
    int pageStart,
    int pageEnd,
    int total,
  ) {
    final results = const LocalizedText(
      en: 'results',
      ar: 'نتيجة',
    ).resolve(context);

    if (total == 0) {
      return '0 $results';
    }

    final showing = const LocalizedText(
      en: 'Showing',
      ar: 'عرض',
    ).resolve(context);
    final of = const LocalizedText(en: 'of', ar: 'من').resolve(context);

    return '$showing $pageStart-$pageEnd $of $total $results';
  }

  LocalizedText _sectionTitleForMode(_LearningProjectListMode mode) {
    return switch (mode) {
      _LearningProjectListMode.all => const LocalizedText(
        en: 'Projects',
        ar: 'المشاريع',
      ),
      _LearningProjectListMode.saved => const LocalizedText(
        en: 'Saved projects',
        ar: 'المشاريع المحفوظة',
      ),
      _LearningProjectListMode.followed => const LocalizedText(
        en: 'Followed projects',
        ar: 'المشاريع المتابعة',
      ),
    };
  }

  LocalizedText _emptyTitleForMode(_LearningProjectListMode mode) {
    return switch (mode) {
      _LearningProjectListMode.all => const LocalizedText(
        en: 'No published projects yet',
        ar: 'لا توجد مشاريع منشورة بعد',
      ),
      _LearningProjectListMode.saved => const LocalizedText(
        en: 'No saved projects yet',
        ar: 'لا توجد مشاريع محفوظة بعد',
      ),
      _LearningProjectListMode.followed => const LocalizedText(
        en: 'No followed projects yet',
        ar: 'لا توجد مشاريع متابعة بعد',
      ),
    };
  }

  LocalizedText _emptySubtitleForMode(_LearningProjectListMode mode) {
    return switch (mode) {
      _LearningProjectListMode.all => const LocalizedText(
        en: 'When learning projects are published, they will appear here.',
        ar: 'عند نشر مشاريع تعليمية، ستظهر هنا.',
      ),
      _LearningProjectListMode.saved => const LocalizedText(
        en: 'Save projects from Learning Hub cards or project details to return to them here.',
        ar: 'احفظ المشاريع من بطاقات مركز التعلم أو تفاصيل المشروع للعودة إليها هنا.',
      ),
      _LearningProjectListMode.followed => const LocalizedText(
        en: 'Follow projects from Learning Hub cards or project details to keep them grouped here.',
        ar: 'تابع المشاريع من بطاقات مركز التعلم أو تفاصيل المشروع لتجميعها هنا.',
      ),
    };
  }
}

class _LearningListModeTabs extends StatelessWidget {
  const _LearningListModeTabs({
    required this.selectedMode,
    required this.onModeSelected,
  });

  final _LearningProjectListMode selectedMode;
  final ValueChanged<_LearningProjectListMode> onModeSelected;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: palette.cardSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Wrap(
        spacing: AppSpacing.sm,
        runSpacing: AppSpacing.sm,
        children: _LearningProjectListMode.values
            .map((mode) {
              final selected = mode == selectedMode;
              final label = switch (mode) {
                _LearningProjectListMode.all => const LocalizedText(
                  en: 'All projects',
                  ar: 'كل المشاريع',
                ),
                _LearningProjectListMode.saved => const LocalizedText(
                  en: 'Saved',
                  ar: 'محفوظ',
                ),
                _LearningProjectListMode.followed => const LocalizedText(
                  en: 'Following',
                  ar: 'المتابعة',
                ),
              };
              final icon = switch (mode) {
                _LearningProjectListMode.all => Icons.school_outlined,
                _LearningProjectListMode.saved => Icons.bookmark_border_rounded,
                _LearningProjectListMode.followed =>
                  Icons.notifications_none_rounded,
              };

              return ChoiceChip(
                selected: selected,
                avatar: Icon(
                  icon,
                  size: 18,
                  color: selected
                      ? AppColorTokens.emerald
                      : palette.textSecondary,
                ),
                label: Text(label.resolve(context)),
                onSelected: (_) => onModeSelected(mode),
                selectedColor: AppColorTokens.emerald.withValues(alpha: 0.10),
                backgroundColor: palette.mutedChip,
                side: BorderSide(
                  color: selected
                      ? AppColorTokens.emerald
                      : palette.borderSubtle,
                ),
                labelStyle: AppTextStyles.label(context).copyWith(
                  color: selected
                      ? (Theme.of(context).brightness == Brightness.dark
                            ? Colors.white
                            : AppColorTokens.emeraldDeep)
                      : palette.textSecondary,
                ),
              );
            })
            .toList(growable: false),
      ),
    );
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

    return Align(
      alignment: AlignmentDirectional.center,
      child: Container(
        padding: const EdgeInsetsDirectional.symmetric(
          horizontal: AppSpacing.xs,
          vertical: AppSpacing.xs,
        ),
        decoration: BoxDecoration(
          color: palette.hintSurface,
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
            final previous = _PaginationButton(
              label: const LocalizedText(en: 'Previous', ar: 'السابق'),
              icon: Icons.chevron_left_rounded,
              onPressed: canGoBack ? () => onPageChanged(page - 1) : null,
            );
            final next = _PaginationButton(
              label: const LocalizedText(en: 'Next', ar: 'التالي'),
              icon: Icons.chevron_right_rounded,
              onPressed: canGoForward ? () => onPageChanged(page + 1) : null,
            );

            if (compact) {
              return ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 320),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    pageLabel,
                    const SizedBox(height: AppSpacing.xs),
                    Row(
                      children: [
                        Expanded(child: previous),
                        const SizedBox(width: AppSpacing.xs),
                        Expanded(child: next),
                      ],
                    ),
                  ],
                ),
              );
            }

            return ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 348),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  SizedBox(width: 102, child: previous),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(child: pageLabel),
                  const SizedBox(width: AppSpacing.sm),
                  SizedBox(width: 102, child: next),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

class _PaginationButton extends StatelessWidget {
  const _PaginationButton({
    required this.label,
    required this.icon,
    required this.onPressed,
  });

  final LocalizedText label;
  final IconData icon;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);

    return OutlinedButton.icon(
      onPressed: onPressed,
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColorTokens.emerald,
        disabledForegroundColor: palette.textSecondary.withValues(alpha: 0.58),
        side: BorderSide(
          color: onPressed == null
              ? palette.borderSubtle.withValues(alpha: 0.7)
              : palette.borderSubtle,
        ),
        padding: const EdgeInsetsDirectional.symmetric(
          horizontal: AppSpacing.sm,
          vertical: AppSpacing.xs,
        ),
        minimumSize: const Size(0, 32),
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
      ),
      icon: Icon(icon, size: 16),
      label: Text(label.resolve(context)),
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
                  en: 'Saved and followed project lists are available. The next Learning Hub steps are persisted build progress, stronger project-material linking, and in-hub reservation handoff without automated matching.',
                  ar: 'قوائم المشاريع المحفوظة والمتابعة متاحة. الخطوات القادمة هي حفظ تقدم البناء، وتقوية ربط المشاريع بالمواد، وتحويل الحجز من داخل المركز بدون مطابقة آلية.',
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
  const _SubmitProjectCallout({
    required this.onSubmitProject,
    required this.onMySubmissions,
  });

  final VoidCallback onSubmitProject;
  final VoidCallback? onMySubmissions;

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
          final mySubmissionsButton = onMySubmissions == null
              ? null
              : _CalloutActionButton(
                  compact: compact,
                  maxWidth: 176,
                  child: OutlinedButton.icon(
                    onPressed: onMySubmissions,
                    icon: const Icon(Icons.assignment_outlined),
                    label: Text(
                      const LocalizedText(
                        en: 'My submissions',
                        ar: 'إرسالاتي',
                      ).resolve(context),
                    ),
                  ),
                );
          final addDraftButton = _CalloutActionButton(
            compact: compact,
            maxWidth: 196,
            child: FilledButton.icon(
              onPressed: onSubmitProject,
              icon: const Icon(Icons.edit_note_rounded),
              label: Text(
                const LocalizedText(
                  en: 'Add project draft',
                  ar: 'إضافة مسودة مشروع',
                ).resolve(context),
              ),
            ),
          );
          final actionChildren = <Widget>[];
          if (mySubmissionsButton != null) {
            actionChildren.add(mySubmissionsButton);
          }
          actionChildren.add(addDraftButton);

          if (compact) {
            final compactChildren = <Widget>[
              copy,
              const SizedBox(height: AppSpacing.md),
            ];
            if (mySubmissionsButton != null) {
              compactChildren.add(mySubmissionsButton);
              compactChildren.add(const SizedBox(height: AppSpacing.sm));
            }
            compactChildren.add(addDraftButton);

            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: compactChildren,
            );
          }

          final actions = Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            alignment: WrapAlignment.end,
            children: actionChildren,
          );

          return Row(
            children: [
              Expanded(child: copy),
              const SizedBox(width: AppSpacing.lg),
              Flexible(
                child: Align(
                  alignment: AlignmentDirectional.centerEnd,
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 392),
                    child: actions,
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _CalloutActionButton extends StatelessWidget {
  const _CalloutActionButton({
    required this.compact,
    required this.maxWidth,
    required this.child,
  });

  final bool compact;
  final double maxWidth;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: compact ? double.infinity : maxWidth,
      child: child,
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
      selectedColor: AppColorTokens.emerald,
      checkmarkColor: Colors.white,
      labelStyle: AppTextStyles.label(context).copyWith(
        color: selected ? Colors.white : palette.textSecondary,
        fontWeight: selected ? FontWeight.w800 : FontWeight.w700,
      ),
      backgroundColor: palette.cardSurfaceAlt,
      side: BorderSide(
        color: selected ? AppColorTokens.emerald : palette.borderSubtle,
      ),
    );
  }
}

class _HubInlineStatusBanner extends StatelessWidget {
  const _HubInlineStatusBanner({
    required this.icon,
    required this.message,
    this.showProgress = false,
    this.actionLabel,
    this.onAction,
  });

  final IconData icon;
  final LocalizedText message;
  final bool showProgress;
  final LocalizedText? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: palette.hintSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.hintBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(icon, size: 18, color: AppColorTokens.emerald),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  message.resolve(context),
                  style: AppTextStyles.label(
                    context,
                  ).copyWith(color: palette.textSecondary),
                ),
              ),
              if (actionLabel != null && onAction != null)
                TextButton(
                  onPressed: onAction,
                  child: Text(actionLabel!.resolve(context)),
                ),
            ],
          ),
          if (showProgress) ...[
            const SizedBox(height: AppSpacing.sm),
            ClipRRect(
              borderRadius: AppRadius.pillAll,
              child: LinearProgressIndicator(
                minHeight: 3,
                color: AppColorTokens.emerald,
                backgroundColor: palette.borderSubtle,
              ),
            ),
          ],
        ],
      ),
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
