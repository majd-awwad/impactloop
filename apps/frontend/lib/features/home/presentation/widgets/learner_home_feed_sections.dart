import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../domain/learner_home_models.dart';
import '../learner_home_browse_routes.dart';
import '../learner_home_localization.dart';
import 'empty_activity_card.dart';
import 'home_continue_project_card.dart';
import 'home_material_recommendation_grid.dart';
import 'home_section_header.dart';
import 'learning_spotlight_section.dart';

class LearnerHomeFeedSections extends StatelessWidget {
  const LearnerHomeFeedSections({super.key, required this.feed});

  final LearnerHomeFeed feed;

  @override
  Widget build(BuildContext context) {
    final sections = feed.sections.where((section) {
      return section.key != LearnerHomeSectionKey.popularProjects ||
          !_hasPrimaryProjectSections(feed);
    });

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (!feed.profileCompletion.hasInterests)
          _ProfilePromptBanner(
            message: context.l10n.addInterestsPrompt,
            actionLabel: context.l10n.editLearnerProfile,
            onPressed: () => context.push('/profile/learner/edit'),
          ),
        for (final section in sections) ...[
          const SizedBox(height: AppSpacing.xl),
          _LearnerHomeSectionView(section: section),
        ],
      ],
    );
  }

  bool _hasPrimaryProjectSections(LearnerHomeFeed feed) {
    final suggested = feed.section(LearnerHomeSectionKey.suggestedProjects);
    return suggested != null && suggested.items.isNotEmpty;
  }
}

class _ProfilePromptBanner extends StatelessWidget {
  const _ProfilePromptBanner({
    required this.message,
    required this.actionLabel,
    required this.onPressed,
  });

  final String message;
  final String actionLabel;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: palette.panelSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.lightbulb_outline, color: palette.mint),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  message,
                  style: AppTextStyles.body(
                    context,
                  ).copyWith(color: palette.textSecondary, height: 1.45),
                ),
                const SizedBox(height: AppSpacing.sm),
                TextButton(
                  onPressed: onPressed,
                  style: AppStatusButtonStyle.text(
                    context,
                    AppStatusTone.neutral,
                  ),
                  child: Text(actionLabel),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _LearnerHomeSectionView extends StatelessWidget {
  const _LearnerHomeSectionView({required this.section});

  final LearnerHomeSection section;

  @override
  Widget build(BuildContext context) {
    return switch (section.key) {
      LearnerHomeSectionKey.suggestedMaterials ||
      LearnerHomeSectionKey.materialsForSavedProjects ||
      LearnerHomeSectionKey.freeMaterialsNearYou => _MaterialSection(
        section: section,
      ),
      LearnerHomeSectionKey.suggestedProjects ||
      LearnerHomeSectionKey.savedProjects ||
      LearnerHomeSectionKey.popularProjects => _ProjectSection(
        section: section,
      ),
      LearnerHomeSectionKey.continueProjects => _ContinueProjectsSection(
        section: section,
      ),
    };
  }
}

class _MaterialSection extends StatelessWidget {
  const _MaterialSection({required this.section});

  final LearnerHomeSection section;

  @override
  Widget build(BuildContext context) {
    final materials = section.items
        .whereType<LearnerHomeMaterialRecommendation>()
        .toList(growable: false);
    final copy = learnerHomeSectionCopy(section.key, context.l10n);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        HomeSectionHeader(
          title: copy.title,
          subtitle: materials.isEmpty ? copy.empty : copy.subtitle,
          action: HomeSectionActionButton(
            onPressed: () =>
                context.go(LearnerHomeBrowseRoutes.forSection(section.key)),
            icon: const Icon(Icons.arrow_forward_rounded),
            label: context.l10n.browseAll,
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        if (materials.isEmpty)
          EmptyActivityCard(
            icon: Icons.inventory_2_outlined,
            title: copy.title,
            description: copy.empty,
            actionLabel: context.l10n.openMaterials,
            onAction: () =>
                context.go(LearnerHomeBrowseRoutes.forSection(section.key)),
          )
        else
          HomeMaterialRecommendationGrid(items: materials, maxItems: 4),
      ],
    );
  }
}

class _ProjectSection extends StatelessWidget {
  const _ProjectSection({required this.section});

  final LearnerHomeSection section;

  @override
  Widget build(BuildContext context) {
    final projects = section.items
        .whereType<LearnerHomeProjectRecommendation>()
        .toList(growable: false);
    final copy = learnerHomeSectionCopy(section.key, context.l10n);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        HomeSectionHeader(
          title: copy.title,
          subtitle: projects.isEmpty ? copy.empty : copy.subtitle,
          action: HomeSectionActionButton(
            onPressed: () =>
                context.go(LearnerHomeBrowseRoutes.forSection(section.key)),
            icon: const Icon(Icons.arrow_forward_rounded),
            label: context.l10n.browseAll,
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        if (projects.isEmpty)
          EmptyActivityCard(
            icon: Icons.school_outlined,
            title: copy.title,
            description: copy.empty,
            actionLabel: context.l10n.openLearningHub,
            onAction: () =>
                context.go(LearnerHomeBrowseRoutes.forSection(section.key)),
          )
        else
          LayoutBuilder(
            builder: (context, constraints) {
              final wide = constraints.maxWidth >= 760;
              final preview = projects.take(wide ? 2 : 1).toList();
              final itemWidth = wide
                  ? (constraints.maxWidth - AppSpacing.md) / 2
                  : constraints.maxWidth;

              return Wrap(
                spacing: AppSpacing.md,
                runSpacing: AppSpacing.md,
                children: preview.map((item) {
                  return SizedBox(
                    width: itemWidth,
                    child: HomeLearningProjectCard(
                      project: item.project,
                      reason: localizedLearnerHomeReason(item, context.l10n),
                    ),
                  );
                }).toList(),
              );
            },
          ),
      ],
    );
  }
}

class _ContinueProjectsSection extends StatelessWidget {
  const _ContinueProjectsSection({required this.section});

  final LearnerHomeSection section;

  @override
  Widget build(BuildContext context) {
    final builds = section.items
        .whereType<LearnerHomeContinueProjectRecommendation>()
        .toList(growable: false);
    final copy = learnerHomeSectionCopy(section.key, context.l10n);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        HomeSectionHeader(
          title: copy.title,
          subtitle: builds.isNotEmpty ? copy.subtitle : copy.empty,
          action: HomeSectionActionButton(
            onPressed: () =>
                context.go(LearnerHomeBrowseRoutes.forSection(section.key)),
            icon: const Icon(Icons.arrow_forward_rounded),
            label: context.l10n.browseProjects,
          ),
        ),
        if (builds.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.md),
          Column(
            children: [
              for (final item in builds) ...[
                HomeContinueProjectCard(item: item),
                if (item != builds.last) const SizedBox(height: AppSpacing.sm),
              ],
            ],
          ),
        ] else ...[
          const SizedBox(height: AppSpacing.sm),
          _CompactContinueEmptyState(message: copy.empty),
        ],
      ],
    );
  }
}

class _CompactContinueEmptyState extends StatelessWidget {
  const _CompactContinueEmptyState({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Padding(
      padding: const EdgeInsetsDirectional.symmetric(horizontal: AppSpacing.sm),
      child: Row(
        children: [
          Icon(Icons.build_outlined, size: 18, color: palette.textSecondary),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              message,
              style: AppTextStyles.label(
                context,
              ).copyWith(color: palette.textSecondary, height: 1.35),
            ),
          ),
        ],
      ),
    );
  }
}
