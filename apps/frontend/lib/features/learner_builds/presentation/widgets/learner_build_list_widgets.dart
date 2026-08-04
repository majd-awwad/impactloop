import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../core/config/api_config.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../../shared/models/localized_text.dart';
import '../../../learning_hub/domain/models/project_build.dart';
import '../../data/models/learner_build_models.dart';
import '../l10n/learner_builds_l10n.dart';

class LearnerBuildListCard extends StatelessWidget {
  const LearnerBuildListCard({
    super.key,
    required this.item,
    this.showImpactSummary = false,
  });

  final LearnerBuildListItem item;
  final bool showImpactSummary;

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

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => context.push('/learning/${item.projectId}/build'),
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
                      style: AppTextStyles.title(
                        context,
                      ).copyWith(color: palette.textPrimary),
                    ),
                    if (item.project.shortDescription.isNotEmpty) ...[
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
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      LearnerBuildsL10n.openBuild.resolve(context),
                      style: AppTextStyles.label(context).copyWith(
                        color: colors.primary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(
                Icons.chevron_right_rounded,
                color: palette.textMuted,
                textDirection: Directionality.of(context),
              ),
            ],
          ),
        ),
      ),
    );
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
            : Image.network(
                ApiConfig.resolveMediaUrl(resolved),
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => ColoredBox(
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
