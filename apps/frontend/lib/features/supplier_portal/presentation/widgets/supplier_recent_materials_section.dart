import 'package:flutter/material.dart';

import 'package:frontend/features/supplier_portal/presentation/theme/supplier_theme_extension.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../data/models/supplier_dashboard_material.dart';

class SupplierRecentMaterialsSection extends StatelessWidget {
  const SupplierRecentMaterialsSection({super.key, required this.materials});

  final List<SupplierDashboardMaterial> materials;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          context.s.recentMaterials,
          style: context.supplierSectionTitle(),
        ),
        const SizedBox(height: AppSpacing.md),
        if (materials.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(AppSpacing.lg),
            decoration: context.supplierDecorations.dashboardCard,
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: context.supplierDecorations.materialPlaceholder,
                  child: Icon(
                    Icons.inventory_2_outlined,
                    color: colors.accent,
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Text(
                    context.s.noMaterialsListedSubtitle,
                    style: context.supplierBody(),
                  ),
                ),
              ],
            ),
          )
        else
          ...materials.map((material) => _MaterialRow(material: material)),
      ],
    );
  }
}

class _MaterialRow extends StatelessWidget {
  const _MaterialRow({required this.material});

  final SupplierDashboardMaterial material;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: context.supplierDecorations.dashboardCard,
      child: Row(
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: context.supplierDecorations.materialPlaceholder,
            child: material.coverImageUrl != null
                ? ClipRRect(
                    borderRadius: AppRadius.mdAll,
                    child: Image.network(
                      material.coverImageUrl!,
                      fit: BoxFit.cover,
                      errorBuilder: (_, _, _) => Icon(
                        Icons.inventory_2_outlined,
                        color: colors.accent,
                      ),
                    ),
                  )
                : Icon(
                    Icons.inventory_2_outlined,
                    color: colors.accent,
                  ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  material.title,
                  style: context.supplierLabel().copyWith(
                    color: colors.textPrimary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '${material.quantity} ${material.unit} · ${material.status}',
                  style: context.supplierBody(),
                ),
                if (material.categoryName != null)
                  Text(
                    material.categoryName!,
                    style: context.supplierBody(),
                  ),
              ],
            ),
          ),
          Text(
            context.s.viewsCount(material.viewsCount),
            style: context.supplierBody(),
          ),
        ],
      ),
    );
  }
}
