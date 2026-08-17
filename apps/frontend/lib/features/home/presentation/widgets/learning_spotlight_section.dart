import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../l10n/l10n.dart';
import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../learning_hub/application/learning_hub_providers.dart';
import '../../../learning_hub/domain/learning_projects_result.dart';
import '../../../learning_hub/domain/models/learning_project.dart';
import '../../../learning_hub/presentation/theme/learning_project_visuals.dart';
import '../../../learning_hub/presentation/widgets/project_engagement_strip.dart';
import '../../../learning_hub/presentation/widgets/project_material_coverage_chip.dart';
import 'empty_activity_card.dart';
import 'home_section_header.dart';

const _homeSpotlightQuery = LearningProjectsQuery(page: 1, limit: 2);

class LearningSpotlightSection extends ConsumerWidget {
  const LearningSpotlightSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final spotlightState = ref.watch(
      learningProjectsProvider(_homeSpotlightQuery),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        HomeSectionHeader(
          title: l10n.sectionLearningSpotlightTitle,
          subtitle: l10n.sectionLearningSpotlightSubtitle,
          action: HomeSectionActionButton(
            onPressed: () => context.go('/learning'),
            icon: const Icon(Icons.arrow_forward_rounded),
            label: l10n.browseAll,
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        spotlightState.when(
          loading: () => const _LearningSpotlightLoading(),
          error: (error, stackTrace) => _LearningSpotlightError(
            onRetry: () =>
                ref.invalidate(learningProjectsProvider(_homeSpotlightQuery)),
          ),
          data: (result) {
            final projects = result.items.take(2).toList(growable: false);

            if (projects.isEmpty) {
              return EmptyActivityCard(
                icon: Icons.school_outlined,
                title: l10n.sectionLearningSpotlightEmpty,
                description: l10n.sectionLearningSpotlightEmptyDescription,
                actionLabel: l10n.openLearningHub,
                onAction: () => context.go('/learning'),
              );
            }

            return LayoutBuilder(
              builder: (context, constraints) {
                final wide = constraints.maxWidth >= 760;
                final itemWidth = wide
                    ? (constraints.maxWidth - AppSpacing.md) / 2
                    : constraints.maxWidth;

                return Wrap(
                  spacing: AppSpacing.md,
                  runSpacing: AppSpacing.md,
                  children: projects.map((project) {
                    return SizedBox(
                      width: itemWidth,
                      child: _LearningSpotlightCard(project: project),
                    );
                  }).toList(),
                );
              },
            );
          },
        ),
      ],
    );
  }
}

class _LearningSpotlightLoading extends StatelessWidget {
  const _LearningSpotlightLoading();

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Container(
      height: 374,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: palette.panelSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: CircularProgressIndicator(color: palette.mint),
    );
  }
}

