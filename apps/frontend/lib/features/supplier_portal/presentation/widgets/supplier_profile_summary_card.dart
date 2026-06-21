import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_colors.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';
import '../../../../app/theme/supplier_decorations.dart';
import '../../data/models/supplier_profile.dart';
import 'supplier_location_privacy_card.dart';
import 'supplier_type_selector.dart';
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
      decoration: SupplierDecorations.dashboardCard,
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
                decoration: SupplierDecorations.avatarCircle,
                child: Text(
                  (supplier?.publicName.isNotEmpty == true
                          ? supplier!.publicName
                          : profile.user.displayName)
                      .characters
                      .first
                      .toUpperCase(),
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
                      supplier?.publicName.isNotEmpty == true
                          ? supplier!.publicName
                          : profile.user.displayName,
                      style: AuthDarkTextStyles.title(context),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      profile.user.email,
                      style: AuthDarkTextStyles.body(context),
                    ),
                    if (supplier != null) ...[
                      const SizedBox(height: AppSpacing.sm),
                      Wrap(
                        spacing: AppSpacing.sm,
                        runSpacing: AppSpacing.sm,
                        children: [
                          if (supplier.supplierType.isNotEmpty)
                            _InfoChip(
                              label: supplierTypeLabel(supplier.supplierType),
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
                icon: const Icon(Icons.edit_outlined),
                label: const Text('Edit Profile'),
              ),
            ],
          ),
          if (supplier?.description?.isNotEmpty == true) ...[
            const SizedBox(height: AppSpacing.lg),
            Text(
              supplier!.description!,
              style: AuthDarkTextStyles.body(context),
            ),
          ],
          if (supplier?.defaultPickupLocation != null) ...[
            const SizedBox(height: AppSpacing.lg),
            _ProfileDetailRow(
              icon: Icons.location_on_outlined,
              title: 'Default pickup location',
              body:
                  '${supplier!.defaultPickupLocation!.country}, ${supplier.defaultPickupLocation!.summary}',
            ),
            const SizedBox(height: AppSpacing.sm),
            _ProfileDetailRow(
              icon: Icons.visibility_outlined,
              title: 'Visibility',
              body: visibilityLabel(
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
      decoration: SupplierDecorations.badge(
        background: AuthDarkColors.accentSoft.withValues(alpha: 0.16),
      ),
      child: Text(label, style: AuthDarkTextStyles.chip(context)),
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
        Icon(icon, color: AuthDarkColors.accent, size: 20),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: AuthDarkTextStyles.label(context).copyWith(
                  color: AuthDarkColors.textPrimary,
                  fontWeight: FontWeight.w700,
                ),
              ),
              Text(body, style: AuthDarkTextStyles.body(context)),
            ],
          ),
        ),
      ],
    );
  }
}
