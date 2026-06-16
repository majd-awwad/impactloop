import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../data/learning_hub_mock_data.dart';
import '../../domain/models/learning_project.dart';
import '../widgets/disabled_ai_panel.dart';
import '../widgets/learning_hub_text.dart';
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

    if (project == null) {
      return Scaffold(
        backgroundColor: learningPageBackground,
        body: Center(
          child: Text(
            const LocalizedText(
              en: 'Project not found',
              ar: 'المشروع غير موجود',
            ).resolve(context),
            style: AppTextStyles.title(
              context,
            ).copyWith(color: learningTextPrimary),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: learningPageBackground,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.xl),
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
    );
  }
}

class _DetailsHero extends StatelessWidget {
  const _DetailsHero({required this.project});

  final LearningProject project;

  @override
  Widget build(BuildContext context) {
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
                ? const [learningPurpleStart, learningPurpleEnd]
                : projectGradient(project),
          ),
        ),
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (project.imageUrl != null)
              Image.network(
                project.imageUrl!,
                fit: BoxFit.cover,
                errorBuilder: (context, error, stackTrace) =>
                    const SizedBox.shrink(),
              ),
            DecoratedBox(
              decoration: BoxDecoration(
                color: learningOverlayDark.withValues(alpha: 0.38),
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
                  color: Colors.white.withValues(alpha: 0.1),
                  borderRadius: AppRadius.pillAll,
                ),
                child: Text(
                  project.category.resolve(context),
                  style: AppTextStyles.badgeLabel(context),
                ),
              ),
            ),
            PositionedDirectional(
              top: 52,
              end: 36,
              child: IconButton.filled(
                onPressed: () => context.go('/learning'),
                style: IconButton.styleFrom(
                  backgroundColor: Colors.black.withValues(alpha: 0.18),
                ),
                icon: const Icon(Icons.arrow_forward_rounded),
              ),
            ),
            PositionedDirectional(
              bottom: 34,
              start: 0,
              end: 0,
              child: Icon(
                project.heroIconData,
                size: 112,
                color: learningTextPrimary,
              ),
            ),
            PositionedDirectional(
              top: 40,
              end: 120,
              child: _BlurOrb(size: 160),
            ),
            PositionedDirectional(
              bottom: 18,
              start: 36,
              child: _BlurOrb(size: 120),
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
    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: learningCardSurface,
        borderRadius: AppRadius.xlAll,
        border: Border.all(color: learningBorderSubtle),
        boxShadow: const [
          BoxShadow(
            color: Color(0x17000000),
            blurRadius: 22,
            offset: Offset(0, 10),
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
    Color background = learningMutedChip;
    Color foreground = learningTextSecondary;

    if (dark) {
      background = learningDarkSurface;
      foreground = learningTextPrimary;
    } else if (accent) {
      background = learningLime.withValues(alpha: 0.18);
      foreground = learningLimeSoft;
    }

    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: background,
        borderRadius: AppRadius.pillAll,
      ),
      child: Text(
        label,
        style: AppTextStyles.label(context).copyWith(color: foreground),
      ),
    );
  }
}

class _BlurOrb extends StatelessWidget {
  const _BlurOrb({required this.size});

  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.08),
        shape: BoxShape.circle,
      ),
    );
  }
}