class _LearningSpotlightError extends StatelessWidget {
  const _LearningSpotlightError({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final palette = MaterialsUiPalette.of(context);

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: palette.panelSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.cloud_off_outlined, color: materialWarning),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l10n.homeLearningSpotlightLoadError,
                  style: AppTextStyles.title(
                    context,
                  ).copyWith(color: palette.textPrimary, letterSpacing: 0),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  l10n.homeLearningSpotlightLoadErrorSubtitle,
                  style: AppTextStyles.body(context).copyWith(
                    color: palette.textSecondary,
                    height: 1.45,
                    letterSpacing: 0,
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                OutlinedButton(
                  onPressed: onRetry,
                  style: AppStatusButtonStyle.outlined(
                    context,
                    AppStatusTone.primary,
                  ),
                  child: Text(l10n.retry),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _LearningSpotlightCard extends StatelessWidget {
  const _LearningSpotlightCard({required this.project});

  final LearningProject project;

  @override
  Widget build(BuildContext context) {
    return HomeLearningProjectCard(project: project);
  }
}

/// Vertical learning project card used on the learner home feed.
class HomeLearningProjectCard extends StatelessWidget {
  const HomeLearningProjectCard({
    super.key,
    required this.project,
    this.reason,
  });

  final LearningProject project;
  final String? reason;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final hasImage =
        project.imageUrl != null && project.imageUrl!.trim().isNotEmpty;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => context.push(
          '/learning/${project.id}',
          extra: project.recommendationImpressionId,
        ),
        borderRadius: AppRadius.lgAll,
        child: Container(
          decoration: BoxDecoration(
            color: palette.cardSurface,
            borderRadius: AppRadius.lgAll,
            border: Border.all(color: palette.borderStrong),
            boxShadow: [
              BoxShadow(
                color: palette.cardShadow,
                blurRadius: 20,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              SizedBox(
                height: 132,
                child: ClipRRect(
                    borderRadius: const BorderRadiusDirectional.only(
                      topStart: Radius.circular(AppRadius.lg),
                      topEnd: Radius.circular(AppRadius.lg),
                    ),
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: AlignmentDirectional.topStart,
                          end: AlignmentDirectional.bottomEnd,
                          colors: projectGradient(project),
                        ),
                      ),
                      child: Stack(
                        fit: StackFit.expand,
                        children: [
                          if (hasImage)
                            Image.network(
                              project.imageUrl!.trim(),
                              fit: BoxFit.cover,
                              errorBuilder: (context, error, stackTrace) =>
                                  const SizedBox.shrink(),
                            ),
                          DecoratedBox(
                            decoration: BoxDecoration(
                              color: palette.overlayDark.withValues(
                                alpha: hasImage
                                    ? (isDark ? 0.52 : 0.28)
                                    : (isDark ? 0.14 : 0.04),
                              ),
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsetsDirectional.all(
                              AppSpacing.md,
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Align(
                                  alignment: AlignmentDirectional.centerStart,
                                  child: Container(
                                    padding:
                                        const EdgeInsetsDirectional.symmetric(
                                          horizontal: AppSpacing.sm,
                                          vertical: AppSpacing.xs,
                                        ),
                                    decoration: BoxDecoration(
                                      color: palette.cardSurface.withValues(
                                        alpha: isDark ? 0.78 : 0.86,
                                      ),
                                      borderRadius: AppRadius.pillAll,
                                      border: Border.all(
                                        color: palette.borderStrong.withValues(
                                          alpha: 0.72,
                                        ),
                                      ),
                                    ),
                                    child: Text(
                                      project.category.resolve(context),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: AppTextStyles.label(context)
                                          .copyWith(
                                            color: palette.textPrimary,
                                            fontSize: 12,
                                            letterSpacing: 0,
                                          ),
                                    ),
                                  ),
                                ),
                                const Spacer(),
                                Align(
                                  alignment: AlignmentDirectional.bottomStart,
                                  child: Container(
                                    width: 44,
                                    height: 44,
                                    decoration: BoxDecoration(
                                      color: palette.cardSurfaceAlt.withValues(
                                        alpha: isDark ? 0.82 : 0.92,
                                      ),
                                      borderRadius: BorderRadius.circular(14),
                                      border: Border.all(
                                        color: palette.borderStrong,
                                      ),
                                    ),
                                    child: Icon(
                                      project.heroIconData,
                                      color: palette.mint,
                                      size: 22,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsetsDirectional.all(AppSpacing.md),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        project.title.resolve(context),
                        style: AppTextStyles.title(context).copyWith(
                          color: palette.textPrimary,
                          letterSpacing: 0,
                        ),
                        textAlign: TextAlign.start,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      Text(
                        project.summary.resolve(context),
                        style: AppTextStyles.body(context).copyWith(
                          color: palette.textSecondary,
                          height: 1.45,
                          letterSpacing: 0,
                        ),
                        textAlign: TextAlign.start,
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      Wrap(
                        spacing: AppSpacing.sm,
                        runSpacing: AppSpacing.sm,
                        children: [
                          _LearningMetaChip(
                            label: project.duration.resolve(context),
                          ),
                          _LearningMetaChip(
                            label: project.difficulty.resolve(context),
                          ),
                          if (project.hasRatings)
                            _LearningMetaChip(
                              label:
                                  '${project.ratingValue.toStringAsFixed(1)} (${project.ratingCount})',
                            ),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      ProjectMaterialCoverageChip(
                        project: project,
                        compact: true,
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      if (reason != null && reason!.trim().isNotEmpty) ...[
                        Text(
                          reason!.trim(),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: AppTextStyles.label(context).copyWith(
                            color: palette.mint,
                            fontSize: 12,
                            height: 1.25,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.sm),
                      ],
                      ProjectEngagementStrip(
                        project: project,
                        recommendationImpressionId:
                            project.recommendationImpressionId,
                        density: ProjectEngagementDensity.compact,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
    );
  }
}

class _LearningMetaChip extends StatelessWidget {
  const _LearningMetaChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: palette.cardSurfaceAlt,
        borderRadius: AppRadius.pillAll,
        border: Border.all(color: palette.borderStrong),
      ),
      child: Text(
        label,
        style: AppTextStyles.label(context).copyWith(
          color: palette.textSecondary,
          fontSize: 12,
          fontWeight: FontWeight.w600,
          height: 1.15,
        ),
      ),
    );
  }
}
