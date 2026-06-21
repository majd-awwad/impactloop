import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_colors.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';
import '../../../../app/theme/supplier_decorations.dart';
import 'supplier_location_privacy_card.dart';
import 'supplier_type_selector.dart';
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
  });

  final String publicName;
  final String supplierType;
  final String verificationStatus;
  final String? description;
  final String? city;
  final String? area;
  final String? country;
  final String? visibility;

  String get _locationSummary {
    final parts = [
      if (city != null && city!.trim().isNotEmpty) city!.trim(),
      if (area != null && area!.trim().isNotEmpty) area!.trim(),
      if (country != null && country!.trim().isNotEmpty) country!.trim(),
    ];
    return parts.isEmpty ? 'Pickup area not set' : parts.join(' · ');
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: SupplierDecorations.profileGlassCard,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.visibility_outlined,
                color: AuthDarkColors.accent,
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  'Learner preview',
                  style: AuthDarkTextStyles.sectionTitle(context),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            'How learners may discover your supplier profile later.',
            style: AuthDarkTextStyles.body(context),
          ),
          const SizedBox(height: AppSpacing.lg),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(AppSpacing.lg),
            decoration: SupplierDecorations.dashboardCard,
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
                            locationSummary: _locationSummary,
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
                            locationSummary: _locationSummary,
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
                      : 'Shares reusable materials for student and maker projects.',
                  style: AuthDarkTextStyles.body(context).copyWith(
                    color: AuthDarkColors.textPrimary.withValues(alpha: 0.9),
                  ),
                ),
                if (visibility != null && visibility!.isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    'Location visibility: ${visibilityLabel(visibility!)}',
                    style: AuthDarkTextStyles.body(
                      context,
                    ).copyWith(color: AuthDarkColors.accent, fontSize: 12),
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
          decoration: SupplierDecorations.avatarCircle,
          child: Text(
            publicName.isNotEmpty
                ? publicName.characters.first.toUpperCase()
                : '?',
            style: AuthDarkTextStyles.title(
              context,
            ).copyWith(color: AuthDarkColors.accent),
          ),
        ),
        const SizedBox(width: AppSpacing.md),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                publicName.isNotEmpty ? publicName : 'Your public name',
                style: AuthDarkTextStyles.title(context),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                supplierTypeLabel(supplierType),
                style: AuthDarkTextStyles.body(context),
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
      decoration: SupplierDecorations.badge(
        background: AuthDarkColors.chipUnselected,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: AuthDarkColors.accent),
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              label,
              style: AuthDarkTextStyles.chip(context),
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
        color: AuthDarkColors.accentSoft.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: AuthDarkColors.border.withValues(alpha: 0.35),
        ),
      ),
      child: const Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          Icon(Icons.recycling, color: AuthDarkColors.accent, size: 18),
          Icon(
            Icons.handyman_outlined,
            color: AuthDarkColors.accentMuted,
            size: 16,
          ),
          Icon(
            Icons.inventory_2_outlined,
            color: AuthDarkColors.textSecondary,
            size: 16,
          ),
        ],
      ),
    );
  }
}
