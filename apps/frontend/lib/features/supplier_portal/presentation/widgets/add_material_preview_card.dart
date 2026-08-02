import 'dart:typed_data';

import 'package:flutter/material.dart';

import 'package:frontend/features/supplier_portal/presentation/theme/supplier_theme_extension.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/config/api_config.dart';
import '../../../../core/format/localized_formatters.dart';
import '../../../../l10n/l10n.dart';
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
    required this.description,
    required this.category,
    required this.condition,
    required this.quantity,
    required this.unit,
    required this.isFree,
    required this.pickupAllowed,
    required this.deliveryAllowed,
    this.price,
    this.pickupLabel,
    this.coverImageUrl,
    this.coverImageBytes,
    this.priceStatus,
  });

  final String materialName;
  final String title;
  final String description;
  final MaterialCategory? category;
  final String condition;
  final String quantity;
  final String unit;
  final bool isFree;
  final bool pickupAllowed;
  final bool deliveryAllowed;
  final String? price;
  final String? pickupLabel;
  final String? coverImageUrl;
  final Uint8List? coverImageBytes;
  final AddMaterialPreviewPriceStatus? priceStatus;

  @override
  Widget build(BuildContext context) {
    final l = context.s;
    final l10n = context.l10n;
    final formatters = LocalizedFormatters(l10n);
    final colors = context.supplierColors;
    final categoryLabel = category == null
        ? l.categorySectionTitle
        : l.isArabic
        ? category!.nameAr
        : category!.nameEn;
    final parsedQuantity = double.tryParse(quantity);
    final quantityLabel = parsedQuantity != null && unit.isNotEmpty
        ? formatters.quantity(parsedQuantity, unit)
        : l.quantityPlaceholder;
    final priceLabel = isFree
        ? l.free
        : price == null || price!.isEmpty
        ? '—'
        : formatters.nis(double.tryParse(price!) ?? 0);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: context.supplierDecorations.dashboardCard,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.visibility_outlined, size: 20, color: colors.accent),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  l.listingPreview,
                  style: context.supplierTitle(),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            l.listingPreviewSubtitle,
            style: context.supplierBody().copyWith(color: colors.textMuted),
          ),
          const SizedBox(height: AppSpacing.md),
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: SizedBox(
              height: 168,
              width: double.infinity,
              child: _coverImage(context),
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          Wrap(
            spacing: AppSpacing.xs,
            runSpacing: AppSpacing.xs,
            children: [
              _PreviewBadge(label: categoryLabel),
              _PreviewBadge(label: l.conditionLabel(condition)),
              _PreviewBadge(label: priceLabel),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            title.isEmpty ? l.materialTitlePlaceholder : title,
            style: context.supplierSectionTitle(),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            description.isEmpty ? l.shortDescriptionPlaceholder : description,
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
            style: context.supplierBody().copyWith(color: colors.textMuted),
          ),
          const SizedBox(height: AppSpacing.md),
          _PreviewMetadata(
            icon: Icons.grid_view_outlined,
            value: quantityLabel,
          ),
          _PreviewMetadata(
            icon: Icons.location_on_outlined,
            value: pickupLabel?.isNotEmpty == true
                ? pickupLabel!
                : l.pickupLocationPlaceholder,
          ),
          _PreviewMetadata(
            icon: Icons.inventory_2_outlined,
            value: pickupAllowed ? l.pickupAvailable : l.pickupUnavailable,
          ),
          _PreviewMetadata(
            icon: Icons.local_shipping_outlined,
            value: deliveryAllowed
                ? l.internalDeliveryAvailable
                : l.deliveryUnavailable,
          ),
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

  Widget _coverImage(BuildContext context) {
    if (coverImageBytes != null) {
      return Image.memory(coverImageBytes!, fit: BoxFit.cover);
    }
    if (coverImageUrl != null && coverImageUrl!.isNotEmpty) {
      return Image.network(
        ApiConfig.resolveMediaUrl(coverImageUrl!),
        fit: BoxFit.cover,
        errorBuilder: (_, _, _) => _emptyImage(context),
      );
    }
    return _emptyImage(context);
  }

  Widget _emptyImage(BuildContext context) => Container(
    color: context.supplierColors.surfaceSolid,
    alignment: Alignment.center,
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(
          Icons.image_outlined,
          color: context.supplierColors.textSecondary,
          size: 34,
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(context.s.noImageYet, style: context.supplierLabel()),
        Text(
          context.s.addPhotosToSeePreview,
          style: context.supplierBody().copyWith(
            color: context.supplierColors.textMuted,
          ),
        ),
      ],
    ),
  );

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

class _PreviewMetadata extends StatelessWidget {
  const _PreviewMetadata({required this.icon, required this.value});

  final IconData icon;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Row(
        children: [
          Icon(icon, size: 17, color: context.supplierColors.textSecondary),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: context.supplierBody(),
            ),
          ),
        ],
      ),
    );
  }
}

class _PreviewBadge extends StatelessWidget {
  const _PreviewBadge({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: 4),
    decoration: context.supplierDecorations.profileSectionPanel,
    child: Text(label, style: context.supplierChip()),
  );
}
