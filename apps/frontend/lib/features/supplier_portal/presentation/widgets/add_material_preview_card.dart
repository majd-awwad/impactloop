import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_colors.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';
import '../../../../app/theme/supplier_decorations.dart';
import '../../../../core/config/api_config.dart';
import '../../../materials/data/models/category.dart';
import '../../../materials/data/models/material_price_check_result.dart';

class AddMaterialPreviewCard extends StatelessWidget {
  const AddMaterialPreviewCard({
    super.key,
    required this.materialName,
    required this.title,
    required this.category,
    required this.condition,
    required this.quantity,
    required this.unit,
    required this.isFree,
    this.price,
    this.pickupCity,
    this.coverImageUrl,
    this.priceCheck,
  });

  final String materialName;
  final String title;
  final MaterialCategory? category;
  final String condition;
  final String quantity;
  final String unit;
  final bool isFree;
  final String? price;
  final String? pickupCity;
  final String? coverImageUrl;
  final MaterialPriceCheckResult? priceCheck;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: SupplierDecorations.dashboardCard,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Listing preview', style: AuthDarkTextStyles.title(context)),
          const SizedBox(height: AppSpacing.lg),
          if (coverImageUrl != null && coverImageUrl!.isNotEmpty) ...[
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: Image.network(
                ApiConfig.resolveMediaUrl(coverImageUrl!),
                height: 160,
                width: double.infinity,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => Container(
                  height: 160,
                  color: AuthDarkColors.surfaceSolid,
                  alignment: Alignment.center,
                  child: const Icon(Icons.broken_image_outlined),
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.md),
          ],
          Text(
            title.isEmpty ? 'Listing title' : title,
            style: AuthDarkTextStyles.sectionTitle(context),
          ),
          const SizedBox(height: AppSpacing.sm),
          _PreviewRow(label: 'Material name', value: materialName.isEmpty ? '—' : materialName),
          _PreviewRow(
            label: 'Category',
            value: category?.nameEn ?? '—',
          ),
          _PreviewRow(label: 'Condition', value: _label(condition)),
          _PreviewRow(label: 'Quantity', value: '$quantity $unit'),
          _PreviewRow(
            label: 'Price',
            value: isFree ? 'Free' : '₪${price ?? '—'}',
          ),
          if (pickupCity != null && pickupCity!.isNotEmpty)
            _PreviewRow(label: 'Pickup', value: pickupCity!),
          if (!isFree) ...[
            const SizedBox(height: AppSpacing.md),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(AppSpacing.sm),
              decoration: SupplierDecorations.profileSectionPanel,
              child: Text(
                priceCheck?.allowed == true
                    ? 'Price verified'
                    : priceCheck == null
                        ? 'Verify price before publishing'
                        : 'Price verification required',
                style: AuthDarkTextStyles.body(context).copyWith(
                  color: priceCheck?.allowed == true
                      ? AuthDarkColors.accent
                      : AuthDarkColors.textMuted,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  String _label(String value) {
    return value
        .split('_')
        .map((part) => part[0] + part.substring(1).toLowerCase())
        .join(' ');
  }
}

class _PreviewRow extends StatelessWidget {
  const _PreviewRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.xs),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 110,
            child: Text(
              label,
              style: AuthDarkTextStyles.body(context).copyWith(
                color: AuthDarkColors.textMuted,
              ),
            ),
          ),
          Expanded(
            child: Text(value, style: AuthDarkTextStyles.body(context)),
          ),
        ],
      ),
    );
  }
}
