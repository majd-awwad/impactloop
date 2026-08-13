import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../domain/models/learning_project.dart';
import '../l10n/learning_hub_coverage_l10n.dart';
import '../theme/learning_ui_palette.dart';

class ProjectMaterialCoverageChip extends StatelessWidget {
  const ProjectMaterialCoverageChip({
    super.key,
    required this.project,
    this.compact = false,
  });

  final LearningProject project;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final l10n = LearningHubCoverageL10n.of(context);
    final personal = project.personalBuildReadiness;
    final coverage = project.materialCoverage;

    if (personal != null && personal.isInProgress) {
      return _Chip(
        label: compact
            ? l10n.personalReadinessCardLabel(personal)
            : l10n.personalReadinessSummary(personal),
        tone: _ChipTone.personal,
        palette: palette,
        compact: compact,
      );
    }

    if (coverage == null) {
      return const SizedBox.shrink();
    }

    return _Chip(
      label: compact
          ? l10n.publicCoverageCardLabel(coverage)
          : l10n.publicCoverageSummary(coverage),
      tone: _ChipTone.public,
      palette: palette,
      compact: compact,
    );
  }
}

enum _ChipTone { public, personal }

class _Chip extends StatelessWidget {
  const _Chip({
    required this.label,
    required this.tone,
    required this.palette,
    required this.compact,
  });

  final String label;
  final _ChipTone tone;
  final LearningUiPalette palette;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final background = tone == _ChipTone.personal
        ? palette.limeSoft
        : palette.cardSurfaceAlt;
    final foreground = tone == _ChipTone.personal
        ? palette.lime
        : palette.textSecondary;

    return Container(
      padding: EdgeInsetsDirectional.symmetric(
        horizontal: compact ? 8 : 10,
        vertical: compact ? 4 : 6,
      ),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: foreground.withValues(alpha: 0.24)),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelMedium?.copyWith(
          color: foreground,
          fontSize: compact ? 11 : 12,
          fontWeight: FontWeight.w600,
        ),
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
      ),
    );
  }
}

class ProjectMaterialCoveragePanel extends StatelessWidget {
  const ProjectMaterialCoveragePanel({
    super.key,
    required this.project,
    this.showPersonalReadiness = true,
  });

  final LearningProject project;
  final bool showPersonalReadiness;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final l10n = LearningHubCoverageL10n.of(context);
    final coverage = project.materialCoverage;
    final personal = showPersonalReadiness
        ? project.personalBuildReadiness
        : null;

    if (coverage == null && personal == null) {
      return const SizedBox.shrink();
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: palette.cardSurface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (coverage != null) ...[
            Text(
              l10n.publicCoverageTitle,
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                color: palette.textPrimary,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              l10n.publicCoverageSummary(coverage),
              style: Theme.of(
                context,
              ).textTheme.bodyMedium?.copyWith(color: palette.textSecondary),
            ),
            const SizedBox(height: AppSpacing.sm),
            Wrap(
              spacing: AppSpacing.sm,
              runSpacing: AppSpacing.xs,
              children: [
                _CoverageMetric(
                  label: l10n.totalMaterials(coverage.totalRequiredComponents),
                  palette: palette,
                ),
                _CoverageMetric(
                  label: l10n.availableMaterials(coverage.availableComponents),
                  palette: palette,
                  accent: true,
                ),
                _CoverageMetric(
                  label: l10n.missingMaterials(coverage.missingComponents),
                  palette: palette,
                ),
              ],
            ),
          ],
          if (personal != null && personal.isInProgress) ...[
            if (coverage != null) const SizedBox(height: 12),
            Text(
              l10n.personalReadinessTitle,
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                color: palette.textPrimary,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              l10n.personalReadinessSummary(personal),
              style: Theme.of(
                context,
              ).textTheme.bodyMedium?.copyWith(color: palette.textSecondary),
            ),
            if (personal.needsMaterialComponents > 0) ...[
              const SizedBox(height: 4),
              Text(
                l10n.personalNeedsMaterials(personal),
                style: Theme.of(
                  context,
                ).textTheme.bodySmall?.copyWith(color: palette.textSecondary),
              ),
            ],
          ],
        ],
      ),
    );
  }
}

class _CoverageMetric extends StatelessWidget {
  const _CoverageMetric({
    required this.label,
    required this.palette,
    this.accent = false,
  });

  final String label;
  final LearningUiPalette palette;
  final bool accent;

  @override
  Widget build(BuildContext context) {
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
              ? palette.lime.withValues(alpha: 0.32)
              : palette.borderSubtle,
        ),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
          color: accent ? palette.lime : palette.textSecondary,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
