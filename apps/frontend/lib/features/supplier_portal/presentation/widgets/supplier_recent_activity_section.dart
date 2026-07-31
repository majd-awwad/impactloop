import 'package:flutter/material.dart';

import 'package:frontend/features/supplier_portal/presentation/theme/supplier_theme_extension.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../data/models/supplier_dashboard_activity.dart';

class SupplierRecentActivitySection extends StatelessWidget {
  const SupplierRecentActivitySection({super.key, required this.activity});

  final List<SupplierDashboardActivity> activity;

  IconData _iconFor(String type) {
    switch (type.toUpperCase()) {
      case 'NOTIFICATION':
        return Icons.notifications_none_rounded;
      case 'RESERVATION':
        return Icons.event_note_outlined;
      default:
        return Icons.history_rounded;
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(context.s.recentActivity, style: context.supplierSectionTitle()),
        const SizedBox(height: AppSpacing.md),
        if (activity.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(AppSpacing.lg),
            decoration: context.supplierDecorations.dashboardCard,
            child: Row(
              children: [
                Icon(Icons.bolt_outlined, color: colors.accent),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Text(
                    context.s.noRecentActivity,
                    style: context.supplierBody(),
                  ),
                ),
              ],
            ),
          )
        else
          ...activity.map(
            (item) => Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: AppSpacing.sm),
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: context.supplierDecorations.dashboardCard,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(_iconFor(item.type), color: colors.accent, size: 20),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item.title,
                          style: context.supplierLabel().copyWith(
                            color: colors.textPrimary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(item.body, style: context.supplierBody()),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}
