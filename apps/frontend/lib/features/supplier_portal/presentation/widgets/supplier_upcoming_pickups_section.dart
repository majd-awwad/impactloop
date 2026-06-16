import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_colors.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';
import '../../../../app/theme/supplier_decorations.dart';
import '../../data/models/supplier_dashboard_pickup.dart';

class SupplierUpcomingPickupsSection extends StatelessWidget {
  const SupplierUpcomingPickupsSection({super.key, required this.pickups});

  final List<SupplierDashboardPickup> pickups;

  String _formatWindow(SupplierDashboardPickup pickup) {
    if (pickup.pickupWindowStart == null) {
      return 'Schedule pending';
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
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Upcoming pickups',
          style: AuthDarkTextStyles.sectionTitle(context),
        ),
        const SizedBox(height: AppSpacing.md),
        if (pickups.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(AppSpacing.lg),
            decoration: SupplierDecorations.dashboardCard,
            child: Row(
              children: [
                const Icon(
                  Icons.local_shipping_outlined,
                  color: AuthDarkColors.accent,
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Text(
                    'Accepted reservations with pickup windows will show up here.',
                    style: AuthDarkTextStyles.body(context),
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
              decoration: SupplierDecorations.dashboardCard,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    pickup.materialTitle,
                    style: AuthDarkTextStyles.label(context).copyWith(
                      color: AuthDarkColors.textPrimary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Requester: ${pickup.requesterName}',
                    style: AuthDarkTextStyles.body(context),
                  ),
                  Text(
                    'Qty: ${pickup.quantityRequested}',
                    style: AuthDarkTextStyles.body(context),
                  ),
                  Text(
                    _formatWindow(pickup),
                    style: AuthDarkTextStyles.body(context),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}
