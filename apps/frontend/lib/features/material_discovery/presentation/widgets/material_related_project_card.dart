import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../core/config/api_config.dart';
import '../../../../shared/models/localized_text.dart';
import '../../../learning_hub/data/learning_hub_api_mapper.dart';
import '../../../learning_hub/presentation/theme/learning_ui_palette.dart';
import '../../data/models/material_related_projects.dart';
import '../l10n/material_related_projects_l10n.dart';

class MaterialRelatedProjectCard extends StatelessWidget {
  const MaterialRelatedProjectCard({
    super.key,
    required this.item,
    required this.onOpenProject,
    required this.onPrimaryAction,
    this.isActionBusy = false,
  });

  final MaterialRelatedProjectItem item;
  final VoidCallback onOpenProject;
  final VoidCallback onPrimaryAction;
  final bool isActionBusy;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final l10n = MaterialRelatedProjectsL10n.of(context);
    final project = item.project;
    final durationLabel = LearningHubApiMapper.formatDurationMinutes(
      project.estimatedDurationMinutes,
    );
    final difficultyLabel = LearningHubApiMapper.mapDifficultyLabel(
      project.difficulty,
    );
    final resolvedDifficulty = difficultyLabel.resolve(context);

    return Material(
      color: palette.cardSurface,
      borderRadius: AppRadius.lgAll,
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onOpenProject,
        child: Container(
          decoration: BoxDecoration(
            borderRadius: AppRadius.lgAll,
            border: Border.all(color: palette.borderSubtle),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _CoverImage(
                coverImageUrl: project.coverImageUrl,
                difficultyLabel: resolvedDifficulty,
              ),
              Padding(
                padding: const EdgeInsetsDirectional.all(AppSpacing.md),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      project.title,
                      style: AppTextStyles.title(context).copyWith(
                        color: palette.textPrimary,
                        fontSize: 16,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Wrap(
                      spacing: AppSpacing.sm,
                      runSpacing: AppSpacing.xs,
                      children: [
                        _MetaChip(label: resolvedDifficulty),
                        if (durationLabel.trim().isNotEmpty)
                          _MetaChip(label: durationLabel),
                        if (project.likesCount > 0)
                          _MetaChip(label: l10n.likesLabel(project.likesCount)),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    _MatchBadge(
                      label: l10n.matchTypeLabel(item.match.matchType),
                      matchType: item.match.matchType,
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      l10n.matchedComponentLabel(
                        item.bestMatchedComponent.componentName,
                      ),
                      style: AppTextStyles.body(context).copyWith(
                        color: palette.textSecondary,
                        fontSize: 13,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (item.match.additionalMatchedComponentsCount > 0) ...[
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        l10n.additionalMatchesLabel(
                          item.match.additionalMatchedComponentsCount,
                        ),
                        style: AppTextStyles.label(context).copyWith(
                          color: palette.textSecondary,
                        ),
                      ),
                    ],
                    const SizedBox(height: AppSpacing.md),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: isActionBusy ? null : onPrimaryAction,
                        child: isActionBusy
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              )
                            : Text(_primaryActionLabel(l10n, item)),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _primaryActionLabel(
    MaterialRelatedProjectsL10n l10n,
    MaterialRelatedProjectItem item,
  ) {
    final learnerContext = item.learnerContext;
    if (learnerContext == null) {
      return l10n.viewProject;
    }

    if (learnerContext.action ==
        MaterialRelatedProjectLearnerAction.continueBuild) {
      return l10n.continueBuild;
    }

    if (learnerContext.buildStatus == 'COMPLETED') {
      return l10n.viewProject;
    }

    if (learnerContext.action ==
        MaterialRelatedProjectLearnerAction.startBuild) {
      return l10n.startBuild;
    }

    return l10n.viewProject;
  }
}

class _CoverImage extends StatelessWidget {
  const _CoverImage({
    required this.coverImageUrl,
    required this.difficultyLabel,
  });

  final String? coverImageUrl;
  final String difficultyLabel;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final resolvedUrl = coverImageUrl?.trim();

    return SizedBox(
      height: 120,
      child: Stack(
        fit: StackFit.expand,
        children: [
          DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: AlignmentDirectional.topStart,
                end: AlignmentDirectional.bottomEnd,
                colors: [
                  palette.limeSoft,
                  palette.cardSurfaceAlt,
                ],
              ),
            ),
            child: resolvedUrl == null || resolvedUrl.isEmpty
                ? Icon(
                    Icons.architecture_outlined,
                    color: palette.textSecondary,
                    size: 36,
                  )
                : null,
          ),
          if (resolvedUrl != null && resolvedUrl.isNotEmpty)
            Image.network(
              ApiConfig.resolveMediaUrl(resolvedUrl),
              fit: BoxFit.cover,
              errorBuilder: (context, error, stackTrace) => Icon(
                Icons.architecture_outlined,
                color: palette.textSecondary,
                size: 36,
              ),
            ),
          PositionedDirectional(
            top: AppSpacing.sm,
            end: AppSpacing.sm,
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
                difficultyLabel,
                style: AppTextStyles.label(context).copyWith(
                  color: palette.textPrimary,
                  fontSize: 11,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _MetaChip extends StatelessWidget {
  const _MetaChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);

    return Container(
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
        label,
        style: AppTextStyles.label(context).copyWith(
          color: palette.textSecondary,
          fontSize: 11,
        ),
      ),
    );
  }
}

class _MatchBadge extends StatelessWidget {
  const _MatchBadge({
    required this.label,
    required this.matchType,
  });

  final String label;
  final MaterialRelatedProjectMatchType matchType;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final Color background;
    final Color foreground;

    switch (matchType) {
      case MaterialRelatedProjectMatchType.exact:
        background = palette.limeSoft;
        foreground = palette.lime;
      case MaterialRelatedProjectMatchType.alternative:
        background = palette.cardSurfaceAlt;
        foreground = palette.textSecondary;
      case MaterialRelatedProjectMatchType.compatible:
        background = palette.limeSoft;
        foreground = palette.lime;
    }

    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: background,
        borderRadius: AppRadius.pillAll,
        border: Border.all(color: foreground.withValues(alpha: 0.24)),
      ),
      child: Text(
        label,
        style: AppTextStyles.label(context).copyWith(
          color: foreground,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
