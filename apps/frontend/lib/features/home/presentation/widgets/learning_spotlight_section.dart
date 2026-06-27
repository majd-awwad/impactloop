import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../learning_hub/data/learning_hub_mock_data.dart';
import '../../../learning_hub/domain/models/learning_project.dart';
import 'home_section_header.dart';

class LearningSpotlightSection extends StatelessWidget {
  const LearningSpotlightSection({super.key});

  @override
  Widget build(BuildContext context) {
    final previewProjects = learningProjects.take(2).toList(growable: false);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        HomeSectionHeader(
          title: 'Learning spotlight',
          subtitle:
              'Browse practical project ideas while the Learning Hub remains UI-only.',
          action: HomeSectionActionButton(
            onPressed: () => context.go('/learning'),
            icon: const Icon(Icons.arrow_forward_rounded),
            label: 'Browse all',
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        LayoutBuilder(
          builder: (context, constraints) {
            final wide = constraints.maxWidth >= 760;
            final itemWidth = wide
                ? (constraints.maxWidth - AppSpacing.md) / 2
                : constraints.maxWidth;

            return Wrap(
              spacing: AppSpacing.md,
              runSpacing: AppSpacing.md,
              children: previewProjects.map((project) {
                return SizedBox(
                  width: itemWidth,
                  child: _LearningPreviewCard(project: project),
                );
              }).toList(),
            );
          },
        ),
      ],
    );
  }
}

class _LearningPreviewCard extends StatelessWidget {
  const _LearningPreviewCard({required this.project});

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
        onTap: () => context.go('/learning/${project.id}'),
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
                                      'Learning Hub preview',
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
                              label: project.category.resolve(context),
                            ),
                            _LearningMetaChip(
                              label: project.duration.resolve(context),
                            ),
                            _LearningMetaChip(
                              label: project.difficulty.resolve(context),
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
