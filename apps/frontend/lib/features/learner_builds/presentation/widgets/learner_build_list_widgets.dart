import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/navigation_extensions.dart';
import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../shared/widgets/protected_media_image.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../../shared/models/localized_text.dart';
import '../../../learning_hub/domain/models/project_build.dart';
import '../../../project_notebook/presentation/l10n/project_notebook_l10n.dart';
import '../../../project_help_sessions/presentation/widgets/build_help_session_icon_button.dart';
import '../../data/models/learner_build_models.dart';
import '../l10n/learner_builds_l10n.dart';

class LearnerBuildListCard extends StatelessWidget {
  const LearnerBuildListCard({
    super.key,
    required this.item,
    this.showImpactSummary = false,
    this.showPortfolioLearning = false,
  });

  final LearnerBuildListItem item;
  final bool showImpactSummary;
  final bool showPortfolioLearning;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final colors = AppThemeColors.of(context);
    final statusTone = switch (item.status) {
      ProjectBuildStatus.inProgress => AppStatusTone.primary,
      ProjectBuildStatus.paused => AppStatusTone.warning,
      ProjectBuildStatus.completed => AppStatusTone.success,
      ProjectBuildStatus.archived => AppStatusTone.neutral,
    };
    final learningChip = _compactLearningLabel(context);
    final portfolioStory = showPortfolioLearning ? item.portfolioLearning : null;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => context.push(
          learnerProjectBuildRoute(item.projectId, buildId: item.id),
        ),
        borderRadius: AppRadius.lgAll,
        child: Container(
          padding: const EdgeInsetsDirectional.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: palette.panelSurface,
            borderRadius: AppRadius.lgAll,
            border: Border.all(color: palette.borderSubtle),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _BuildCoverImage(
                imageUrl: item.previewPhotoUrl ?? item.project.coverImageUrl,
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Wrap(
                      spacing: AppSpacing.sm,
                      runSpacing: AppSpacing.xs,
                      children: [
                        AppStatusBadge(
                          label: LearnerBuildsL10n.statusLabel(item.status)
                              .resolve(context),
                          tone: statusTone,
                        ),
                        if (item.attemptNumber > 1)
                          AppStatusBadge(
                            label: LearnerBuildsL10n.attemptNumber(
                              item.attemptNumber,
                            ).resolve(context),
                            tone: AppStatusTone.neutral,
                          ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      item.project.title,
                      style: AppTextStyles.subtitle(context).copyWith(
                        color: palette.textPrimary,
                        fontWeight: FontWeight.w700,
                        fontSize: AppTextStyles.isCompact(context) ? 16 : 18,
                      ),
                    ),
                    if (item.project.shortDescription.isNotEmpty &&
                        !showPortfolioLearning) ...[
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        item.project.shortDescription,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: AppTextStyles.body(
                          context,
                        ).copyWith(color: palette.textSecondary),
                      ),
                    ],
                    if (showPortfolioLearning && item.completedAt != null) ...[
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        _formatCompletedDate(context, item.completedAt!),
                        style: AppTextStyles.label(context).copyWith(
                          color: palette.textMuted,
                          fontSize: 12.5,
                        ),
                      ),
                    ],
                    if (item.completionStoryPreview != null &&
                        item.completionStoryPreview!.trim().isNotEmpty) ...[
                      const SizedBox(height: AppSpacing.sm),
                      Text(
                        item.completionStoryPreview!,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: AppTextStyles.label(
                          context,
                        ).copyWith(color: palette.textSecondary, height: 1.35),
                      ),
                    ],
                    if (showImpactSummary && item.impactSummary != null) ...[
                      const SizedBox(height: AppSpacing.sm),
                      _ImpactSummaryLine(summary: item.impactSummary!),
                    ],
                    if (learningChip != null) ...[
                      const SizedBox(height: AppSpacing.sm),
                      Text(
                        learningChip,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: AppTextStyles.label(context).copyWith(
                          color: palette.textSecondary,
                          fontSize: 12.5,
                        ),
                      ),
                    ],
                    if (portfolioStory != null) ...[
                      const SizedBox(height: AppSpacing.sm),
                      Text(
                        _portfolioLearningPreview(context, portfolioStory),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: AppTextStyles.label(context).copyWith(
                          color: palette.textSecondary,
                          fontSize: 12.5,
                          height: 1.35,
                        ),
                      ),
                    ],
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      _primaryActionLabel(context),
                      style: AppTextStyles.label(context).copyWith(
                        color: colors.primary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
              Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  IconButton(
                    tooltip: ProjectNotebookL10n.projectNotebook.resolve(context),
                    onPressed: () => context.push(
                      learnerBuildNotebookRoute(item.id),
                    ),
                    icon: const Icon(Icons.menu_book_outlined),
                  ),
                  BuildHelpSessionIconButton(
                    buildId: item.id,
                    projectId: item.projectId,
                    status: item.status,
                  ),
                  Icon(
                    Icons.chevron_right_rounded,
                    color: palette.textMuted,
                    textDirection: Directionality.of(context),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _primaryActionLabel(BuildContext context) {
    return switch (item.status) {
      ProjectBuildStatus.paused =>
        LearnerBuildsL10n.resumeBuild.resolve(context),
      ProjectBuildStatus.completed =>
        LearnerBuildsL10n.viewCompleted.resolve(context),
      ProjectBuildStatus.archived =>
        LearnerBuildsL10n.openBuild.resolve(context),
      ProjectBuildStatus.inProgress =>
        LearnerBuildsL10n.openBuild.resolve(context),
    };
  }

  String _formatCompletedDate(BuildContext context, DateTime date) {
    return MaterialLocalizations.of(context).formatMediumDate(date.toLocal());
  }

  String _portfolioLearningPreview(
    BuildContext context,
    PortfolioLearningStory story,
  ) {
    final languageCode = Localizations.localeOf(context).languageCode;
    if (story.goalOutcome != null) {
      return LearnerBuildsL10n.goalOutcomeLabel(story.goalOutcome)
          .resolve(context);
    }
    if (story.reflection != null && story.reflection!.trim().isNotEmpty) {
      return story.reflection!.trim();
    }
    if (story.goal != null && story.goal!.trim().isNotEmpty) {
      return story.goal!.trim();
    }
    if (story.understoodConcepts.isNotEmpty) {
      return story.understoodConcepts.first.labelFor(languageCode);
    }
    return LearnerBuildsL10n.learningJourneyTitle.resolve(context);
  }

  String? _compactLearningLabel(BuildContext context) {
    if (showPortfolioLearning) {
      return null;
    }
    final learning = item.learning;
    if (learning == null ||
        learning.status == LearnerBuildLearningStatus.notAvailable) {
      return null;
    }

    final isTerminal =
        item.status == ProjectBuildStatus.completed ||
        item.status == ProjectBuildStatus.archived;

    if (isTerminal) {
      if (learning.goalOutcome != null) {
        return LearnerBuildsL10n.goalOutcomeLabel(
          learning.goalOutcome,
        ).resolve(context);
      }
      if (learning.hasReflection) {
        return LearnerBuildsL10n.learningReflectionAdded.resolve(context);
      }
      return LearnerBuildsL10n.notReviewedYet.resolve(context);
    }

    if (learning.status == LearnerBuildLearningStatus.reviewRecommended) {
      return LearnerBuildsL10n.reviewRecommended.resolve(context);
    }
    if (learning.checksTotal > 0 && learning.checksHandled > 0) {
      return LearnerBuildsL10n.learningChecksProgress(
        learning.checksHandled,
        learning.checksTotal,
      ).resolve(context);
    }
    if (learning.hasLearningGoal) {
      return LearnerBuildsL10n.learningGoalAdded.resolve(context);
    }
    if (learning.status == LearnerBuildLearningStatus.notStarted) {
      return LearnerBuildsL10n.startLearningCheck.resolve(context);
    }
    return null;
  }
}

class PortfolioLearningStorySection extends StatelessWidget {
  const PortfolioLearningStorySection({super.key, required this.story});

  final PortfolioLearningStory story;

  @override
  Widget build(BuildContext context) {
    if (!story.hasMeaningfulContent) {
      return const SizedBox.shrink();
    }

    final palette = MaterialsUiPalette.of(context);
    final languageCode = Localizations.localeOf(context).languageCode;
    final understood = story.understoodConcepts.take(3).toList(growable: false);
    final review = story.reviewConcepts.take(3).toList(growable: false);

    return Container(
      width: double.infinity,
      padding: const EdgeInsetsDirectional.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: palette.borderSubtle.withValues(alpha: 0.35),
        borderRadius: AppRadius.mdAll,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            LearnerBuildsL10n.learningJourneyTitle.resolve(context),
            style: AppTextStyles.label(context).copyWith(
              fontWeight: FontWeight.w700,
              color: palette.textPrimary,
            ),
          ),
          if (story.goal != null && story.goal!.trim().isNotEmpty) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              LearnerBuildsL10n.personalGoal.resolve(context),
              style: AppTextStyles.label(context).copyWith(fontSize: 12),
            ),
            Text(
              story.goal!,
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
              style: AppTextStyles.body(context).copyWith(fontSize: 13),
            ),
          ],
          if (story.goalOutcome != null) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              '${LearnerBuildsL10n.goalOutcome.resolve(context)}: ${LearnerBuildsL10n.goalOutcomeLabel(story.goalOutcome).resolve(context)}',
              style: AppTextStyles.label(context).copyWith(fontSize: 12.5),
            ),
          ],
          if (story.confidenceBefore != null ||
              story.confidenceAfter != null) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              _confidenceLine(languageCode),
              style: AppTextStyles.label(context).copyWith(fontSize: 12.5),
            ),
          ],
          if (understood.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              LearnerBuildsL10n.conceptsUnderstood.resolve(context),
              style: AppTextStyles.label(context).copyWith(fontSize: 12),
            ),
            ...understood.map(
              (concept) => Text(
                '• ${concept.labelFor(languageCode)}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTextStyles.body(context).copyWith(fontSize: 12.5),
              ),
            ),
          ],
          if (review.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              LearnerBuildsL10n.conceptsForReview.resolve(context),
              style: AppTextStyles.label(context).copyWith(fontSize: 12),
            ),
            ...review.map(
              (concept) => Text(
                '• ${concept.labelFor(languageCode)}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTextStyles.body(context).copyWith(fontSize: 12.5),
              ),
            ),
          ],
          if (story.reflection != null &&
              story.reflection!.trim().isNotEmpty) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              LearnerBuildsL10n.learningReflection.resolve(context),
              style: AppTextStyles.label(context).copyWith(fontSize: 12),
            ),
            Text(
              story.reflection!,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: AppTextStyles.body(context).copyWith(fontSize: 12.5),
            ),
          ],
        ],
      ),
    );
  }

  String _confidenceLine(String languageCode) {
    final before = story.confidenceBefore;
    final after = story.confidenceAfter;
    if (before != null && after != null) {
      return languageCode == 'ar'
          ? 'مستوى المعرفة: $before ← $after'
          : 'Confidence: $before → $after';
    }
    if (after != null) {
      return languageCode == 'ar'
          ? 'مستوى المعرفة بعد الإكمال: $after'
          : 'Confidence after: $after';
    }
    return languageCode == 'ar'
        ? 'مستوى المعرفة قبل البدء: $before'
        : 'Confidence before: $before';
  }
}

