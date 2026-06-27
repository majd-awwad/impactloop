import 'package:flutter/material.dart';

import 'package:frontend/features/supplier_portal/presentation/theme/supplier_theme_extension.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../data/models/supplier_dashboard_pickup.dart';

class SupplierUpcomingPickupsSection extends StatelessWidget {
  const SupplierUpcomingPickupsSection({super.key, required this.pickups});

  final List<SupplierDashboardPickup> pickups;

  String _formatWindow(BuildContext context, SupplierDashboardPickup pickup) {
    if (pickup.pickupWindowStart == null) {
      return context.s.schedulePending;
    }

    final start = pickup.pickupWindowStart!;
    final end = pickup.pickupWindowEnd;

    final startLabel =
        '${start.day}/${start.month}/${start.year} ${start.hour.toString().padLeft(2, '0')}:${start.minute.toString().padLeft(2, '0')}';

    if (end == null) {
      return startLabel;
    }

    return '$startLabel – ${end.hour.toString().padLeft(2, '0')}:${end.minute.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          context.s.upcomingPickups,
          style: context.supplierSectionTitle(),
        ),
        const SizedBox(height: AppSpacing.md),
        if (pickups.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(AppSpacing.lg),
            decoration: context.supplierDecorations.dashboardCard,
            child: Row(
              children: [
                Icon(
                  Icons.local_shipping_outlined,
                  color: colors.accent,
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Text(
                    context.s.noAcceptedPickupsSubtitle,
                    style: context.supplierBody(),
                  ),
                ),
              ],
            ),
          )
        else
          ...pickups.map(
            (pickup) => Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: AppSpacing.sm),
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: context.supplierDecorations.dashboardCard,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    pickup.materialTitle,
                    style: context.supplierLabel().copyWith(
                      color: colors.textPrimary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    context.s.requesterLabel(pickup.requesterName),
                    style: context.supplierBody(),
                  ),
                  Text(
                    context.s.qtyLabel('${pickup.quantityRequested}'),
                    style: context.supplierBody(),
                  ),
                  Text(
                    _formatWindow(context, pickup),
                    style: context.supplierBody(),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}
