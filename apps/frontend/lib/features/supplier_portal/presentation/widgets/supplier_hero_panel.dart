import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import 'package:frontend/features/supplier_portal/presentation/theme/supplier_theme_extension.dart';
import '../../data/models/supplier_dashboard.dart';
import 'supplier_verification_badge.dart';

class SupplierHeroPanel extends StatelessWidget {
  const SupplierHeroPanel({
    super.key,
    required this.supplier,
    required this.compact,
  });

  final SupplierDashboardProfile supplier;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    final decorations = context.supplierDecorations;
    final organization = supplier.organization;

    return Container(
      width: double.infinity,
      padding: EdgeInsets.all(compact ? AppSpacing.md : AppSpacing.lg),
      decoration: decorations.heroPanel,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            context.s.supplierHub,
            style: context.supplierDisplay().copyWith(
              fontSize: compact ? 26 : 32,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(context.s.heroTagline, style: context.supplierSubtitle()),
          const SizedBox(height: AppSpacing.md),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              if (supplier.publicName.isNotEmpty)
                Text(
                  supplier.publicName,
                  style: context.supplierTitle().copyWith(fontSize: 18),
                ),
              if (supplier.supplierType.isNotEmpty)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 4,
                  ),
                  decoration: decorations.badge(
                    background: colors.chipUnselected,
                  ),
                  child: Text(
                    context.s.supplierTypeLabel(supplier.supplierType),
                    style: context.supplierChip(),
                  ),
                ),
              SupplierVerificationBadge(status: supplier.verificationStatus),
              if (organization != null)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 4,
                  ),
                  decoration: decorations.badge(
                    background: colors.chipSelected,
                  ),
                  child: Text(
                    organization.organizationName,
                    style: context.supplierChip(),
                  ),
                ),
            ],
          ),
          if (supplier.defaultLocation != null) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              context.s.pickupLine(
                supplier.defaultLocation!.city,
                supplier.defaultLocation!.area,
              ),
              style: context.supplierBody(),
            ),
          ],
          const SizedBox(height: AppSpacing.lg),
          compact
              ? Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: _heroActions(context, compact: true)
                      .map(
                        (button) => Padding(
                          padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                          child: SizedBox(width: 220, child: button),
                        ),
                      )
                      .toList(),
                )
              : Wrap(
                  spacing: AppSpacing.sm,
                  runSpacing: AppSpacing.sm,
                  children: _heroActions(context),
                ),
        ],
      ),
    );
  }

  List<Widget> _heroActions(BuildContext context, {bool compact = false}) {
    final colors = context.supplierColors;
    final buttonPadding = EdgeInsets.symmetric(
      horizontal: compact ? AppSpacing.md : AppSpacing.lg,
      vertical: compact ? AppSpacing.sm : AppSpacing.md,
    );

    return [
      FilledButton.icon(
        onPressed: () => context.push('/supplier/materials/new'),
        style: FilledButton.styleFrom(
          backgroundColor: colors.accent,
          foregroundColor: colors.textOnAccent,
          shape: RoundedRectangleBorder(borderRadius: AppRadius.pillAll),
          padding: buttonPadding,
        ),
        icon: const Icon(Icons.add_rounded),
        label: Text(context.s.addMaterial),
      ),
      OutlinedButton.icon(
        onPressed: () => context.push('/supplier/profile'),
        style: OutlinedButton.styleFrom(
          foregroundColor: colors.textPrimary,
          side: BorderSide(color: colors.borderFocused.withValues(alpha: 0.5)),
          shape: RoundedRectangleBorder(borderRadius: AppRadius.pillAll),
          padding: buttonPadding,
        ),
        icon: const Icon(Icons.edit_outlined),
        label: Text(context.s.editProfile),
      ),
      TextButton.icon(
        onPressed: () => context.push('/supplier/materials'),
        style: TextButton.styleFrom(
          foregroundColor: colors.accent,
          padding: buttonPadding,
        ),
        icon: const Icon(Icons.inventory_2_outlined),
        label: Text(context.s.viewMaterials),
      ),
    ];
  }
}
