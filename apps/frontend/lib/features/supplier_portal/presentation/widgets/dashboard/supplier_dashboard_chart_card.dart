import 'package:flutter/material.dart';

import '../../../../../app/theme/app_radius.dart';
import '../../../../../app/theme/app_spacing.dart';
import '../../theme/supplier_theme_extension.dart';

class SupplierDashboardChartCard extends StatelessWidget {
  const SupplierDashboardChartCard({
    super.key,
    required this.title,
    required this.subtitle,
    required this.child,
  });

  final String title;
  final String subtitle;
  final Widget child;

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
          Text(title, style: context.supplierSectionTitle()),
          const SizedBox(height: AppSpacing.xs),
          Text(
            subtitle,
            style: context.supplierBody().copyWith(
              color: colors.textSecondary,
              fontSize: 13,
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          child,
        ],
      ),
    );
  }
}

class SupplierDashboardChartEmptyState extends StatelessWidget {
  const SupplierDashboardChartEmptyState({
    super.key,
    required this.message,
    this.icon = Icons.insights_outlined,
  });

  final String message;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.lg,
        vertical: AppSpacing.xl,
      ),
      decoration: BoxDecoration(
        color: colors.backgroundElevated.withValues(alpha: 0.45),
        borderRadius: AppRadius.lgAll,
        border: Border.all(
          color: colors.border.withValues(alpha: 0.25),
        ),
      ),
      child: Column(
        children: [
          Icon(icon, color: colors.textMuted, size: 36),
          const SizedBox(height: AppSpacing.sm),
          Text(
            message,
            textAlign: TextAlign.center,
            style: context.supplierBody().copyWith(
              color: colors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}

class SupplierDashboardChartLegend extends StatelessWidget {
  const SupplierDashboardChartLegend({super.key, required this.items});

  final List<({String label, int value, Color color})> items;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;

    return Wrap(
      spacing: AppSpacing.md,
      runSpacing: AppSpacing.sm,
      children: items
          .map(
            (item) => Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 10,
                  height: 10,
                  decoration: BoxDecoration(
                    color: item.color,
                    borderRadius: BorderRadius.circular(3),
                  ),
                ),
                const SizedBox(width: 6),
                Text(
                  '${item.label} (${item.value})',
                  style: context.supplierBody().copyWith(
                    fontSize: 12,
                    color: colors.textSecondary,
                  ),
                ),
              ],
            ),
          )
          .toList(),
    );
  }
}
