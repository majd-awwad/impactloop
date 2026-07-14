import 'package:flutter/material.dart';

import 'package:frontend/features/supplier_portal/presentation/theme/supplier_theme_extension.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../shared/widgets/app_section_card.dart';
import 'supplier_verification_badge.dart';

class SupplierProfilePreviewCard extends StatelessWidget {
  const SupplierProfilePreviewCard({
    super.key,
    required this.publicName,
    required this.supplierType,
    required this.verificationStatus,
    this.description,
    this.city,
    this.area,
    this.country,
    this.visibility,
    this.locationSummaryOverride,
  });

  final String publicName;
  final String supplierType;
  final String verificationStatus;
  final String? description;
  final String? city;
  final String? area;
  final String? country;
  final String? visibility;
  final String? locationSummaryOverride;

  String _locationSummary(BuildContext context) {
    if (locationSummaryOverride != null &&
        locationSummaryOverride!.trim().isNotEmpty) {
      return locationSummaryOverride!.trim();
    }

    final parts = [
      if (city != null && city!.trim().isNotEmpty) city!.trim(),
      if (area != null && area!.trim().isNotEmpty) area!.trim(),
      if (country != null && country!.trim().isNotEmpty) country!.trim(),
    ];
    return parts.isEmpty ? context.s.pickupAreaNotSet : parts.join(' · ');
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    final locationSummary = _locationSummary(context);

    return AppSectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.visibility_outlined, color: colors.accent),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  context.s.learnerPreview,
                  style: context.supplierSectionTitle(),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            context.s.learnerPreviewSubtitle,
            style: context.supplierBody(),
          ),
          const SizedBox(height: AppSpacing.lg),
          AppSectionCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                LayoutBuilder(
                  builder: (context, constraints) {
                    final compact = constraints.maxWidth < 560;

                    if (compact) {
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _PreviewIdentityRow(
                            publicName: publicName,
                            supplierType: supplierType,
                            verificationStatus: verificationStatus,
                            locationSummary: locationSummary,
                          ),
                          const SizedBox(height: AppSpacing.md),
                          const Align(
                            alignment: Alignment.centerLeft,
                            child: _PreviewIllustration(),
                          ),
                        ],
                      );
                    }

                    return Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: _PreviewIdentityRow(
                            publicName: publicName,
                            supplierType: supplierType,
                            verificationStatus: verificationStatus,
                            locationSummary: locationSummary,
                          ),
                        ),
                        const SizedBox(width: AppSpacing.md),
                        const _PreviewIllustration(),
                      ],
                    );
                  },
                ),
                const SizedBox(height: AppSpacing.md),
                Text(
                  description?.trim().isNotEmpty == true
                      ? description!.trim()
                      : context.s.defaultMaterialsDescription,
                  style: context.supplierBody().copyWith(
                    color: colors.textPrimary.withValues(alpha: 0.9),
                  ),
                ),
                if (visibility != null && visibility!.isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    context.s.locationVisibilityLabel(
                      context.s.visibilityLabel(visibility!),
                    ),
                    style: context.supplierBody().copyWith(
                      color: colors.accent,
                      fontSize: 12,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _PreviewIdentityRow extends StatelessWidget {
  const _PreviewIdentityRow({
    required this.publicName,
    required this.supplierType,
    required this.verificationStatus,
    required this.locationSummary,
  });

  final String publicName;
  final String supplierType;
  final String verificationStatus;
  final String locationSummary;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 52,
          height: 52,
          alignment: Alignment.center,
          decoration: context.supplierDecorations.avatarCircle,
          child: Text(
            publicName.isNotEmpty ? publicName.characters.first.toUpperCase() : '?',
            style: context.supplierTitle().copyWith(
              color: context.supplierColors.accent,
            ),
          ),
        ),
        const SizedBox(width: AppSpacing.md),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                publicName.isNotEmpty ? publicName : context.s.yourPublicName,
                style: context.supplierTitle(),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                context.s.supplierTypeLabel(supplierType),
                style: context.supplierBody(),
              ),
              const SizedBox(height: AppSpacing.sm),
              Wrap(
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.sm,
                children: [
                  SupplierVerificationBadge(status: verificationStatus),
                  _PreviewChip(
                    icon: Icons.location_on_outlined,
                    label: locationSummary,
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _PreviewChip extends StatelessWidget {
  const _PreviewChip({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(maxWidth: 280),
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: context.supplierDecorations.badge(
        background: context.supplierColors.chipUnselected,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: context.supplierColors.accent),
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              label,
              style: context.supplierChip(),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}

class _PreviewIllustration extends StatelessWidget {
  const _PreviewIllustration();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 88,
      height: 56,
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
      decoration: BoxDecoration(
        color: context.supplierColors.accentSoft.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: context.supplierColors.border.withValues(alpha: 0.35)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          Icon(Icons.recycling, color: context.supplierColors.accent, size: 18),
          Icon(Icons.handyman_outlined, color: context.supplierColors.accentMuted, size: 16),
          Icon(Icons.inventory_2_outlined, color: context.supplierColors.textSecondary, size: 16),
        ],
      ),
    );
  }
}

