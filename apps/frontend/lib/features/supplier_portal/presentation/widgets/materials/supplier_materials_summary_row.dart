import 'package:flutter/material.dart';

import '../../../../../app/theme/app_radius.dart';
import '../../../../../app/theme/app_spacing.dart';
import '../../../data/models/supplier_my_materials_models.dart';
import '../../theme/supplier_theme_extension.dart';
import 'supplier_my_materials_colors.dart';

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
        SupplierMyMaterialsColors.statTotal(context),
      ),
      (
        l.myMaterialsStatAvailable,
        summary.available,
        Icons.check_circle_outline,
        SupplierMyMaterialsColors.statAvailable(context),
      ),
      (
        l.myMaterialsStatPendingReserved,
        summary.pendingOrReserved,
        Icons.hourglass_top_outlined,
        SupplierMyMaterialsColors.statPending(context),
      ),
      (
        l.myMaterialsStatReused,
        summary.reused,
        Icons.recycling_outlined,
        SupplierMyMaterialsColors.statReused(context),
      ),
      (
        l.myMaterialsStatUnavailable,
        summary.unavailable,
        Icons.block_outlined,
        SupplierMyMaterialsColors.statUnavailable(context),
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
                      accent: item.$4,
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
                  accent: items[i].$4,
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
    required this.accent,
  });

  final String label;
  final int value;
  final IconData icon;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    final background = SupplierMyMaterialsColors.statBackground(
      context,
      accent,
    );
    final border = SupplierMyMaterialsColors.statBorder(context, accent);

    return Container(
      height: 96,
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.isDark
            ? colors.surfaceSolid.withValues(alpha: 0.74)
            : colors.surfaceSolid,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: border),
      ),
      child: Row(
        children: [
          Container(
            width: 4,
            height: double.infinity,
            decoration: BoxDecoration(
              color: accent,
              borderRadius: AppRadius.smAll,
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: background,
              borderRadius: AppRadius.mdAll,
              border: Border.all(color: border),
            ),
            child: Icon(icon, color: accent, size: 20),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  '$value',
                  style: context.supplierSectionTitle().copyWith(
                    color: colors.isDark
                        ? accent
                        : SupplierMyMaterialsColors.darkenForLightMode(accent),
                    fontSize: 24,
                    fontWeight: FontWeight.w800,
                    height: 1,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  label,
                  style: context.supplierBody().copyWith(
                    color: colors.textMuted,
                    fontSize: 12,
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
