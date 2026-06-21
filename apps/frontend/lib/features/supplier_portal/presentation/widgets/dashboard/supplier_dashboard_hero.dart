import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../../app/theme/app_radius.dart';
import '../../../../../app/theme/app_spacing.dart';
import '../../../data/models/supplier_dashboard.dart';
import '../../theme/supplier_theme_extension.dart';

class SupplierDashboardHero extends StatelessWidget {
  const SupplierDashboardHero({
    super.key,
    required this.supplier,
    required this.compact,
  });

  final SupplierDashboardProfile supplier;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    final name = supplier.publicName.trim().isNotEmpty
        ? supplier.publicName.trim()
        : context.s.supplierFallbackName;

    return Container(
      width: double.infinity,
      padding: EdgeInsets.all(compact ? AppSpacing.md : AppSpacing.lg),
      decoration: context.supplierDecorations.heroPanel,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            context.s.dashboardWelcomeName(name),
            style: context.supplierTitle().copyWith(
              fontSize: compact ? 22 : 26,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            context.s.dashboardHeroSubtitle,
            style: context.supplierBody().copyWith(
              color: colors.textSecondary,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              _HeroChip(
                label: context.s.heroChipSupplierActive,
                icon: Icons.verified_outlined,
              ),
              _HeroChip(
                label: context.s.heroChipPickupEnabled,
                icon: Icons.local_shipping_outlined,
              ),
              _HeroChip(
                label: context.s.heroChipNisListings,
                icon: Icons.payments_outlined,
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              FilledButton.icon(
                onPressed: () => context.go('/supplier/materials/new'),
                style: FilledButton.styleFrom(
                  backgroundColor: colors.accent,
                  foregroundColor: colors.textOnAccent,
                  shape: RoundedRectangleBorder(
                    borderRadius: AppRadius.pillAll,
                  ),
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.lg,
                    vertical: AppSpacing.sm,
                  ),
                ),
                icon: const Icon(Icons.add_rounded, size: 18),
                label: Text(context.s.addMaterial),
              ),
              OutlinedButton.icon(
                onPressed: () => context.go('/supplier/reservations'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: colors.textPrimary,
                  side: BorderSide(
                    color: colors.borderFocused.withValues(alpha: 0.55),
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: AppRadius.pillAll,
                  ),
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.lg,
                    vertical: AppSpacing.sm,
                  ),
                ),
                icon: const Icon(Icons.inbox_outlined, size: 18),
                label: Text(context.s.viewRequests),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _HeroChip extends StatelessWidget {
  const _HeroChip({required this.label, required this.icon});

  final String label;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: context.supplierDecorations.badge(
        background: colors.chipUnselected.withValues(alpha: 0.85),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: colors.accent),
          const SizedBox(width: 6),
          Text(label, style: context.supplierChip()),
        ],
      ),
    );
  }
}
