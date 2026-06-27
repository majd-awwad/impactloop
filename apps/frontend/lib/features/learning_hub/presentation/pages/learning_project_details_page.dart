import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../app/widgets/entry_nav_bar.dart';
import '../../data/learning_hub_mock_data.dart';
import '../../domain/models/learning_project.dart';
import '../widgets/disabled_ai_panel.dart';
import '../widgets/mock_rating_summary_card.dart';
import '../widgets/project_components_section.dart';
import '../widgets/project_link_list.dart';
import '../widgets/project_steps_timeline.dart';

class LearningProjectDetailsPage extends StatelessWidget {
  const LearningProjectDetailsPage({super.key, required this.projectId});

  final String projectId;

  @override
  Widget build(BuildContext context) {
    final project = learningProjectById(projectId);
    final palette = LearningUiPalette.of(context);

    if (project == null) {
      return Scaffold(
        backgroundColor: palette.pageBackground,
        body: Center(
          child: Text(
            const LocalizedText(
              en: 'Project not found',
              ar: 'المشروع غير موجود',
            ).resolve(context),
            style: AppTextStyles.title(
              context,
            ).copyWith(color: palette.textPrimary),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: palette.pageBackground,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const EntryNavBar(homeRoute: '/home'),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsetsDirectional.only(
                  bottom: AppSpacing.xl,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _DetailsHero(project: project),
                    Transform.translate(
                      offset: const Offset(0, -34),
                      child: Padding(
                        padding: const EdgeInsetsDirectional.symmetric(
                          horizontal: AppSpacing.md,
                        ),
                        child: Center(
                          child: ConstrainedBox(
                            constraints: const BoxConstraints(maxWidth: 1400),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                _DetailsSummaryCard(project: project),
                                const SizedBox(height: AppSpacing.lg),
                                ProjectComponentsSection(
                                  components: project.components,
                                ),
                                const SizedBox(height: AppSpacing.lg),
                                const DisabledAiPanel(),
                                const SizedBox(height: AppSpacing.lg),
                                ProjectStepsTimeline(steps: project.steps),
                                const SizedBox(height: AppSpacing.lg),
                                ProjectLinkList(links: project.links),
                                const SizedBox(height: AppSpacing.lg),
                                MockRatingSummaryCard(
                                  project: project,
                                  breakdown: mockBreakdownFor(project),
                                ),
                              ],
                            ),
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
    );
  }
}

class _DetailsHero extends StatelessWidget {
  const _DetailsHero({required this.project});

  final LearningProject project;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final colors = AppThemeColors.of(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final hasImage =
        project.imageUrl != null && project.imageUrl!.trim().isNotEmpty;
    final fallbackGradient = isDark
        ? projectGradient(project)
        : [palette.heroStart, palette.heroAccent, palette.heroEnd];
    final screenWidth = MediaQuery.sizeOf(context).width;
    final heroHeight = screenWidth >= 1100
        ? 380.0
        : screenWidth >= 700
        ? 344.0
        : 300.0;

    return SizedBox(
      height: heroHeight,
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: AlignmentDirectional.topStart,
            end: AlignmentDirectional.bottomEnd,
            colors: project.id == 'wireless-charger'
                ? isDark
                      ? const [learningPurpleStart, learningPurpleEnd]
                      : [colors.purpleStart, colors.purpleEnd]
                : fallbackGradient,
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
                gradient: LinearGradient(
                  begin: AlignmentDirectional.topCenter,
                  end: AlignmentDirectional.bottomCenter,
                  colors: [
                    palette.overlayDark.withValues(
                      alpha: hasImage ? (isDark ? 0.34 : 0.08) : 0.0,
                    ),
                    palette.pageBackground.withValues(
                      alpha: hasImage ? (isDark ? 0.56 : 0.18) : 0.0,
                    ),
                  ],
                ),
              ),
            ),
            PositionedDirectional(
              top: 40,
              start: 24,
              child: Container(
                padding: const EdgeInsetsDirectional.symmetric(
                  horizontal: AppSpacing.sm,
                  vertical: AppSpacing.xs,
                ),
                decoration: BoxDecoration(
                  color: palette.cardSurface.withValues(
                    alpha: isDark ? 0.74 : 0.86,
                  ),
                  borderRadius: AppRadius.pillAll,
                  border: Border.all(color: palette.borderSubtle),
                ),
                child: Text(
                  project.category.resolve(context),
                  style: AppTextStyles.badgeLabel(
                    context,
                  ).copyWith(color: palette.textPrimary),
                ),
              ),
            ),
            PositionedDirectional(
              top: 52,
              end: 36,
              child: IconButton.filled(
                onPressed: () => context.go('/learning'),
                style: IconButton.styleFrom(
                  backgroundColor: palette.cardSurface.withValues(
                    alpha: isDark ? 0.74 : 0.9,
                  ),
                  foregroundColor: palette.textPrimary,
                ),
                icon: const Icon(Icons.arrow_forward_rounded),
              ),
            ),
            if (!hasImage)
              PositionedDirectional(
                bottom: 34,
                start: 0,
                end: 0,
                child: Icon(
                  project.heroIconData,
                  size: 86,
                  color: palette.textPrimary,
                ),
              ),
            PositionedDirectional(
              top: 40,
              end: 120,
              child: _BlurOrb(size: 160, color: palette.textPrimary),
            ),
            PositionedDirectional(
              bottom: 18,
              start: 36,
              child: _BlurOrb(size: 120, color: palette.textPrimary),
            ),
          ],
        ),
      ),
    );
  }
}

class _DetailsSummaryCard extends StatelessWidget {
  const _DetailsSummaryCard({required this.project});

