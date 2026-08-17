import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../presentation/theme/learning_project_visuals.dart';
import '../../presentation/theme/learning_ui_palette.dart';
import '../../domain/models/learning_project.dart';
import 'project_engagement_strip.dart';
import 'project_material_coverage_chip.dart';

class FeaturedProjectCard extends StatelessWidget {
  const FeaturedProjectCard({super.key, required this.project});

  final LearningProject project;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);

    return Container(
      decoration: BoxDecoration(
        color: palette.cardSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderSubtle),
        boxShadow: [
          BoxShadow(
            color: palette.cardShadow.withValues(alpha: 0.08),
            blurRadius: 24,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
        child: LayoutBuilder(
          builder: (context, constraints) {
            final compact = constraints.maxWidth < 760;

            return compact
                ? Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _FeaturedMedia(
                        project: project,
                        compact: true,
                        width: constraints.maxWidth,
                      ),
                      const SizedBox(height: AppSpacing.md),
                      _FeaturedContent(project: project, compact: true),
                    ],
                  )
                : Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _FeaturedMedia(
                        project: project,
                        compact: false,
                        width: 228,
                      ),
                      const SizedBox(width: AppSpacing.lg),
                      Expanded(
                        child: _FeaturedContent(
                          project: project,
                          compact: false,
                        ),
                      ),
                    ],
                  );
          },
        ),
      ),
    );
  }
}

class _FeaturedContent extends StatelessWidget {
  const _FeaturedContent({required this.project, required this.compact});

  final LearningProject project;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final textTheme = Theme.of(context).textTheme;
    final buttonChild = FilledButton.icon(
      onPressed: () => context.push('/learning/${project.id}'),
      icon: const Icon(Icons.arrow_forward_rounded),
      label: Text(
        const LocalizedText(en: 'Explore', ar: 'استكشف').resolve(context),
      ),
    );

    return Column(
      crossAxisAlignment: compact
          ? CrossAxisAlignment.stretch
          : CrossAxisAlignment.start,
      children: [
        Align(
          alignment: AlignmentDirectional.centerStart,
          child: Container(
            padding: const EdgeInsetsDirectional.symmetric(
              horizontal: AppSpacing.sm,
              vertical: AppSpacing.xs,
            ),
            decoration: BoxDecoration(
              color: palette.cardSurfaceAlt,
              borderRadius: AppRadius.pillAll,
              border: Border.all(color: palette.borderSubtle),
            ),
            child: Text(
              const LocalizedText(
                en: 'Project of the week',
                ar: 'مشروع الأسبوع',
              ).resolve(context),
              style: textTheme.labelSmall?.copyWith(
                color: palette.textPrimary,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        Text(
          project.title.resolve(context),
          style: AppTextStyles.title(context).copyWith(
            color: palette.textPrimary,
            fontWeight: FontWeight.w800,
            height: 1.2,
          ),
          textAlign: TextAlign.start,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          project.summary.resolve(context),
          style: AppTextStyles.body(
            context,
          ).copyWith(color: palette.textSecondary),
          textAlign: TextAlign.start,
          maxLines: compact ? 3 : 2,
          overflow: TextOverflow.ellipsis,
        ),
        const SizedBox(height: AppSpacing.md),
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: [
            _MetaChip(label: project.difficulty.resolve(context)),
            _MetaChip(label: project.duration.resolve(context)),
            if (project.componentCountLabel.en.trim().isNotEmpty)
              _MetaChip(label: project.componentCountLabel.resolve(context)),
            if (project.hasRatings)
              _MetaChip(
                label:
                    '${project.ratingValue.toStringAsFixed(1)} (${project.ratingCount} ${project.ratingLabel.resolve(context)})',
                accent: true,
              ),
          ],
        ),
        const SizedBox(height: AppSpacing.md),
        ProjectMaterialCoverageChip(project: project, compact: true),
        const SizedBox(height: AppSpacing.sm),
        ProjectEngagementStrip(project: project),
        const SizedBox(height: AppSpacing.lg),
        compact ? buttonChild : SizedBox(width: 176, child: buttonChild),
      ],
    );
  }
}

class _FeaturedMedia extends StatelessWidget {
  const _FeaturedMedia({
    required this.project,
    required this.compact,
    required this.width,
  });

  final LearningProject project;
  final bool compact;
  final double width;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);

    return SizedBox(
      width: width,
      height: compact ? 180 : 228,
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: AppRadius.lgAll,
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
                borderRadius: AppRadius.lgAll,
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
                  borderRadius: AppRadius.lgAll,
                  color: palette.overlayDark.withValues(alpha: 0.22),
                ),
              )
            else ...[
              DecoratedBox(
                decoration: BoxDecoration(
                  borderRadius: AppRadius.lgAll,
                  color: palette.overlayDark,
                ),
              ),
              Align(
                alignment: AlignmentDirectional.center,
                child: Icon(
                  project.heroIconData,
                  size: compact ? 48 : 58,
                  color: palette.textPrimary,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _MetaChip extends StatelessWidget {
  const _MetaChip({required this.label, this.accent = false});

  final String label;
  final bool accent;

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
        color: accent ? palette.limeSoft : palette.cardSurfaceAlt,
        borderRadius: AppRadius.pillAll,
        border: Border.all(
          color: accent
              ? palette.lime.withValues(alpha: 0.28)
              : palette.borderSubtle,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label,
            style: textTheme.labelSmall?.copyWith(
              color: accent ? palette.lime : palette.textSecondary,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
