import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../data/learning_hub_mock_data.dart';
import '../../domain/models/learning_project.dart';

class LearningProjectCard extends StatelessWidget {
  const LearningProjectCard({super.key, required this.project});

  final LearningProject project;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: AppRadius.xlAll,
      onTap: () => context.go('/learning/${project.id}'),
      child: Container(
        decoration: BoxDecoration(
          color: learningCardSurface,
          borderRadius: AppRadius.xlAll,
          border: Border.all(color: learningBorderSubtle),
          boxShadow: const [
            BoxShadow(
              color: learningCardShadow,
              blurRadius: 18,
              offset: Offset(0, 6),
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _ProjectCardHeader(project: project),
            Padding(
              padding: const EdgeInsetsDirectional.all(AppSpacing.md),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _ProjectTitleRow(project: project),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    project.summary.resolve(context),
                    style: AppTextStyles.subtitle(
                      context,
                    ).copyWith(color: learningTextSecondary),
                    textAlign: TextAlign.start,
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: AppSpacing.md),
                  Wrap(
                    spacing: AppSpacing.sm,
                    runSpacing: AppSpacing.sm,
                    children: [
                      _ProjectMetaChip(label: project.category.resolve(context)),
                      _ProjectMetaChip(
                        label: project.componentCountLabel.resolve(context),
                      ),
                      _ProjectMetaChip(label: project.duration.resolve(context)),
                    ],
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

class _ProjectCardHeader extends StatelessWidget {
  const _ProjectCardHeader({required this.project});

  final LearningProject project;

  @override
  Widget build(BuildContext context) {
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
                color: learningOverlayDark.withValues(alpha: 0.42),
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
                        color: learningLime,
                        borderRadius: AppRadius.pillAll,
                      ),
                      child: Text(
                        project.difficulty.resolve(context),
                        style: AppTextStyles.label(
                          context,
                        ).copyWith(color: Colors.black87),
                      ),
                    ),
                  ),
                  const Spacer(),
                  Icon(
                    project.heroIconData,
                    size: 54,
                    color: learningTextPrimary,
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
    final ratingPill = Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: learningDarkSurfaceSoft,
        borderRadius: AppRadius.pillAll,
        border: Border.all(color: learningBorderSubtle),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            project.ratingValue.toStringAsFixed(1),
            style: AppTextStyles.label(
              context,
            ).copyWith(color: learningTextPrimary),
          ),
          const SizedBox(width: AppSpacing.xs),
          const Icon(Icons.star_rounded, color: learningLime, size: 18),
        ],
      ),
    );

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
                ).copyWith(color: learningTextPrimary),
                textAlign: TextAlign.start,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: AppSpacing.sm),
              ratingPill,
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
                ).copyWith(color: learningTextPrimary),
                textAlign: TextAlign.start,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            ratingPill,
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
    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: learningMutedChip,
        borderRadius: AppRadius.pillAll,
        border: Border.all(color: learningBorderSubtle),
      ),
      child: Text(
        label,
        style: AppTextStyles.body(
          context,
        ).copyWith(color: learningTextSecondary),
      ),
    );
  }
}
