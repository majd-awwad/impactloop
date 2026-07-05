import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_color_tokens.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../presentation/theme/learning_project_visuals.dart';
import '../../presentation/theme/learning_ui_palette.dart';
import '../../domain/models/learning_project.dart';

class LearningProjectCard extends StatelessWidget {
  const LearningProjectCard({super.key, required this.project});

  final LearningProject project;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);

    return SizedBox(
      height: 392,
      child: InkWell(
        borderRadius: AppRadius.xlAll,
        onTap: () => context.push('/learning/${project.id}'),
        child: Container(
          decoration: BoxDecoration(
            color: palette.cardSurface,
            borderRadius: AppRadius.xlAll,
            border: Border.all(color: palette.borderSubtle),
            boxShadow: [
              BoxShadow(
                color: palette.cardShadow,
                blurRadius: 18,
                offset: const Offset(0, 6),
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
                        height: 58,
                        child: _ProjectTitleRow(project: project),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      SizedBox(
                        height: 56,
                        child: Text(
                          project.summary.resolve(context),
                          style: AppTextStyles.subtitle(
                            context,
                          ).copyWith(color: palette.textSecondary),
                          textAlign: TextAlign.start,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const Spacer(),
                      SizedBox(
                        height: 40,
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
                                if (project.likesCount > 0 ||
                                    project.isLiked) ...[
                                  const SizedBox(width: AppSpacing.sm),
                                  _ProjectMetaChip(
                                    label: project.likesCount == 1
                                        ? '1 like'
                                        : '${project.likesCount} likes',
                                    icon: project.isLiked
                                        ? Icons.favorite_rounded
                                        : Icons.favorite_border_rounded,
                                    accent: project.isLiked,
                                  ),
                                ],
                                if (project.isSaved) ...[
                                  const SizedBox(width: AppSpacing.sm),
                                  _ProjectMetaChip(
                                    label: 'Saved',
                                    icon: Icons.bookmark_rounded,
                                    accent: true,
                                  ),
                                ],
                                if (project.followersCount > 0 ||
                                    project.isFollowing) ...[
                                  const SizedBox(width: AppSpacing.sm),
                                  _ProjectMetaChip(
                                    label: project.followersCount == 1
                                        ? '1 follower'
                                        : '${project.followersCount} followers',
                                    icon: project.isFollowing
                                        ? Icons.notifications_active_rounded
                                        : Icons.notifications_none_rounded,
                                    accent: project.isFollowing,
                                  ),
                                ],
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

    return SizedBox(
      height: 190,
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: const BorderRadiusDirectional.only(
            topStart: Radius.circular(AppRadius.xl),
            topEnd: Radius.circular(AppRadius.xl),
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
                  topStart: Radius.circular(AppRadius.xl),
                  topEnd: Radius.circular(AppRadius.xl),
                ),
                child: Image.network(
                  project.imageUrl!,
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) =>
                      const SizedBox.shrink(),
                ),
              ),
            DecoratedBox(
              decoration: BoxDecoration(
                borderRadius: const BorderRadiusDirectional.only(
                  topStart: Radius.circular(AppRadius.xl),
                  topEnd: Radius.circular(AppRadius.xl),
                ),
                color: palette.overlayDark.withValues(alpha: 0.42),
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
                        color: palette.lime,
                        borderRadius: AppRadius.pillAll,
                      ),
                      child: Text(
                        project.difficulty.resolve(context),
                        style: AppTextStyles.label(
                          context,
                        ).copyWith(color: AppColorTokens.emeraldDeep),
                      ),
                    ),
                  ),
                  const Spacer(),
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
    final ratingPill = project.hasRatings
        ? Container(
            padding: const EdgeInsetsDirectional.symmetric(
              horizontal: AppSpacing.sm,
              vertical: AppSpacing.xs,
            ),
            decoration: BoxDecoration(
              color: palette.darkSurfaceSoft,
              borderRadius: AppRadius.pillAll,
              border: Border.all(color: palette.borderSubtle),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  project.ratingValue.toStringAsFixed(1),
                  style: AppTextStyles.label(
                    context,
                  ).copyWith(color: palette.textPrimary),
                ),
                const SizedBox(width: AppSpacing.xs),
                const Icon(Icons.star_rounded, color: learningLime, size: 18),
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
                style: AppTextStyles.title(
                  context,
                ).copyWith(color: palette.textPrimary),
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
                style: AppTextStyles.title(
                  context,
                ).copyWith(color: palette.textPrimary),
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
  const _ProjectMetaChip({required this.label, this.icon, this.accent = false});

  final String label;
  final IconData? icon;
  final bool accent;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);

    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: accent
            ? palette.lime.withValues(alpha: 0.16)
            : palette.mutedChip,
        borderRadius: AppRadius.pillAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(
              icon,
              size: 16,
              color: accent ? palette.limeSoft : palette.textSecondary,
            ),
            const SizedBox(width: AppSpacing.xs),
          ],
          Text(
            label,
            style: AppTextStyles.body(context).copyWith(
              color: accent ? palette.limeSoft : palette.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}
