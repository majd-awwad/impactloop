import 'package:flutter/material.dart';

import '../../../../../app/theme/app_radius.dart';
import '../../../../../app/theme/app_spacing.dart';
import '../../../data/models/supplier_project_support.dart';
import '../../theme/supplier_theme_extension.dart';
import 'supplier_dashboard_colors.dart';

class SupplierProjectImpactPanel extends StatelessWidget {
  const SupplierProjectImpactPanel({super.key, required this.projectSupport});

  final SupplierProjectSupport projectSupport;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    final metrics = [
      _ImpactMetric(
        label: context.s.projectImpactProjectsSupported,
        value: '${projectSupport.projectsSupported}',
        icon: Icons.auto_stories_outlined,
        accentColor: SupplierDashboardColors.available,
      ),
      _ImpactMetric(
        label: context.s.projectImpactComponentsCompleted,
        value: '${projectSupport.projectComponentsSupported}',
        icon: Icons.playlist_add_check_rounded,
        accentColor: SupplierDashboardColors.pending,
      ),
      _ImpactMetric(
        label: context.s.projectImpactLearnerBuildsHelped,
        value: '${projectSupport.learnerBuildsHelped}',
        icon: Icons.construction_outlined,
        accentColor: SupplierDashboardColors.reused,
      ),
    ];

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
          const SizedBox(height: AppSpacing.sm),
          Text(
            projectSupport.hasImpact
                ? context.s.projectImpactDescription
                : context.s.projectImpactEmptyDescription,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: context.supplierBody().copyWith(
              color: colors.textSecondary,
              fontSize: 13,
              height: 1.35,
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          LayoutBuilder(
            builder: (context, constraints) {
              if (constraints.maxWidth >= 360) {
                return Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    for (var index = 0; index < metrics.length; index++) ...[
                      if (index > 0) const SizedBox(width: AppSpacing.md),
                      Expanded(
                        child: _ImpactMetricItem(metric: metrics[index]),
                      ),
                    ],
                  ],
                );
              }

              return Column(
                children: [
                  for (var index = 0; index < metrics.length; index++) ...[
                    if (index > 0) const SizedBox(height: AppSpacing.md),
                    _ImpactMetricItem(metric: metrics[index]),
                  ],
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}

class _ImpactMetric {
  const _ImpactMetric({
    required this.label,
    required this.value,
    required this.icon,
    required this.accentColor,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color accentColor;
}

class _ImpactMetricItem extends StatelessWidget {
  const _ImpactMetricItem({required this.metric});

  final _ImpactMetric metric;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.backgroundElevated.withValues(alpha: 0.34),
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: colors.border.withValues(alpha: 0.7)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 36,
            height: 36,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: metric.accentColor.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(metric.icon, color: metric.accentColor, size: 18),
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            metric.value,
            style: context.supplierSectionTitle().copyWith(fontSize: 22),
          ),
          const SizedBox(height: 2),
          Text(
            metric.label,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: context.supplierBody().copyWith(
              color: colors.textSecondary,
              fontSize: 12,
              height: 1.2,
            ),
          ),
        ],
      ),
    );
  }
}
