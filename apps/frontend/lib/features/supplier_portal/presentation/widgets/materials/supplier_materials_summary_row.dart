import 'package:flutter/material.dart';

import '../../../../../app/theme/app_radius.dart';
import '../../../../../app/theme/app_spacing.dart';
import '../../../../../app/theme/app_theme_colors.dart';
import '../../../../../shared/widgets/app_status_badge.dart';
import '../../../data/models/supplier_my_materials_models.dart';
import '../../theme/supplier_theme_extension.dart';

class SupplierMaterialsSummaryRow extends StatelessWidget {
  const SupplierMaterialsSummaryRow({
    super.key,
    required this.summary,
  });

  final SupplierMyMaterialsSummary summary;

  @override
  Widget build(BuildContext context) {
    final l = context.s;

    final items = [
      (
        l.myMaterialsStatTotal,
        summary.total,
        Icons.inventory_2_outlined,
        AppStatusTone.neutral,
      ),
      (
        l.myMaterialsStatAvailable,
        summary.available,
        Icons.check_circle_outline,
        AppStatusTone.primary,
      ),
      (
        l.myMaterialsStatPendingReserved,
        summary.pendingOrReserved,
        Icons.hourglass_top_outlined,
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
        Icons.block_outlined,
        AppStatusTone.neutral,
      ),
    ];

    return LayoutBuilder(
      builder: (context, constraints) {
        final maxWidth = constraints.maxWidth.isFinite && constraints.maxWidth > 0
            ? constraints.maxWidth
            : MediaQuery.sizeOf(context).width;
        final compact = maxWidth < AppSpacing.supplierLayoutBreakpoint;

        if (compact) {
          final tileWidth = (maxWidth - AppSpacing.sm) / 2;

          return Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: items
                .map(
                  (item) => SizedBox(
                    width: tileWidth,
                    child: _StatTile(
                      label: item.$1,
                      value: item.$2,
                      icon: item.$3,
                      tone: item.$4,
                    ),
                  ),
                )
                .toList(),
          );
        }

        return Row(
          children: [
            for (var i = 0; i < items.length; i++) ...[
              if (i > 0) const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: _StatTile(
                  label: items[i].$1,
                  value: items[i].$2,
                  icon: items[i].$3,
                  tone: items[i].$4,
                ),
              ),
            ],
          ],
        );
      },
    );
  }
}

class _StatTile extends StatelessWidget {
  const _StatTile({
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
    final colors = AppThemeColors.of(context);
    final textTheme = Theme.of(context).textTheme;
    final statusStyle = AppStatusStyle.of(context, tone);

    return Container(
      height: 96,
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.cardSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: statusStyle.border),
        boxShadow: [
          BoxShadow(
            color: colors.shadow.withValues(alpha: 0.06),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 4,
            height: double.infinity,
            decoration: BoxDecoration(
              color: statusStyle.foreground,
              borderRadius: AppRadius.smAll,
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: statusStyle.background,
              borderRadius: AppRadius.mdAll,
              border: Border.all(color: statusStyle.border),
            ),
            child: Icon(icon, color: statusStyle.foreground, size: 20),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  '$value',
                  style: textTheme.headlineSmall?.copyWith(
                    color: statusStyle.foreground,
                    fontWeight: FontWeight.w800,
                    height: 1,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  label,
                  style: textTheme.labelMedium?.copyWith(
                    color: colors.textMuted,
                    fontWeight: FontWeight.w600,
                    height: 1.2,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