class _BuildCoverImage extends StatelessWidget {
  const _BuildCoverImage({this.imageUrl});

  final String? imageUrl;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final resolved = imageUrl?.trim() ?? '';

    return ClipRRect(
      borderRadius: AppRadius.mdAll,
      child: SizedBox(
        width: 72,
        height: 72,
        child: resolved.isEmpty
            ? ColoredBox(
                color: palette.borderSubtle,
                child: Icon(
                  Icons.handyman_outlined,
                  color: palette.textSecondary,
                ),
              )
            : ProtectedMediaImage(
                url: resolved,
                fit: BoxFit.cover,
                errorBuilder: (_) => ColoredBox(
                  color: palette.borderSubtle,
                  child: Icon(
                    Icons.handyman_outlined,
                    color: palette.textSecondary,
                  ),
                ),
              ),
      ),
    );
  }
}

class _ImpactSummaryLine extends StatelessWidget {
  const _ImpactSummaryLine({required this.summary});

  final ProjectBuildImpactSummary summary;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    return Text(
      LearnerBuildsL10n.impactStepsCompleted(
        summary.completedStepCount,
        summary.totalStepCount,
      ).resolve(context),
      style: AppTextStyles.label(
        context,
      ).copyWith(color: palette.textSecondary, fontSize: 12.5),
    );
  }
}

