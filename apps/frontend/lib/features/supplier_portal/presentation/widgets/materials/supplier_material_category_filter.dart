import 'package:flutter/material.dart';

import '../../../../../app/theme/app_radius.dart';
import '../../../../../app/theme/app_spacing.dart';
import '../../../data/models/supplier_my_materials_models.dart';
import '../../theme/supplier_theme_extension.dart';
import 'supplier_my_materials_colors.dart';
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
    final colors = context.supplierColors;

    if (categories.isEmpty) {
      return const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          l.filterCategory,
          style: context.supplierLabel().copyWith(
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
    final accent = SupplierMyMaterialsColors.statTotal(context);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadius.pillAll,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsetsDirectional.symmetric(
            horizontal: 14,
            vertical: 8,
          ),
          decoration: BoxDecoration(
            color: selected
                ? SupplierMyMaterialsColors.chipSelectedBackground(
                    context,
                    accent,
                  )
                : SupplierMyMaterialsColors.chipUnselectedBackground(
                    context,
                    accent,
                  ),
            borderRadius: AppRadius.pillAll,
            border: Border.all(
              color: selected
                  ? SupplierMyMaterialsColors.chipSelectedBorder(
                      context,
                      accent,
                    )
                  : SupplierMyMaterialsColors.chipUnselectedBorder(
                      context,
                      accent,
                    ),
              width: selected ? 1.5 : 1,
            ),
          ),
          child: Text(
            '$label ($count)',
            softWrap: false,
            style: context.supplierBody().copyWith(
              color: selected
                  ? SupplierMyMaterialsColors.chipSelectedText(context, accent)
                  : SupplierMyMaterialsColors.chipUnselectedText(
                      context,
                      accent,
                    ),
              fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
              fontSize: 13,
            ),
          ),
        ),
      ),
    );
  }
}
