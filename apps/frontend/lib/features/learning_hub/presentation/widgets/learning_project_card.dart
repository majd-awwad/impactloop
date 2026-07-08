import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../presentation/theme/learning_project_visuals.dart';
import '../../presentation/theme/learning_ui_palette.dart';
import '../../domain/models/learning_project.dart';
import 'project_engagement_strip.dart';

class LearningProjectCard extends StatelessWidget {
  const LearningProjectCard({super.key, required this.project});

  final LearningProject project;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final textTheme = Theme.of(context).textTheme;

    return SizedBox(
      height: 456,
      child: InkWell(
        borderRadius: AppRadius.lgAll,
        onTap: () => context.push('/learning/${project.id}'),
        child: Container(
          decoration: BoxDecoration(
            color: palette.cardSurface,
            borderRadius: AppRadius.lgAll,
            border: Border.all(color: palette.borderSubtle),
            boxShadow: [
              BoxShadow(
                color: palette.cardShadow.withValues(alpha: 0.08),
                blurRadius: 18,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _ProjectCardHeader(project: project),
              Expanded(
                child: Padding(
                  padding: const EdgeInsetsDirectional.all(AppSpacing.md),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SizedBox(
                        height: 54,
                        child: _ProjectTitleRow(project: project),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      Text(
                        project.summary.resolve(context),
                        style: textTheme.bodyMedium?.copyWith(
                          color: palette.textSecondary,
                        ),
                        textAlign: TextAlign.start,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      SizedBox(
                        height: 36,
                        child: Align(
                          alignment: AlignmentDirectional.centerStart,
                          child: SingleChildScrollView(
                            scrollDirection: Axis.horizontal,
                            child: Row(
                              children: [
                                _ProjectMetaChip(
                                  label: project.category.resolve(context),
                                ),
                                const SizedBox(width: AppSpacing.sm),
                                _ProjectMetaChip(
                                  label: project.duration.resolve(context),
                                ),
                                if (project.componentCountLabel.en
                                    .trim()
                                    .isNotEmpty) ...[
                                  const SizedBox(width: AppSpacing.sm),
                                  _ProjectMetaChip(
                                    label: project.componentCountLabel.resolve(
                                      context,
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ),
                      ),
                      const Spacer(),
                      SizedBox(
                        height: 36,
                        child: ProjectEngagementStrip(
                          project: project,
                          density: ProjectEngagementDensity.compact,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ProjectCardHeader extends StatelessWidget {
  const _ProjectCardHeader({required this.project});

  final LearningProject project;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final textTheme = Theme.of(context).textTheme;

    return SizedBox(
      height: 190,
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: const BorderRadiusDirectional.only(
            topStart: Radius.circular(AppRadius.lg),
            topEnd: Radius.circular(AppRadius.lg),
          ),
          gradient: LinearGradient(
            begin: AlignmentDirectional.topStart,
            end: AlignmentDirectional.bottomEnd,
            colors: projectGradient(project),
          ),
        ),
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (project.imageUrl != null)
              ClipRRect(
                borderRadius: const BorderRadiusDirectional.only(
                  topStart: Radius.circular(AppRadius.lg),
                  topEnd: Radius.circular(AppRadius.lg),
                ),
                child: Image.network(
                  project.imageUrl!,
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) =>
                      const SizedBox.shrink(),
                ),
              ),
            if (project.imageUrl != null)
              DecoratedBox(
                decoration: BoxDecoration(
                  borderRadius: const BorderRadiusDirectional.only(
                    topStart: Radius.circular(AppRadius.lg),
                    topEnd: Radius.circular(AppRadius.lg),
                  ),
                  color: palette.overlayDark.withValues(alpha: 0.20),
                ),
              )
            else
              DecoratedBox(
                decoration: BoxDecoration(
                  borderRadius: const BorderRadiusDirectional.only(
                    topStart: Radius.circular(AppRadius.lg),
                    topEnd: Radius.circular(AppRadius.lg),
                  ),
                  color: palette.overlayDark.withValues(alpha: 0.30),
                ),
              ),
            Padding(
              padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Align(
                    alignment: AlignmentDirectional.centerEnd,
                    child: Container(
                      padding: const EdgeInsetsDirectional.symmetric(
                        horizontal: AppSpacing.sm,
                        vertical: AppSpacing.xs,
                      ),
                      decoration: BoxDecoration(
                        color: palette.limeSoft,
                        borderRadius: AppRadius.pillAll,
                        border: Border.all(
                          color: palette.lime.withValues(alpha: 0.28),
                        ),
                      ),
                      child: Text(
                        project.difficulty.resolve(context),
                        style: textTheme.labelSmall?.copyWith(
                          color: palette.lime,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                  const Spacer(),
                  if (project.imageUrl == null)
                    Icon(
                      project.heroIconData,
                      size: 54,
                      color: palette.textPrimary,
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ProjectTitleRow extends StatelessWidget {
  const _ProjectTitleRow({required this.project});

  final LearningProject project;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final textTheme = Theme.of(context).textTheme;
    final ratingPill = project.hasRatings
        ? Container(
            padding: const EdgeInsetsDirectional.symmetric(
              horizontal: AppSpacing.sm,
              vertical: AppSpacing.xs,
            ),
            decoration: BoxDecoration(
              color: palette.cardSurfaceAlt,
              borderRadius: AppRadius.pillAll,
              border: Border.all(color: palette.borderSubtle),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  project.ratingValue.toStringAsFixed(1),
                  style: textTheme.labelSmall?.copyWith(
                    color: palette.textPrimary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(width: AppSpacing.xs),
                Icon(Icons.star_rounded, color: palette.lime, size: 18),
              ],
            ),
          )
        : null;

    return LayoutBuilder(
      builder: (context, constraints) {
        final wide = constraints.maxWidth >= 280;

        if (!wide) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                project.title.resolve(context),
                style: textTheme.titleMedium?.copyWith(
                  color: palette.textPrimary,
                  fontWeight: FontWeight.w700,
                  height: 1.18,
                ),
                textAlign: TextAlign.start,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              if (ratingPill != null) ...[
                const SizedBox(height: AppSpacing.sm),
                ratingPill,
              ],
            ],
          );
        }

        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Text(
                project.title.resolve(context),
                style: textTheme.titleMedium?.copyWith(
                  color: palette.textPrimary,
                  fontWeight: FontWeight.w700,
                  height: 1.18,
                ),
                textAlign: TextAlign.start,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            if (ratingPill != null) ...[
              const SizedBox(width: AppSpacing.sm),
              ratingPill,
            ],
          ],
        );
      },
    );
  }
}

class _ProjectMetaChip extends StatelessWidget {
  const _ProjectMetaChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final textTheme = Theme.of(context).textTheme;

    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: palette.mutedChip,
        borderRadius: AppRadius.pillAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 190),
            child: Text(
              label,
              style: textTheme.labelSmall?.copyWith(
                color: palette.textSecondary,
                fontWeight: FontWeight.w600,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}
