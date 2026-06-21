import 'package:flutter/material.dart';

import '../../../../../app/theme/app_radius.dart';
import '../../../../../app/theme/app_spacing.dart';
import '../../../../../shared/widgets/materials/material_condition_badge.dart';
import '../../../../../shared/widgets/materials/material_price_badge.dart';
import '../../../../../shared/widgets/materials/material_status_badge.dart';
import '../../theme/supplier_theme_extension.dart';
import 'supplier_my_materials_colors.dart';

const supplierMaterialCardHeight = 440.0;

class SupplierMaterialCard extends StatelessWidget {
  const SupplierMaterialCard({
    super.key,
    required this.title,
    required this.description,
    required this.categoryLabel,
    required this.conditionLabel,
    required this.conditionTone,
    required this.statusLabel,
    required this.statusTone,
    required this.quantityLabel,
    required this.priceLabel,
    required this.locationLabel,
    required this.availabilityLabel,
    required this.deliveryAvailable,
    required this.isFree,
    this.imageUrl,
    this.viewsCount,
    this.createdAtLabel,
    this.onTap,
    this.actions,
  });

  final String title;
  final String description;
  final String categoryLabel;
  final String conditionLabel;
  final MaterialConditionBadgeTone conditionTone;
  final String statusLabel;
  final MaterialStatusBadgeTone statusTone;
  final String quantityLabel;
  final String priceLabel;
  final String locationLabel;
  final String availabilityLabel;
  final bool deliveryAvailable;
  final bool isFree;
  final String? imageUrl;
  final int? viewsCount;
  final String? createdAtLabel;
  final VoidCallback? onTap;
  final List<Widget>? actions;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    final hasImage = imageUrl != null && imageUrl!.trim().isNotEmpty;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadius.xlAll,
        child: Ink(
          height: supplierMaterialCardHeight,
          decoration: BoxDecoration(
            color: colors.surfaceSolid.withValues(
              alpha: colors.isDark ? 0.78 : 1,
            ),
            borderRadius: AppRadius.xlAll,
            border: Border.all(
              color: colors.isDark
                  ? colors.border.withValues(alpha: 0.45)
                  : colors.border,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              ClipRRect(
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(16),
                ),
                child: SizedBox(
                  height: 160,
                  child: hasImage
                      ? Image.network(
                          imageUrl!,
                          fit: BoxFit.cover,
                          errorBuilder: (_, _, _) => _Placeholder(colors: colors),
                        )
                      : _Placeholder(colors: colors),
                ),
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        categoryLabel,
                        style: context.supplierChip().copyWith(
                          color: SupplierMyMaterialsColors.lightTeal,
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 6),
                      Text(
                        title,
                        style: context.supplierSectionTitle().copyWith(
                          color: colors.textPrimary,
                          fontSize: 17,
                          fontWeight: FontWeight.w800,
                          height: 1.2,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      Wrap(
                        spacing: AppSpacing.xs,
                        runSpacing: AppSpacing.xs,
                        children: [
                          MaterialStatusBadge(
                            label: statusLabel,
                            tone: statusTone,
                          ),
                          MaterialConditionBadge(
                            label: conditionLabel,
                            tone: conditionTone,
                          ),
                          MaterialPriceBadge(
                            label: priceLabel,
                            isFree: isFree,
                          ),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      Text(
                        quantityLabel,
                        style: context.supplierBody().copyWith(
                          color: colors.textSecondary,
                          fontSize: 13,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        locationLabel,
                        style: context.supplierBody().copyWith(
                          color: colors.textMuted,
                          fontSize: 12.5,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        availabilityLabel,
                        style: context.supplierBody().copyWith(
                          color: colors.textMuted,
                          fontSize: 12,
                        ),
                      ),
                      const Spacer(),
                      if (createdAtLabel != null || (viewsCount ?? 0) > 0)
                        Text(
                          [
                            if (createdAtLabel != null) createdAtLabel,
                            if ((viewsCount ?? 0) > 0) '$viewsCount views',
                          ].join(' · '),
                          style: context.supplierBody().copyWith(
                            color: colors.textMuted,
                            fontSize: 11.5,
                          ),
                        ),
                      if (actions != null && actions!.isNotEmpty) ...[
                        const SizedBox(height: AppSpacing.sm),
                        SizedBox(
                          width: double.infinity,
                          child: Row(
                            children: [
                              for (var i = 0; i < actions!.length; i++) ...[
                                if (i > 0) const SizedBox(width: AppSpacing.sm),
                                Expanded(child: actions![i]),
                              ],
                            ],
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Placeholder extends StatelessWidget {
  const _Placeholder({required this.colors});

  final SupplierColorScheme colors;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: colors.chipUnselected,
      child: Center(
        child: Icon(
          Icons.image_outlined,
          size: 40,
          color: colors.textMuted,
        ),
      ),
    );
  }
}
