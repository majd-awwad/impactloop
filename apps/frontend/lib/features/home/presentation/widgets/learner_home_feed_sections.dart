import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../domain/learner_home_models.dart';
import '../learner_home_browse_routes.dart';
import 'empty_activity_card.dart';
import 'home_continue_project_card.dart';
import 'home_material_recommendation_grid.dart';
import 'home_section_header.dart';
import 'learning_spotlight_section.dart';

class LearnerHomeFeedSections extends StatelessWidget {
  const LearnerHomeFeedSections({
    super.key,
    required this.feed,
  });

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
            message: 'Add your interests to improve recommendations.',
            actionLabel: 'Edit learner profile',
            onPressed: () => context.push('/profile/learner/edit'),
          ),
        for (final section in sections) ...[
          const SizedBox(height: AppSpacing.xl),
          _LearnerHomeSectionView(
            section: section,
            profileCompletion: feed.profileCompletion,
          ),
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
                  style: AppTextStyles.body(context).copyWith(
                    color: palette.textSecondary,
                    height: 1.45,
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                TextButton(onPressed: onPressed, child: Text(actionLabel)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _LearnerHomeSectionView extends StatelessWidget {
  const _LearnerHomeSectionView({
    required this.section,
    required this.profileCompletion,
  });

  final LearnerHomeSection section;
  final LearnerHomeProfileCompletion profileCompletion;

  @override
  Widget build(BuildContext context) {
    return switch (section.key) {
      LearnerHomeSectionKey.suggestedMaterials ||
      LearnerHomeSectionKey.materialsForSavedProjects ||
      LearnerHomeSectionKey.freeMaterialsNearYou =>
        _MaterialSection(
          section: section,
          profileCompletion: profileCompletion,
        ),
      LearnerHomeSectionKey.suggestedProjects ||
      LearnerHomeSectionKey.savedProjects ||
      LearnerHomeSectionKey.popularProjects =>
        _ProjectSection(
          section: section,
          profileCompletion: profileCompletion,
        ),
      LearnerHomeSectionKey.continueProjects =>
        _ContinueProjectsSection(section: section),
    };
  }
}

class _MaterialSection extends StatelessWidget {
  const _MaterialSection({
    required this.section,
    required this.profileCompletion,
  });

  final LearnerHomeSection section;
  final LearnerHomeProfileCompletion profileCompletion;

  String _subtitle(List<LearnerHomeMaterialRecommendation> materials) {
    if (materials.isEmpty) {
      return section.emptyState;
    }

    return switch (section.key) {
      LearnerHomeSectionKey.suggestedMaterials =>
        _suggestedMaterialsSubtitle(materials),
      LearnerHomeSectionKey.materialsForSavedProjects =>
        'Materials that match components in your saved learning projects.',
      LearnerHomeSectionKey.freeMaterialsNearYou =>
        _freeMaterialsSubtitle(materials),
      _ => section.emptyState,
    };
  }

  String _suggestedMaterialsSubtitle(
    List<LearnerHomeMaterialRecommendation> materials,
  ) {
    if (!profileCompletion.hasInterests && !profileCompletion.hasActivity) {
      return 'Starter suggestions from available materials. Add interests to personalize this feed.';
    }

    final hasPrimaryMatches = materials.any(
      (item) => item.reasons.any(_isStrongMaterialReason),
    );

    if (!hasPrimaryMatches) {
      return 'We could not find many direct matches yet. Showing useful available materials.';
    }

    if (!profileCompletion.hasInterests && profileCompletion.hasActivity) {
      return 'Personalized from your recent activity.';
    }

    return 'Personalized from your interests, saved projects, and activity.';
  }

  bool _isStrongMaterialReason(String reason) {
    final normalized = reason.toLowerCase();
    return normalized.startsWith('matches your') ||
        normalized.startsWith('related to your') ||
        normalized.contains('useful for your saved') ||
        normalized.contains('matches required component') ||
        normalized.contains('based on materials you liked') ||
        normalized.contains('similar to materials you reserved') ||
        normalized.contains('related to your saved projects') ||
        normalized.contains('matches your recent activity') ||
        normalized.contains('because you are building');
  }

  String _freeMaterialsSubtitle(List<LearnerHomeMaterialRecommendation> materials) {
    final hasNearReason = materials.any(
      (item) => item.reasons.any(
        (reason) => reason.toLowerCase().contains('near your saved location'),
      ),
    );

    if (profileCompletion.hasSavedLocation && hasNearReason) {
      return 'Free materials available near your saved location.';
    }

    return 'Free materials available on ImpactLoop.';
  }

  @override
  Widget build(BuildContext context) {
    final materials = section.items
        .whereType<LearnerHomeMaterialRecommendation>()
        .toList(growable: false);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        HomeSectionHeader(
          title: section.title,
          subtitle: _subtitle(materials),
          action: HomeSectionActionButton(
            onPressed: () =>
                context.go(LearnerHomeBrowseRoutes.forSection(section.key)),
            icon: const Icon(Icons.arrow_forward_rounded),
            label: 'Browse all',
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        if (materials.isEmpty)
          EmptyActivityCard(
            icon: Icons.inventory_2_outlined,
            title: section.title,
            description: section.emptyState,
            actionLabel: 'Open materials',
            onAction: () =>
                context.go(LearnerHomeBrowseRoutes.forSection(section.key)),
          )
        else
          HomeMaterialRecommendationGrid(
            items: materials,
            maxItems: 4,
          ),
      ],
    );
  }
}

class _ProjectSection extends StatelessWidget {
  const _ProjectSection({
    required this.section,
    required this.profileCompletion,
  });

  final LearnerHomeSection section;
  final LearnerHomeProfileCompletion profileCompletion;

  String _subtitle(List<LearnerHomeProjectRecommendation> projects) {
    if (projects.isEmpty) {
      return section.emptyState;
    }

    return switch (section.key) {
      LearnerHomeSectionKey.savedProjects => 'Projects you saved for later.',
      LearnerHomeSectionKey.popularProjects =>
        profileCompletion.hasInterests
            ? 'Popular learning projects across ImpactLoop.'
            : 'Popular and beginner-friendly projects to help you start.',
      LearnerHomeSectionKey.suggestedProjects =>
        profileCompletion.hasInterests
            ? 'Personalized from your interests and available matching materials.'
            : 'Popular and beginner-friendly projects to help you start.',
      _ => profileCompletion.hasInterests
          ? 'Based on your interests and learner activity.'
          : 'Popular and beginner-friendly projects to help you start.',
    };
  }

  @override
  Widget build(BuildContext context) {
    final projects = section.items
        .whereType<LearnerHomeProjectRecommendation>()
        .toList(growable: false);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        HomeSectionHeader(
          title: section.title,
          subtitle: _subtitle(projects),
          action: HomeSectionActionButton(
            onPressed: () =>
                context.go(LearnerHomeBrowseRoutes.forSection(section.key)),
            icon: const Icon(Icons.arrow_forward_rounded),
            label: 'Browse all',
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        if (projects.isEmpty)
          EmptyActivityCard(
            icon: Icons.school_outlined,
            title: section.title,
            description: section.emptyState,
            actionLabel: 'Open Learning Hub',
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
                      reason: item.reasons.isNotEmpty ? item.reasons.first : null,
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

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        HomeSectionHeader(
          title: section.title,
          subtitle: builds.isNotEmpty
              ? 'Pick up where you left off.'
              : section.emptyState,
          action: HomeSectionActionButton(
            onPressed: () => context.go(
              LearnerHomeBrowseRoutes.forSection(section.key),
            ),
            icon: const Icon(Icons.arrow_forward_rounded),
            label: 'Browse projects',
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
          _CompactContinueEmptyState(message: section.emptyState),
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
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.sm,
      ),
      child: Row(
        children: [
          Icon(
            Icons.build_outlined,
            size: 18,
            color: palette.textSecondary,
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              message,
              style: AppTextStyles.label(context).copyWith(
                color: palette.textSecondary,
                height: 1.35,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
