import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/widgets/entry_nav_bar.dart';
import '../../data/learning_hub_mock_data.dart';
import '../../domain/models/learning_project.dart';
import '../widgets/disabled_ai_panel.dart';
import '../widgets/featured_project_card.dart';
import '../widgets/learning_category_chips.dart';
import '../widgets/learning_hub_hero.dart';
import '../widgets/learning_hub_text.dart';
import '../widgets/learning_project_card.dart';

class LearningHubPage extends StatefulWidget {
  const LearningHubPage({super.key});

  @override
  State<LearningHubPage> createState() => _LearningHubPageState();
}

class _LearningHubPageState extends State<LearningHubPage> {
  static const int _chunkSize = 4;
  int _visibleProjectCount = _chunkSize;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final featuredProject = learningProjects.firstWhere(
      (project) => project.isFeatured,
    );
    final projects = learningProjects
        .where((project) => !project.isFeatured)
        .toList();
    final visibleProjects = projects.take(_visibleProjectCount).toList();
    final hasMoreProjects = _visibleProjectCount < projects.length;

    return Scaffold(
      backgroundColor: palette.pageBackground,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const EntryNavBar(homeRoute: '/home'),
            Expanded(
              child: SingleChildScrollView(
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
                          stats: learningStats,
                        ),
                        const SizedBox(height: AppSpacing.lg),
                        const LearningCategoryChips(
                          categories: learningCategories,
                          selectedIndex: 0,
                        ),
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
                          '${learningProjects.length - 1} ${const LocalizedText(en: 'results', ar: 'نتيجة').resolve(context)}',
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
                                (width - ((columns - 1) * AppSpacing.md)) /
                                columns;

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
                              onPressed: () {
                                setState(() {
                                  _visibleProjectCount =
                                      (_visibleProjectCount + _chunkSize).clamp(
                                        0,
                                        projects.length,
                                      );
                                });
                              },
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
                        const SizedBox(height: AppSpacing.lg),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsetsDirectional.all(
                            AppSpacing.lg,
                          ),
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
                                        ).copyWith(
                                          color: palette.textPrimary,
                                        ),
                                      ),
                                      TextSpan(
                                        text: learningFeaturedTip.resolve(
                                          context,
                                        ),
                                      ),
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
              ),
            ),
          ],
        ),
      ),
    );
  }
}