class LearnerBuildsEmptyState extends StatelessWidget {
  const LearnerBuildsEmptyState({
    super.key,
    required this.title,
    required this.subtitle,
    this.actionLabel,
    this.onAction,
  });

  final String title;
  final String subtitle;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Padding(
      padding: const EdgeInsetsDirectional.symmetric(vertical: AppSpacing.xl),
      child: Column(
        children: [
          Icon(Icons.inventory_2_outlined, size: 42, color: palette.textMuted),
          const SizedBox(height: AppSpacing.md),
          Text(
            title,
            textAlign: TextAlign.center,
            style: AppTextStyles.title(
              context,
            ).copyWith(color: palette.textPrimary),
          ),
          if (subtitle.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: AppTextStyles.body(
                context,
              ).copyWith(color: palette.textSecondary, height: 1.4),
            ),
          ],
          if (actionLabel != null && onAction != null) ...[
            const SizedBox(height: AppSpacing.md),
            FilledButton(onPressed: onAction, child: Text(actionLabel!)),
          ],
        ],
      ),
    );
  }
}

class LearnerBuildsStatePanel extends StatelessWidget {
  const LearnerBuildsStatePanel({
    super.key,
    required this.icon,
    required this.title,
    this.subtitle = '',
    this.actionLabel,
    this.onAction,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Padding(
      padding: const EdgeInsetsDirectional.symmetric(vertical: AppSpacing.xl),
      child: Column(
        children: [
          Icon(icon, size: 42, color: palette.textMuted),
          const SizedBox(height: AppSpacing.md),
          Text(
            title,
            textAlign: TextAlign.center,
            style: AppTextStyles.title(
              context,
            ).copyWith(color: palette.textPrimary),
          ),
          if (subtitle.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: AppTextStyles.body(
                context,
              ).copyWith(color: palette.textSecondary),
            ),
          ],
          if (actionLabel != null && onAction != null) ...[
            const SizedBox(height: AppSpacing.md),
            OutlinedButton(onPressed: onAction, child: Text(actionLabel!)),
          ],
        ],
      ),
    );
  }
}

