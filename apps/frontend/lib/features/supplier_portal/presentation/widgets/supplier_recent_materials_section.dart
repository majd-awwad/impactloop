import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_colors.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';
import '../../../../app/theme/supplier_decorations.dart';
import '../../data/models/supplier_dashboard_material.dart';

class SupplierRecentMaterialsSection extends StatelessWidget {
  const SupplierRecentMaterialsSection({super.key, required this.materials});

  final List<SupplierDashboardMaterial> materials;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Recent materials',
          style: AuthDarkTextStyles.sectionTitle(context),
        ),
        const SizedBox(height: AppSpacing.md),
        if (materials.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(AppSpacing.lg),
            decoration: SupplierDecorations.dashboardCard,
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: SupplierDecorations.materialPlaceholder,
                  child: const Icon(
                    Icons.inventory_2_outlined,
                    color: AuthDarkColors.accent,
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Text(
                    'Recent listings will appear here after you add reusable materials.',
                    style: AuthDarkTextStyles.body(context),
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
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: SupplierDecorations.dashboardCard,
      child: Row(
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: SupplierDecorations.materialPlaceholder,
            child: material.coverImageUrl != null
                ? ClipRRect(
                    borderRadius: AppRadius.mdAll,
                    child: Image.network(
                      material.coverImageUrl!,
                      fit: BoxFit.cover,
                      errorBuilder: (_, _, _) => const Icon(
                        Icons.inventory_2_outlined,
                        color: AuthDarkColors.accent,
                      ),
                    ),
                  )
                : const Icon(
                    Icons.inventory_2_outlined,
                    color: AuthDarkColors.accent,
                  ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  material.title,
                  style: AuthDarkTextStyles.label(context).copyWith(
                    color: AuthDarkColors.textPrimary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '${material.quantity} ${material.unit} · ${material.status}',
                  style: AuthDarkTextStyles.body(context),
                ),
                if (material.categoryName != null)
                  Text(
                    material.categoryName!,
                    style: AuthDarkTextStyles.body(context),
                  ),
              ],
            ),
          ),
          Text(
            '${material.viewsCount} views',
            style: AuthDarkTextStyles.body(context),
          ),
        ],
      ),
    );
  }
}
