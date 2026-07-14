import 'package:flutter/material.dart';

import '../../../../../app/theme/app_radius.dart';
import '../../../../../app/theme/app_spacing.dart';
import '../../../../../app/theme/app_theme_colors.dart';
import '../../../data/models/supplier_my_materials_models.dart';
import '../../theme/supplier_theme_extension.dart';
import 'supplier_responsive_chip_row.dart';

class SupplierMaterialCategoryFilter extends StatelessWidget {
  const SupplierMaterialCategoryFilter({
    super.key,
    required this.categories,
    required this.selectedCategoryId,
    required this.totalCount,
    required this.onSelected,
  });

  final List<SupplierMyMaterialsCategoryOption> categories;
  final String? selectedCategoryId;
  final int totalCount;
  final ValueChanged<String?> onSelected;

  @override
  Widget build(BuildContext context) {
    final l = context.s;
    final colors = AppThemeColors.of(context);
    final textTheme = Theme.of(context).textTheme;

    if (categories.isEmpty) {
      return const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          l.filterCategory,
          style: textTheme.labelLarge?.copyWith(
            color: colors.textSecondary,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: AppSpacing.xs),
        SupplierResponsiveChipRow(
          children: [
            _CategoryChip(
              label: l.filterAllCategories,
              selected: selectedCategoryId == null,
              count: totalCount,
              onTap: () => onSelected(null),
            ),
            for (final category in categories)
              _CategoryChip(
                label: context.s.isArabic ? category.nameAr : category.nameEn,
                selected: selectedCategoryId == category.id,
                count: category.count,
                onTap: () => onSelected(category.id),
              ),
          ],
        ),
      ],
    );
  }
}

class _CategoryChip extends StatelessWidget {
  const _CategoryChip({
    required this.label,
    required this.selected,
    required this.count,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final int count;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final textTheme = Theme.of(context).textTheme;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadius.pillAll,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsetsDirectional.symmetric(
            horizontal: AppSpacing.md - AppSpacing.xs,
            vertical: AppSpacing.sm,
          ),
          decoration: BoxDecoration(
            color: selected ? colors.primarySoft : colors.surfaceMuted,
            borderRadius: AppRadius.pillAll,
            border: Border.all(
              color: selected
                  ? colors.primary.withValues(alpha: 0.34)
                  : colors.borderSubtle,
            ),
          ),
          child: Text(
            '$label ($count)',
            softWrap: false,
            style: textTheme.labelMedium?.copyWith(
              color: selected ? colors.primary : colors.textSecondary,
              fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
            ),
          ),
        ),
      ),
    );
  }
}
