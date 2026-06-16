import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../data/learning_hub_mock_data.dart';
import '../../domain/models/learning_project.dart';

class FeaturedProjectCard extends StatelessWidget {
  const FeaturedProjectCard({super.key, required this.project});

  final LearningProject project;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: learningCardSurface,
        borderRadius: AppRadius.xlAll,
        border: Border.all(color: learningBorderSubtle),
        boxShadow: const [
          BoxShadow(
            color: learningCardShadow,
            blurRadius: 28,
            offset: Offset(0, 12),
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
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _FeaturedMedia(project: project, compact: true),
                      const SizedBox(height: AppSpacing.md),
                      _FeaturedContent(project: project, compact: true),
                    ],
                  )
                : Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _FeaturedMedia(project: project, compact: false),
                      const SizedBox(width: AppSpacing.lg),
                      Expanded(
                        child: _FeaturedContent(project: project, compact: false),
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
  const _FeaturedContent({
    required this.project,
    required this.compact,
  });

  final LearningProject project;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final buttonChild = FilledButton.icon(
      onPressed: () => context.go('/learning/${project.id}'),
      style: FilledButton.styleFrom(
        backgroundColor: learningLime,
        foregroundColor: Colors.black,
        padding: const EdgeInsetsDirectional.symmetric(
          horizontal: AppSpacing.lg,
          vertical: AppSpacing.md,
        ),
      ),
      icon: const Icon(Icons.arrow_forward_rounded),
      label: Text(
        const LocalizedText(en: 'Explore', ar: 'استكشف').resolve(context),
      ),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Align(
          alignment: AlignmentDirectional.centerStart,
          child: Container(
            padding: const EdgeInsetsDirectional.symmetric(
              horizontal: AppSpacing.sm,
              vertical: AppSpacing.xs,
            ),
            decoration: BoxDecoration(
              color: learningDarkSurfaceSoft,
              borderRadius: AppRadius.pillAll,
              border: Border.all(color: learningBorderSubtle),
            ),
            child: Text(
              const LocalizedText(
                en: 'Project of the week',
                ar: 'مشروع الأسبوع',
              ).resolve(context),
              style: AppTextStyles.badgeLabel(
                context,
              ).copyWith(fontSize: 12, color: learningTextPrimary),
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        Text(
          project.title.resolve(context),
          style: AppTextStyles.display(
            context,
          ).copyWith(color: learningTextPrimary),
          textAlign: TextAlign.start,
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          project.summary.resolve(context),
          style: AppTextStyles.subtitle(
            context,
          ).copyWith(color: learningTextSecondary),
          textAlign: TextAlign.start,
        ),
        const SizedBox(height: AppSpacing.md),
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: [
            _MetaChip(label: project.difficulty.resolve(context)),
            _MetaChip(label: project.duration.resolve(context)),
            _MetaChip(label: project.componentCountLabel.resolve(context)),
            _MetaChip(
              label:
                  '${project.ratingValue.toStringAsFixed(1)} (${project.ratingCount} ${project.ratingLabel.resolve(context)})',
              accent: true,
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.lg),
        compact
            ? SizedBox(width: double.infinity, child: buttonChild)
            : SizedBox(width: 176, child: buttonChild),
      ],
    );
  }
}

class _FeaturedMedia extends StatelessWidget {
  const _FeaturedMedia({
    required this.project,
    required this.compact,
  });

  final LearningProject project;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: compact ? double.infinity : 228,
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
            DecoratedBox(
              decoration: BoxDecoration(
                borderRadius: AppRadius.lgAll,
                color: learningOverlayDark,
              ),
            ),
            Align(
              alignment: AlignmentDirectional.center,
              child: Icon(
                project.heroIconData,
                size: compact ? 48 : 58,
                color: learningTextPrimary,
              ),
            ),
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
    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: accent
            ? learningLime.withValues(alpha: 0.24)
            : learningDarkSurfaceSoft,
        borderRadius: AppRadius.pillAll,
      ),
      child: Text(
        label,
        style: AppTextStyles.body(
          context,
        ).copyWith(color: accent ? learningLimeSoft : learningTextSecondary),
      ),
    );
  }
}
