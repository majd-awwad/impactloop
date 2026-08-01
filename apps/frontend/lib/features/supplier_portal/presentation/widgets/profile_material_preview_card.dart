import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../core/config/api_config.dart';
import '../../../../shared/widgets/materials/material_condition_badge.dart';
import '../../../../shared/widgets/materials/material_price_badge.dart';
import '../../../../shared/widgets/materials/material_status_badge.dart';
import '../../data/models/supplier_profile.dart';
import '../theme/supplier_theme_extension.dart';
import 'material_engagement_chip.dart';
import 'materials/supplier_material_card.dart';
import 'materials/supplier_material_label_helper.dart';

const profileMaterialPreviewCardHeight = supplierMaterialCardHeight;
const _imageHeight = 160.0;

class ProfileMaterialPreviewCard extends StatefulWidget {
  const ProfileMaterialPreviewCard({super.key, required this.material});

  final SupplierMaterialPreviewItem material;

  @override
  State<ProfileMaterialPreviewCard> createState() =>
      _ProfileMaterialPreviewCardState();
}

class _ProfileMaterialPreviewCardState
    extends State<ProfileMaterialPreviewCard> {
  bool _hovered = false;

  @override
  Widget build(BuildContext context) {
    final material = widget.material;
    final colors = context.supplierColors;
    final isArabic = context.isSupplierArabic;
    final imageUrl =
        (material.imageUrl != null && material.imageUrl!.trim().isNotEmpty)
        ? ApiConfig.resolveMediaUrl(material.imageUrl!)
        : null;
    final condition = SupplierMaterialLabelHelper.conditionMeta(
      material.condition,
    );
    final priceLabel = SupplierMaterialLabelHelper.resolveText(
      SupplierMaterialLabelHelper.priceLabel(
        isFree: material.isFree,
        price: material.price,
        currency: material.currency,
      ),
      isArabic,
    );
    final categoryLabel = material.categoryName ?? '—';
    final quantityLabel = SupplierMaterialLabelHelper.resolveText(
      SupplierMaterialLabelHelper.quantityLabel(
        material.quantity,
        material.unit,
      ),
      isArabic,
    );
    final city = material.locationCity?.trim() ?? '';
    final locationLabel = city.isEmpty
        ? 'Not provided yet.'
        : SupplierMaterialLabelHelper.resolveText(
            SupplierMaterialLabelHelper.locationLabel(
              city: city,
              area: material.locationArea,
            ),
            isArabic,
          );
    final availabilityLabel = SupplierMaterialLabelHelper.resolveText(
      SupplierMaterialLabelHelper.availabilityLabel(
        pickupAllowed: material.pickupAllowed,
        deliveryAvailable: material.deliveryAllowed,
      ),
      isArabic,
    );
    final createdAtLabel = _formatListedDate(material.createdAt);
    final footerParts = <String>[
      ?createdAtLabel,
      if (material.reservationsCount > 0)
        '${material.reservationsCount} reservations',
    ];

    return MouseRegion(
      onEnter: (_) => setState(() => _hovered = true),
      onExit: (_) => setState(() => _hovered = false),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        curve: Curves.easeOutCubic,
        transform: Matrix4.translationValues(0, _hovered ? -2 : 0, 0),
        decoration: BoxDecoration(
          borderRadius: AppRadius.xlAll,
          boxShadow: [
            BoxShadow(
              color: colors.cardShadow.withValues(
                alpha: _hovered ? 0.16 : 0.07,
              ),
              blurRadius: _hovered ? 18 : 10,
              offset: Offset(0, _hovered ? 8 : 3),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: AppRadius.xlAll,
          child: Material(
            color: colors.surfaceSolid.withValues(
              alpha: colors.isDark ? 0.78 : 1,
            ),
            child: Ink(
              height: profileMaterialPreviewCardHeight,
              decoration: BoxDecoration(
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
                      height: _imageHeight,
                      child: Stack(
                        fit: StackFit.expand,
                        children: [
                          AnimatedScale(
                            scale: _hovered ? 1.04 : 1,
                            duration: const Duration(milliseconds: 220),
                            curve: Curves.easeOutCubic,
                            child: imageUrl == null
                                ? _ImagePlaceholder(colors: colors)
                                : Image.network(
                                    imageUrl,
                                    fit: BoxFit.cover,
                                    errorBuilder: (_, _, _) =>
                                        _ImagePlaceholder(colors: colors),
                                  ),
                          ),
                          Positioned(
                            left: 8,
                            bottom: 8,
                            child: Row(
                              children: [
                                MaterialEngagementChip(
                                  icon: Icons.visibility_outlined,
                                  count: material.viewsCount,
                                  tone: MaterialEngagementChipTone.views,
                                ),
                                const SizedBox(width: 6),
                                MaterialEngagementChip(
                                  icon: Icons.favorite_border,
                                  count: material.likesCount,
                                  tone: MaterialEngagementChipTone.likes,
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
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
                              color: colors.accent,
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 6),
                          Text(
                            material.title,
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
                              _ProfilePreviewStatusBadge(
                                status: material.status,
                              ),
                              MaterialConditionBadge(
                                label: SupplierMaterialLabelHelper.resolveText(
                                  condition.label,
                                  isArabic,
                                ),
                                tone: condition.tone,
                              ),
                              MaterialPriceBadge(
                                label: priceLabel,
                                isFree: material.isFree,
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
                          if (footerParts.isNotEmpty)
                            Text(
                              footerParts.join(' · '),
                              style: context.supplierBody().copyWith(
                                color: colors.textMuted,
                                fontSize: 11.5,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  String? _formatListedDate(DateTime createdAt) {
    if (createdAt.millisecondsSinceEpoch <= 0) {
      return null;
    }

    final month = createdAt.month.toString().padLeft(2, '0');
    final day = createdAt.day.toString().padLeft(2, '0');
    return 'Listed ${createdAt.year}-$month-$day';
  }
}

class _ImagePlaceholder extends StatelessWidget {
  const _ImagePlaceholder({required this.colors});

  final SupplierUiPalette colors;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: colors.chipUnselected,
      child: Center(
        child: Icon(Icons.image_outlined, size: 40, color: colors.textMuted),
      ),
    );
  }
}

class _ProfilePreviewStatusBadge extends StatelessWidget {
  const _ProfilePreviewStatusBadge({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final isArabic = context.isSupplierArabic;
    final meta = SupplierMaterialLabelHelper.statusMeta(status);
    return MaterialStatusBadge(
      label: SupplierMaterialLabelHelper.resolveText(meta.label, isArabic),
      tone: meta.tone,
    );
  }
}
