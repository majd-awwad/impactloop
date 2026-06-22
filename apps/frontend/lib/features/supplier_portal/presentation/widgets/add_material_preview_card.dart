import 'package:flutter/material.dart';

import 'package:frontend/features/supplier_portal/presentation/theme/supplier_theme_extension.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/config/api_config.dart';
import '../../../materials/data/models/category.dart';

enum AddMaterialPreviewPriceStatus {
  verified,
  withinApprovedCapVerifyPending,
  verificationFailed,
  verifyRequired,
}

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
    this.pickupLabel,
    this.coverImageUrl,
    this.priceStatus,
  });

  final String materialName;
  final String title;
  final MaterialCategory? category;
  final String condition;
  final String quantity;
  final String unit;
  final bool isFree;
  final String? price;
  final String? pickupLabel;
  final String? coverImageUrl;
  final AddMaterialPreviewPriceStatus? priceStatus;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: context.supplierDecorations.dashboardCard,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(context.s.listingPreview, style: context.supplierTitle()),
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
                  color: colors.surfaceSolid,
                  alignment: Alignment.center,
                  child: const Icon(Icons.broken_image_outlined),
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.md),
          ],
          Text(
            title.isEmpty ? context.s.listingTitle : title,
            style: context.supplierSectionTitle(),
          ),
          const SizedBox(height: AppSpacing.sm),
          _PreviewRow(
            label: context.s.materialName,
            value: materialName.isEmpty ? '—' : materialName,
          ),
          _PreviewRow(
            label: context.s.categorySectionTitle,
            value: category?.nameEn ?? '—',
          ),
          _PreviewRow(
            label: context.s.condition,
            value: context.s.conditionLabel(condition),
          ),
          _PreviewRow(
            label: context.s.quantity,
            value: '$quantity $unit',
          ),
          _PreviewRow(
            label: context.s.price,
            value: isFree ? context.s.free : '₪${price ?? '—'}',
          ),
          if (pickupLabel != null && pickupLabel!.isNotEmpty)
            _PreviewRow(label: context.s.pickupSectionTitle, value: pickupLabel!),
          if (!isFree && priceStatus != null) ...[
            const SizedBox(height: AppSpacing.md),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(AppSpacing.sm),
              decoration: context.supplierDecorations.profileSectionPanel,
              child: Text(
                _priceStatusMessage(context, priceStatus!),
                style: context.supplierBody().copyWith(
                  color: priceStatus == AddMaterialPreviewPriceStatus.verified
                      ? colors.accent
                      : colors.textMuted,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  String _priceStatusMessage(
    BuildContext context,
    AddMaterialPreviewPriceStatus status,
  ) {
    final l = context.s;
    return switch (status) {
      AddMaterialPreviewPriceStatus.verified => l.priceVerified,
      AddMaterialPreviewPriceStatus.withinApprovedCapVerifyPending =>
        l.verifyPriceWithinApprovedCap,
      AddMaterialPreviewPriceStatus.verificationFailed =>
        l.priceVerificationRequired,
      AddMaterialPreviewPriceStatus.verifyRequired =>
        l.verifyPriceBeforePublishing,
    };
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
              style: context.supplierBody().copyWith(
                color: context.supplierColors.textMuted,
              ),
            ),
          ),
          Expanded(
            child: Text(value, style: context.supplierBody()),
          ),
        ],
      ),
    );
  }
}
