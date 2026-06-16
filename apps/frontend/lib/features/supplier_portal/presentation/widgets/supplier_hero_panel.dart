import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_colors.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';
import '../../../../app/theme/supplier_decorations.dart';
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

  String _supplierTypeLabel(String value) {
    return switch (value.trim().toUpperCase()) {
      'INDIVIDUAL_SUPPLIER' || 'INDIVIDUAL SUPPLIER' => 'Individual supplier',
      'STUDENT_SUPPLIER' || 'STUDENT SUPPLIER' => 'Student supplier',
      'WORKSHOP' => 'Workshop',
      'FACTORY' => 'Factory',
      'EDUCATIONAL_INSTITUTION' ||
      'EDUCATIONAL INSTITUTION' => 'Educational institution',
      _ => value,
    };
  }

  @override
  Widget build(BuildContext context) {
    final organization = supplier.organization;

    return Container(
      width: double.infinity,
      padding: EdgeInsets.all(compact ? AppSpacing.md : AppSpacing.lg),
      decoration: SupplierDecorations.heroPanel,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Supplier Hub',
            style: AuthDarkTextStyles.display(
              context,
            ).copyWith(fontSize: compact ? 26 : 32),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Share unused parts, reduce waste, and help learners build faster.',
            style: AuthDarkTextStyles.subtitle(context),
          ),
          const SizedBox(height: AppSpacing.md),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              if (supplier.publicName.isNotEmpty)
                Text(
                  supplier.publicName,
                  style: AuthDarkTextStyles.title(
                    context,
                  ).copyWith(fontSize: 18),
                ),
              if (supplier.supplierType.isNotEmpty)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 4,
                  ),
                  decoration: SupplierDecorations.badge(
                    background: AuthDarkColors.chipUnselected,
                  ),
                  child: Text(
                    _supplierTypeLabel(supplier.supplierType),
                    style: AuthDarkTextStyles.chip(context),
                  ),
                ),
              SupplierVerificationBadge(status: supplier.verificationStatus),
              if (organization != null)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 4,
                  ),
                  decoration: SupplierDecorations.badge(
                    background: AuthDarkColors.chipSelected,
                  ),
                  child: Text(
                    organization.organizationName,
                    style: AuthDarkTextStyles.chip(context),
                  ),
                ),
            ],
          ),
          if (supplier.defaultLocation != null) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Pickup: ${supplier.defaultLocation!.city}'
              '${supplier.defaultLocation!.area != null ? ', ${supplier.defaultLocation!.area}' : ''}',
              style: AuthDarkTextStyles.body(context),
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
    final buttonPadding = EdgeInsets.symmetric(
      horizontal: compact ? AppSpacing.md : AppSpacing.lg,
      vertical: compact ? AppSpacing.sm : AppSpacing.md,
    );

    return [
      FilledButton.icon(
        onPressed: () => context.go('/supplier/materials/new'),
        style: FilledButton.styleFrom(
          backgroundColor: AuthDarkColors.accent,
          foregroundColor: AuthDarkColors.textOnAccent,
          shape: RoundedRectangleBorder(borderRadius: AppRadius.pillAll),
          padding: buttonPadding,
        ),
        icon: const Icon(Icons.add_rounded),
        label: const Text('Add Material'),
      ),
      OutlinedButton.icon(
        onPressed: () => context.go('/supplier/profile'),
        style: OutlinedButton.styleFrom(
          foregroundColor: AuthDarkColors.textPrimary,
          side: BorderSide(
            color: AuthDarkColors.borderFocused.withValues(alpha: 0.5),
          ),
          shape: RoundedRectangleBorder(borderRadius: AppRadius.pillAll),
          padding: buttonPadding,
        ),
        icon: const Icon(Icons.edit_outlined),
        label: const Text('Edit Profile'),
      ),
      TextButton.icon(
        onPressed: () => context.go('/supplier/materials'),
        style: TextButton.styleFrom(
          foregroundColor: AuthDarkColors.accent,
          padding: buttonPadding,
        ),
        icon: const Icon(Icons.inventory_2_outlined),
        label: const Text('View Materials'),
      ),
    ];
  }
}
