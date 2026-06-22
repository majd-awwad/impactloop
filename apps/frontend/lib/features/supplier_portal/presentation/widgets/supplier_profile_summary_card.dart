import 'package:flutter/material.dart';

import 'package:frontend/features/supplier_portal/presentation/theme/supplier_theme_extension.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../data/models/supplier_profile.dart';
import 'supplier_verification_badge.dart';

class SupplierProfileSummaryCard extends StatelessWidget {
  const SupplierProfileSummaryCard({
    super.key,
    required this.profile,
    required this.onEdit,
  });

  final SupplierProfileResponse profile;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    final supplier = profile.supplier;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: context.supplierDecorations.dashboardCard,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 52,
                height: 52,
                alignment: Alignment.center,
                decoration: context.supplierDecorations.avatarCircle,
                child: Text(
                  (supplier?.publicName.isNotEmpty == true
                          ? supplier!.publicName
                          : profile.user.displayName)
                      .characters
                      .first
                      .toUpperCase(),
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
                      supplier?.publicName.isNotEmpty == true
                          ? supplier!.publicName
                          : profile.user.displayName,
                      style: context.supplierTitle(),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(profile.user.email, style: context.supplierBody()),
                    if (supplier != null) ...[
                      const SizedBox(height: AppSpacing.sm),
                      Wrap(
                        spacing: AppSpacing.sm,
                        runSpacing: AppSpacing.sm,
                        children: [
                          if (supplier.supplierType.isNotEmpty)
                            _InfoChip(
                              label: context.s.supplierTypeLabel(
                                supplier.supplierType,
                              ),
                            ),
                          SupplierVerificationBadge(
                            status: supplier.verificationStatus,
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
              OutlinedButton.icon(
                onPressed: onEdit,
                icon: Icon(Icons.edit_outlined),
                label: Text(context.s.editProfile),
              ),
            ],
          ),
          if (supplier?.description?.isNotEmpty == true) ...[
            const SizedBox(height: AppSpacing.lg),
            Text(supplier!.description!, style: context.supplierBody()),
          ],
          if (supplier?.defaultPickupLocation != null) ...[
            const SizedBox(height: AppSpacing.lg),
            _ProfileDetailRow(
              icon: Icons.location_on_outlined,
              title: context.s.defaultPickupLocation,
              body:
                  '${supplier!.defaultPickupLocation!.country}, ${supplier.defaultPickupLocation!.summary}',
            ),
            const SizedBox(height: AppSpacing.sm),
            _ProfileDetailRow(
              icon: Icons.visibility_outlined,
              title: context.s.visibility,
              body: context.s.visibilityLabel(
                supplier.defaultPickupLocation!.visibility ?? 'ORDER_ONLY',
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _InfoChip extends StatelessWidget {
  const _InfoChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: context.supplierDecorations.badge(
        background: context.supplierColors.accentSoft.withValues(alpha: 0.16),
      ),
      child: Text(label, style: context.supplierChip()),
    );
  }
}

class _ProfileDetailRow extends StatelessWidget {
  const _ProfileDetailRow({
    required this.icon,
    required this.title,
    required this.body,
  });

  final IconData icon;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, color: context.supplierColors.accent, size: 20),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: context.supplierLabel().copyWith(
                  color: context.supplierColors.textPrimary,
                  fontWeight: FontWeight.w700,
                ),
              ),
              Text(body, style: context.supplierBody()),
            ],
          ),
        ),
      ],
    );
  }
}
