import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../learning_hub/application/learning_hub_providers.dart';
import '../../../learning_hub/domain/learning_projects_result.dart';
import '../../../learning_hub/domain/models/learning_project.dart';
import '../../../learning_hub/presentation/theme/learning_project_visuals.dart';
import 'empty_activity_card.dart';
import 'home_section_header.dart';

const _homeSpotlightQuery = LearningProjectsQuery(page: 1, limit: 2);

class LearningSpotlightSection extends ConsumerWidget {
  const LearningSpotlightSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final spotlightState = ref.watch(
      learningProjectsProvider(_homeSpotlightQuery),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        HomeSectionHeader(
          title: 'Learning spotlight',
          subtitle:
              'Start with project guides built from real reusable materials.',
          action: HomeSectionActionButton(
            onPressed: () => context.go('/learning'),
            icon: const Icon(Icons.arrow_forward_rounded),
            label: 'Browse all',
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
                title: 'No learning projects published yet',
                description:
                    'When learning projects are published, featured guides will appear here.',
                actionLabel: 'Open Learning Hub',
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
      height: 326,
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
                  'Unable to load learning projects',
                  style: AppTextStyles.title(
                    context,
                  ).copyWith(color: palette.textPrimary, letterSpacing: 0),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  'The home page is still available. Try again when the Learning Hub API is running.',
                  style: AppTextStyles.body(context).copyWith(
                    color: palette.textSecondary,
                    height: 1.45,
                    letterSpacing: 0,
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                OutlinedButton(
                  onPressed: onRetry,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: palette.mint,
                    side: BorderSide(color: palette.borderStrong),
                    shape: RoundedRectangleBorder(
                      borderRadius: AppRadius.pillAll,
                    ),
                  ),
                  child: const Text('Retry'),
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
    final palette = MaterialsUiPalette.of(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final hasImage =
        project.imageUrl != null && project.imageUrl!.trim().isNotEmpty;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => context.push('/learning/${project.id}'),
        borderRadius: AppRadius.lgAll,
        child: SizedBox(
          height: 326,
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
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
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
                Expanded(
                  child: Padding(
                    padding: const EdgeInsetsDirectional.all(AppSpacing.md),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
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
                        const Spacer(),
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
                      ],
                    ),
                  ),
                ),
              ],
            ),
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
