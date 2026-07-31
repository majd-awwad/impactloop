import 'package:flutter/material.dart';

import '../../../../../app/theme/app_radius.dart';
import '../../../../../app/theme/app_spacing.dart';
import '../../../data/models/supplier_my_materials_models.dart';
import '../../theme/supplier_theme_extension.dart';

/// A scalable category selector. Categories remain server-filtered, but are not
/// rendered as a permanently expanded chip row.
class SupplierMaterialCategoryFilter extends StatelessWidget {
  const SupplierMaterialCategoryFilter({
    super.key,
    required this.categories,
    required this.selectedCategoryId,
    required this.onSelected,
  });

  final List<SupplierMyMaterialsCategoryOption> categories;
  final String? selectedCategoryId;
  final ValueChanged<String?> onSelected;

  @override
  Widget build(BuildContext context) {
    final l = context.s;
    final colors = context.supplierColors;
    final selected = categories
        .cast<SupplierMyMaterialsCategoryOption?>()
        .firstWhere(
          (category) => category?.id == selectedCategoryId,
          orElse: () => null,
        );

    return DropdownButtonFormField<String?>(
      initialValue: selected?.id,
      isExpanded: true,
      onChanged: onSelected,
      decoration: InputDecoration(
        labelText: l.filterCategory,
        filled: true,
        fillColor: colors.surfaceSolid,
        contentPadding: const EdgeInsetsDirectional.fromSTEB(
          AppSpacing.md,
          12,
          AppSpacing.sm,
          12,
        ),
        border: OutlineInputBorder(
          borderRadius: AppRadius.lgAll,
          borderSide: BorderSide(color: colors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: AppRadius.lgAll,
          borderSide: BorderSide(color: colors.border),
        ),
      ),
      items: [
        DropdownMenuItem<String?>(
          value: null,
          child: Text(l.filterAllCategories),
        ),
        for (final category in categories)
          DropdownMenuItem<String?>(
            value: category.id,
            child: Text(
              context.s.isArabic ? category.nameAr : category.nameEn,
              overflow: TextOverflow.ellipsis,
            ),
          ),
      ],
    );
  }
}