class LearnerBuildStatusTabs extends StatelessWidget {
  const LearnerBuildStatusTabs({
    super.key,
    required this.selected,
    required this.onSelected,
  });

  final String selected;
  final ValueChanged<String> onSelected;

  static const tabs = <String, LocalizedText>{
    'ACTIVE': LearnerBuildsL10n.tabActive,
    'PAUSED': LearnerBuildsL10n.tabPaused,
    'COMPLETED': LearnerBuildsL10n.tabCompleted,
    'ARCHIVED': LearnerBuildsL10n.tabArchived,
  };

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final colors = AppThemeColors.of(context);

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: tabs.entries.map((entry) {
          final isSelected = entry.key == selected;
          return Padding(
            padding: const EdgeInsetsDirectional.only(end: AppSpacing.sm),
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: () => onSelected(entry.key),
                borderRadius: AppRadius.pillAll,
                child: Ink(
                  padding: const EdgeInsetsDirectional.symmetric(
                    horizontal: AppSpacing.md,
                    vertical: AppSpacing.sm,
                  ),
                  decoration: BoxDecoration(
                    color: isSelected ? colors.primarySoft : palette.panelSurface,
                    borderRadius: AppRadius.pillAll,
                    border: Border.all(
                      color: isSelected
                          ? colors.primary.withValues(alpha: 0.35)
                          : palette.borderSubtle,
                    ),
                  ),
                  child: Text(
                    entry.value.resolve(context),
                    style: AppTextStyles.label(context).copyWith(
                      color: isSelected ? colors.primary : palette.textSecondary,
                      fontWeight: isSelected
                          ? FontWeight.w600
                          : FontWeight.w500,
                    ),
                  ),
                ),
              ),
            ),
          );
        }).toList(growable: false),
      ),
    );
  }
}