  final LearningProject project;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: palette.cardSurface,
        borderRadius: AppRadius.xlAll,
        border: Border.all(color: palette.borderSubtle),
        boxShadow: [
          BoxShadow(
            color: palette.cardShadow,
            blurRadius: 22,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final compact = constraints.maxWidth < 820;
          final titleBlock = Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                project.title.resolve(context),
                style: AppTextStyles.display(
                  context,
                ).copyWith(color: palette.textPrimary),
                textAlign: TextAlign.start,
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                project.summary.resolve(context),
                style: AppTextStyles.subtitle(
                  context,
                ).copyWith(color: palette.textSecondary),
                textAlign: TextAlign.start,
              ),
            ],
          );

          final chips = Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              _DetailsChip(
                label: project.difficulty.resolve(context),
                dark: true,
              ),
              _DetailsChip(label: project.duration.resolve(context)),
              _DetailsChip(label: project.componentCountLabel.resolve(context)),
              _DetailsChip(
                label:
                    '${project.ratingValue.toStringAsFixed(1)} (${project.ratingCount})',
                accent: true,
              ),
            ],
          );

          return compact
              ? Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    titleBlock,
                    const SizedBox(height: AppSpacing.md),
                    chips,
                  ],
                )
              : Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Expanded(child: titleBlock),
                    const SizedBox(width: AppSpacing.lg),
                    Flexible(child: chips),
                  ],
                );
        },
      ),
    );
  }
}

class _DetailsChip extends StatelessWidget {
  const _DetailsChip({
    required this.label,
    this.dark = false,
    this.accent = false,
  });

  final String label;
  final bool dark;
  final bool accent;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    Color background = palette.mutedChip;
    Color foreground = palette.textSecondary;

    if (dark) {
      background = palette.darkSurface;
      foreground = palette.textPrimary;
    } else if (accent) {
      background = palette.lime.withValues(alpha: 0.16);
      foreground = palette.limeSoft;
    }

    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: background,
        borderRadius: AppRadius.pillAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Text(
        label,
        style: AppTextStyles.label(context).copyWith(color: foreground),
      ),
    );
  }
}

class _BlurOrb extends StatelessWidget {
  const _BlurOrb({required this.size, required this.color});

  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.06),
        shape: BoxShape.circle,
      ),
    );
  }
}
