import 'package:flutter/material.dart';

import '../../../../../app/theme/app_radius.dart';
import '../../../../../app/theme/app_spacing.dart';
import '../../../data/models/supplier_project_support.dart';
import '../../theme/supplier_theme_extension.dart';
import 'supplier_dashboard_colors.dart';

class SupplierProjectImpactPanel extends StatelessWidget {
  const SupplierProjectImpactPanel({
    super.key,
    required this.projectSupport,
  });

  final SupplierProjectSupport projectSupport;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: context.supplierDecorations.dashboardCard,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            context.s.projectImpactTitle,
            style: context.supplierSectionTitle(),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            projectSupport.hasImpact
                ? context.s.projectImpactDescription
                : context.s.projectImpactEmptyDescription,
            style: context.supplierBody().copyWith(
              color: colors.textSecondary,
              fontSize: 13,
              height: 1.4,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          LayoutBuilder(
            builder: (context, constraints) {
              final wide = constraints.maxWidth >= 760;
              final cards = [
                _ImpactMetricCard(
                  label: context.s.projectImpactProjectsSupported,
                  value: '${projectSupport.projectsSupported}',
                  icon: Icons.auto_stories_outlined,
                  accentColor: SupplierDashboardColors.available,
                ),
                _ImpactMetricCard(
                  label: context.s.projectImpactComponentsCompleted,
                  value: '${projectSupport.projectComponentsSupported}',
                  icon: Icons.playlist_add_check_rounded,
                  accentColor: SupplierDashboardColors.pending,
                ),
                _ImpactMetricCard(
                  label: context.s.projectImpactLearnerBuildsHelped,
                  value: '${projectSupport.learnerBuildsHelped}',
                  icon: Icons.construction_outlined,
                  accentColor: SupplierDashboardColors.reused,
                ),
              ];

              if (wide) {
                return Row(
                  children: [
                    for (var index = 0; index < cards.length; index++) ...[
                      if (index > 0) const SizedBox(width: AppSpacing.md),
                      Expanded(child: cards[index]),
                    ],
                  ],
                );
              }

              return Column(
                children: [
                  for (var index = 0; index < cards.length; index++) ...[
                    if (index > 0) const SizedBox(height: AppSpacing.sm),
                    cards[index],
                  ],
                ],
              );
            },
          ),
          if (projectSupport.latestSupportedProjects.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.lg),
            Text(
              context.s.projectImpactRecentProjects,
              style: context.supplierBody().copyWith(
                color: colors.textPrimary,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            ...projectSupport.latestSupportedProjects.map(
              (project) => Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                child: _LatestSupportedProjectRow(project: project),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _ImpactMetricCard extends StatelessWidget {
  const _ImpactMetricCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.accentColor,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color accentColor;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.backgroundElevated.withValues(alpha: 0.35),
        borderRadius: AppRadius.lgAll,
        border: Border.all(
          color: colors.border.withValues(alpha: colors.isDark ? 0.45 : 0.85),
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: accentColor.withValues(alpha: 0.14),
              borderRadius: AppRadius.mdAll,
            ),
            child: Icon(icon, color: accentColor, size: 20),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  value,
                  style: context.supplierSectionTitle().copyWith(fontSize: 22),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  label,
                  style: context.supplierBody().copyWith(
                    color: colors.textSecondary,
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _LatestSupportedProjectRow extends StatelessWidget {
  const _LatestSupportedProjectRow({required this.project});

  final SupplierLatestSupportedProject project;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    final category = project.categoryName?.trim();

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: colors.backgroundElevated.withValues(alpha: 0.4),
        borderRadius: AppRadius.mdAll,
        border: Border.all(
          color: colors.border.withValues(alpha: colors.isDark ? 0.45 : 0.85),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            project.title,
            style: context.supplierBody().copyWith(
              color: colors.textPrimary,
              fontWeight: FontWeight.w600,
            ),
          ),
          if (category != null && category.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              category,
              style: context.supplierBody().copyWith(
                color: colors.textSecondary,
                fontSize: 12,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
