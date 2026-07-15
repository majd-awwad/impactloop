import 'dart:typed_data';

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
    final colors = context.supplierColors;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: context.supplierDecorations.dashboardCard,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Icon(Icons.visibility_outlined, size: 20, color: colors.accent),
            const SizedBox(width: AppSpacing.sm),
            Expanded(child: Text(context.s.listingPreview, style: context.supplierTitle())),
          ]),
          const SizedBox(height: AppSpacing.xs),
          Text('This is how your material will appear to learners.', style: context.supplierBody().copyWith(color: colors.textMuted)),
          const SizedBox(height: AppSpacing.md),
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: SizedBox(height: 168, width: double.infinity, child: _coverImage(context)),
          ),
          const SizedBox(height: AppSpacing.md),
          Wrap(spacing: AppSpacing.xs, runSpacing: AppSpacing.xs, children: [
            _PreviewBadge(label: category?.nameEn ?? 'Category'),
            _PreviewBadge(label: context.s.conditionLabel(condition)),
            _PreviewBadge(label: isFree ? context.s.free : '₪${price?.isEmpty ?? true ? '—' : price}'),
          ]),
          const SizedBox(height: AppSpacing.md),
          Text(
            title.isEmpty ? 'Material title will appear here' : title,
            style: context.supplierSectionTitle(),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(description.isEmpty ? 'Short description of your material will appear here.' : description, maxLines: 3, overflow: TextOverflow.ellipsis, style: context.supplierBody().copyWith(color: colors.textMuted)),
          const SizedBox(height: AppSpacing.md),
          _PreviewMetadata(icon: Icons.grid_view_outlined, value: quantity.isEmpty || unit.isEmpty ? 'Quantity will appear here' : '$quantity $unit'),
          _PreviewMetadata(icon: Icons.location_on_outlined, value: pickupLabel?.isNotEmpty == true ? pickupLabel! : 'Pickup location will appear here'),
          _PreviewMetadata(icon: Icons.inventory_2_outlined, value: pickupAllowed ? 'Pickup available' : 'Pickup unavailable'),
          _PreviewMetadata(icon: Icons.local_shipping_outlined, value: deliveryAllowed ? 'Internal delivery available' : 'Delivery unavailable'),
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
    if (coverImageBytes != null) return Image.memory(coverImageBytes!, fit: BoxFit.cover);
    if (coverImageUrl != null && coverImageUrl!.isNotEmpty) {
      return Image.network(ApiConfig.resolveMediaUrl(coverImageUrl!), fit: BoxFit.cover, errorBuilder: (_, _, _) => _emptyImage(context));
    }
    return _emptyImage(context);
  }

  Widget _emptyImage(BuildContext context) => Container(
    color: context.supplierColors.surfaceSolid,
    alignment: Alignment.center,
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      Icon(Icons.image_outlined, color: context.supplierColors.textSecondary, size: 34),
      const SizedBox(height: AppSpacing.xs),
      Text('No image yet', style: context.supplierLabel()),
      Text('Add photos to see preview', style: context.supplierBody().copyWith(color: context.supplierColors.textMuted)),
    ]),
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
            child: Text(value, maxLines: 1, overflow: TextOverflow.ellipsis, style: context.supplierBody()),
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
