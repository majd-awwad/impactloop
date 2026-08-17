import 'package:flutter/material.dart';

import '../../../../../app/theme/app_radius.dart';
import '../../../../../app/theme/app_spacing.dart';
import '../../../../../shared/widgets/app_status_badge.dart';
import '../../../data/models/supplier_my_materials_models.dart';
import '../../theme/supplier_theme_extension.dart';

class SupplierMaterialsSummaryRow extends StatelessWidget {
  const SupplierMaterialsSummaryRow({super.key, required this.summary});

  final SupplierMyMaterialsSummary summary;

  @override
  Widget build(BuildContext context) {
    final l = context.s;
    final items = <(String, int, IconData, AppStatusTone)>[
      (
        l.myMaterialsStatTotal,
        summary.total,
        Icons.inventory_2_outlined,
        AppStatusTone.primary,
      ),
      (
        l.myMaterialsStatAvailable,
        summary.available,
        Icons.check_circle_outline,
        AppStatusTone.success,
      ),
      (
        l.myMaterialsStatPendingReserved,
        summary.pendingOrReserved,
        Icons.schedule_outlined,
        AppStatusTone.warning,
      ),
      (
        l.myMaterialsStatReused,
        summary.reused,
        Icons.recycling_outlined,
        AppStatusTone.success,
      ),
      (
        l.myMaterialsStatUnavailable,
        summary.unavailable,
        Icons.remove_circle_outline,
        AppStatusTone.neutral,
      ),
    ];

    return LayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.maxWidth;
        final columns = width >= 1000
            ? 5
            : width >= 600
            ? 3
            : width >= 340
            ? 2
            : 1;
        final tileWidth = (width - (columns - 1) * AppSpacing.sm) / columns;
        return Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: [
            for (final item in items)
              SizedBox(
                width: tileWidth,
                child: _SummaryTile(
                  label: item.$1,
                  value: item.$2,
                  icon: item.$3,
                  tone: item.$4,
                ),
              ),
          ],
        );
      },
    );
  }
}

class _SummaryTile extends StatelessWidget {
  const _SummaryTile({
    required this.label,
    required this.value,
    required this.icon,
    required this.tone,
  });

  final String label;
  final int value;
  final IconData icon;
  final AppStatusTone tone;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    final style = AppStatusStyle.of(context, tone);
    final textTheme = Theme.of(context).textTheme;
    return Container(
      constraints: const BoxConstraints(minHeight: 90),
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.surfaceSolid,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: style.border),
      ),
      child: Row(
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: style.background,
              borderRadius: AppRadius.mdAll,
            ),
            child: Icon(icon, size: 18, color: style.foreground),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '$value',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: textTheme.titleLarge?.copyWith(
                    color: colors.textPrimary,
                    fontWeight: FontWeight.w800,
                    height: 1.1,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  label,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: textTheme.labelMedium?.copyWith(
                    color: colors.textMuted,
                    height: 1.15,
                    fontWeight: FontWeight.w600,
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
