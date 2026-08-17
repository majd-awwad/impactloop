import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../presentation/theme/learning_project_visuals.dart';
import '../../presentation/theme/learning_ui_palette.dart';
import '../../domain/models/learning_project.dart';
import 'learning_project_card_layout.dart';
import 'project_engagement_strip.dart';
import 'project_material_coverage_chip.dart';
import 'project_creator_identity.dart';

class LearningProjectCard extends StatelessWidget {
  const LearningProjectCard({
    super.key,
    required this.project,
    this.showCreatorAttribution = true,
  });

  final LearningProject project;
  final bool showCreatorAttribution;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final textTheme = Theme.of(context).textTheme;

    return SizedBox(
      height: LearningProjectCardLayout.gridCardHeight,
      child: Container(
        clipBehavior: Clip.antiAlias,
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
            Expanded(
              child: InkWell(
                onTap: () => context.push('/learning/${project.id}'),
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
                            _ProjectTitleRow(project: project),
                            const SizedBox(height: AppSpacing.sm),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    project.summary.resolve(context),
                                    style: textTheme.bodyMedium?.copyWith(
                                      color: palette.textSecondary,
                                      height: 1.35,
                                    ),
                                    textAlign: TextAlign.start,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  const SizedBox(height: AppSpacing.sm),
                                  ProjectMaterialCoverageChip(
                                    project: project,
                                    compact: true,
                                  ),
                                  const Spacer(),
                                  Wrap(
                                    spacing: AppSpacing.sm,
                                    runSpacing: AppSpacing.xs,
                                    children: [
                                      _ProjectMetaChip(
                                        label: project.category.resolve(
                                          context,
                                        ),
                                      ),
                                      _ProjectMetaChip(
                                        label: project.duration.resolve(
                                          context,
                                        ),
                                      ),
                                      if (project.componentCountLabel.en
                                          .trim()
                                          .isNotEmpty)
                                        _ProjectMetaChip(
                                          label: project.componentCountLabel
                                              .resolve(context),
                                        ),
                                    ],
                                  ),
                                  const SizedBox(height: AppSpacing.xs),
                                  ProjectEngagementStrip(
                                    project: project,
                                    density: ProjectEngagementDensity.compact,
                                  ),
                                ],
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
            if (showCreatorAttribution)
              if (project.creator case final creator?)
                LearningProjectCreatorFooter(creator: creator),
          ],
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
      height: LearningProjectCardLayout.coverHeight,
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
              padding: const EdgeInsetsDirectional.all(AppSpacing.md),
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
                      size: 48,
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
      child: Text(
        label,
        style: textTheme.labelSmall?.copyWith(
          color: palette.textSecondary,
          fontWeight: FontWeight.w600,
        ),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
    );
  }
}

/// Mobile horizontal project card matching Learning Hub reference density.
class LearningProjectCompactCard extends StatelessWidget {
  const LearningProjectCompactCard({super.key, required this.project});

  final LearningProject project;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final textTheme = Theme.of(context).textTheme;
    final readiness = project.personalBuildReadiness;
    final coverage = project.materialCoverage;
    // Only show progress when real coverage/readiness data exists.
    final progress = readiness?.readinessRatio ?? coverage?.availabilityRatio;

    return InkWell(
      borderRadius: AppRadius.lgAll,
      onTap: () => context.push('/learning/${project.id}'),
      child: Container(
        constraints: const BoxConstraints(
          minHeight: LearningProjectCardLayout.compactCardHeight,
        ),
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: palette.cardSurface,
          borderRadius: AppRadius.lgAll,
          border: Border.all(color: palette.borderSubtle),
          boxShadow: [
            BoxShadow(
              color: palette.cardShadow.withValues(alpha: 0.06),
              blurRadius: 14,
              offset: const Offset(0, 5),
            ),
          ],
        ),
        child: Stack(
          children: [
            PositionedDirectional(
              start: 0,
              top: 0,
              bottom: 0,
              width: LearningProjectCardLayout.compactImageWidth,
              child: _CompactCardImage(project: project),
            ),
            Padding(
              padding: const EdgeInsetsDirectional.only(
                start: LearningProjectCardLayout.compactImageWidth,
              ),
              child: Padding(
                padding: const EdgeInsetsDirectional.fromSTEB(
                  AppSpacing.sm + 2,
                  AppSpacing.sm + 2,
                  AppSpacing.sm + 2,
                  AppSpacing.sm,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                      Text(
                        project.title.resolve(context),
                        style: textTheme.titleSmall?.copyWith(
                          color: palette.textPrimary,
                          fontWeight: FontWeight.w800,
                          height: 1.22,
                          fontSize: 14.5,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        textAlign: TextAlign.start,
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      Wrap(
                        spacing: AppSpacing.xs,
                        runSpacing: AppSpacing.xs,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          _ProjectMetaChip(
                            label: project.category.resolve(context),
                          ),
                          _CompactDifficultyBadge(
                            label: project.difficulty.resolve(context),
                          ),
                        ],
                      ),
                      if (progress != null) ...[
                        const SizedBox(height: AppSpacing.sm),
                        Row(
                          children: [
                            Expanded(
                              child: ClipRRect(
                                borderRadius: AppRadius.pillAll,
                                child: LinearProgressIndicator(
                                  value: progress.clamp(0.0, 1.0),
                                  minHeight: 4,
                                  backgroundColor: palette.borderSubtle,
                                  color: palette.lime,
                                ),
                              ),
                            ),
                            const SizedBox(width: AppSpacing.sm),
                            Text(
                              '${(progress * 100).round()}%',
                              style: textTheme.labelSmall?.copyWith(
                                color: palette.textSecondary,
                                fontWeight: FontWeight.w600,
                                fontSize: 11,
                              ),
                            ),
                          ],
                        ),
                      ],
                      const SizedBox(height: AppSpacing.sm),
                      const Divider(height: 1),
                      const SizedBox(height: AppSpacing.sm),
                      ProjectEngagementStrip(
                        project: project,
                        density: ProjectEngagementDensity.compact,
                      ),
                      if (project.creator case final creator?) ...[
                        const SizedBox(height: AppSpacing.sm),
                        LearningProjectCreatorFooter(
                          creator: creator,
                          compact: true,
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
    );
  }
}

class _CompactDifficultyBadge extends StatelessWidget {
  const _CompactDifficultyBadge({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final textTheme = Theme.of(context).textTheme;

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(Icons.equalizer_rounded, size: 14, color: palette.lime),
        const SizedBox(width: 3),
        Text(
          label,
          style: textTheme.labelSmall?.copyWith(
            color: palette.textSecondary,
            fontWeight: FontWeight.w600,
            fontSize: 11.5,
          ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ],
    );
  }
}

class _CompactCardImage extends StatelessWidget {
  const _CompactCardImage({required this.project});

  final LearningProject project;

  @override
  Widget build(BuildContext context) {
    final hasImage = project.imageUrl != null && project.imageUrl!.isNotEmpty;

    return ColoredBox(
      color: projectImagePlaceholderColor(context),
      child: hasImage
          ? Image.network(
              project.imageUrl!,
              fit: BoxFit.cover,
              alignment: Alignment.center,
              errorBuilder: (context, error, stackTrace) =>
                  const _PlaceholderIcon(),
            )
          : const _PlaceholderIcon(),
    );
  }
}

class _PlaceholderIcon extends StatelessWidget {
  const _PlaceholderIcon();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Icon(
        Icons.school_outlined,
        size: 34,
        color: projectImagePlaceholderIconColor(context),
      ),
    );
  }
}
