import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
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

  int _visibleProjectCount = _chunkSize;
  int _selectedCategoryIndex = 0;
  String? _selectedCategoryId;

  LearningProjectsQuery get _query => LearningProjectsQuery(
    page: 1,
    limit: 20,
    categoryId: _selectedCategoryId,
  );

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
                  if (result.items.isEmpty) {
                    return _HubStatePanel(
                      icon: Icons.school_outlined,
                      title: const LocalizedText(
                        en: 'No published projects yet',
                        ar: 'لا توجد مشاريع منشورة بعد',
                      ),
                      subtitle: const LocalizedText(
                        en: 'When learning projects are published, they will appear here.',
                        ar: 'عند نشر مشاريع تعليمية، ستظهر هنا.',
                      ),
                    );
                  }

                  return _HubContent(
                    result: result,
                    categoriesAsync: categoriesAsync,
                    selectedCategoryIndex: _selectedCategoryIndex,
                    visibleProjectCount: _visibleProjectCount,
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
    required this.visibleProjectCount,
    required this.onCategorySelected,
    required this.onLoadMore,
  });

  final LearningProjectsResult result;
  final AsyncValue<List<MaterialCategory>> categoriesAsync;
  final int selectedCategoryIndex;
  final int visibleProjectCount;
  final void Function(int index, String? categoryId) onCategorySelected;
  final VoidCallback onLoadMore;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final featuredProject = result.items.first;
    final otherProjects = result.items.length > 1
        ? result.items.sublist(1)
        : const <LearningProject>[];
    final visibleProjects = otherProjects
        .take(visibleProjectCount)
        .toList(growable: false);
    final hasMoreProjects = visibleProjectCount < otherProjects.length;
    final categoryLabels = _categoryLabels(categoriesAsync);
    final heroStats = <LocalizedText, int>{
      const LocalizedText(en: 'Published projects', ar: 'مشاريع منشورة'):
          result.total,
      LocalizedText(en: 'Categories', ar: 'فئات'): categoryLabels.length > 1
          ? categoryLabels.length - 1
          : 0,
    };

    return SingleChildScrollView(
      padding: const EdgeInsetsDirectional.fromSTEB(
        AppSpacing.md,
        AppSpacing.md,
        AppSpacing.md,
        AppSpacing.xl,
      ),
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
