import 'package:flutter/material.dart';

import '../../../../../app/theme/app_radius.dart';
import '../../../../../app/theme/app_spacing.dart';
import '../../theme/supplier_theme_extension.dart';
import 'supplier_dashboard_chart_card.dart';
import 'supplier_dashboard_colors.dart';

class SupplierMaterialsStatusChart extends StatelessWidget {
  const SupplierMaterialsStatusChart({
    super.key,
    required this.available,
    required this.reservedOrPending,
    required this.reused,
    required this.unavailable,
    this.compact = false,
  });

  final int available;
  final int reservedOrPending;
  final int reused;
  final int unavailable;
  final bool compact;

  int get _total => available + reservedOrPending + reused + unavailable;

  @override
  Widget build(BuildContext context) {
    final l = context.s;
    final segments = [
      (
        label: l.materialsChartAvailable,
        value: available,
        color: SupplierDashboardColors.available,
      ),
      (
        label: l.materialsChartReservedPending,
        value: reservedOrPending,
        color: SupplierDashboardColors.reserved,
      ),
      (
        label: l.statReusedMaterials,
        value: reused,
        color: SupplierDashboardColors.reused,
      ),
      (
        label: l.materialsChartUnavailable,
        value: unavailable,
        color: SupplierDashboardColors.unavailable,
      ),
    ];

    if (_total == 0) {
      return SupplierDashboardChartEmptyState(
        message: l.materialsChartEmpty,
        icon: Icons.bar_chart_outlined,
      );
    }

    return Column(
      children: [
        for (final segment in segments) ...[
          _MaterialBarRow(
            label: segment.label,
            value: segment.value,
            color: segment.color,
            total: _total,
            compact: compact,
          ),
          SizedBox(height: compact ? AppSpacing.xs : AppSpacing.sm),
        ],
        SizedBox(height: compact ? AppSpacing.xs : AppSpacing.sm),
        SupplierDashboardChartLegend(
          items: segments
              .map(
                (segment) => (
                  label: segment.label,
                  value: segment.value,
                  color: segment.color,
                ),
              )
              .toList(),
        ),
      ],
    );
  }
}

class _MaterialBarRow extends StatelessWidget {
  const _MaterialBarRow({
    required this.label,
    required this.value,
    required this.color,
    required this.total,
    required this.compact,
  });

  final String label;
  final int value;
  final Color color;
  final int total;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    final fraction = total == 0 ? 0.0 : value / total;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                label,
                style: context.supplierBody().copyWith(fontSize: 13),
              ),
            ),
            Text(
              '$value',
              style: context.supplierLabel().copyWith(
                color: color,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
        SizedBox(height: compact ? AppSpacing.xs : 6),
        LayoutBuilder(
          builder: (context, constraints) {
            final barWidth = constraints.maxWidth * fraction.clamp(0, 1);

            return Stack(
              children: [
                Container(
                  height: compact ? 10 : 14,
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: colors.chipUnselected,
                    borderRadius: AppRadius.pillAll,
                    border: colors.isDark
                        ? null
                        : Border.all(
                            color: colors.border.withValues(alpha: 0.5),
                          ),
                  ),
                ),
                if (value > 0)
                  Container(
                    height: compact ? 10 : 14,
                    width: barWidth < (compact ? 10 : 12)
                        ? (compact ? 10 : 12)
                        : barWidth,
                    decoration: BoxDecoration(
                      borderRadius: AppRadius.pillAll,
                      gradient: LinearGradient(
                        colors: [color, color.withValues(alpha: 0.75)],
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: color.withValues(alpha: 0.25),
                          blurRadius: 8,
                        ),
                      ],
                    ),
                  ),
              ],
            );
          },
        ),
      ],
    );
  }
}
