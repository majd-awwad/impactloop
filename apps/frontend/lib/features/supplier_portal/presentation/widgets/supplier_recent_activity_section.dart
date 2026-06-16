import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_colors.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';
import '../../../../app/theme/supplier_decorations.dart';
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
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Recent activity',
          style: AuthDarkTextStyles.sectionTitle(context),
        ),
        const SizedBox(height: AppSpacing.md),
        if (activity.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(AppSpacing.lg),
            decoration: SupplierDecorations.dashboardCard,
            child: Row(
              children: [
                const Icon(Icons.bolt_outlined, color: AuthDarkColors.accent),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Text(
                    'Activity from reservations and notifications will collect here.',
                    style: AuthDarkTextStyles.body(context),
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
              decoration: SupplierDecorations.dashboardCard,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(
                    _iconFor(item.type),
                    color: AuthDarkColors.accent,
                    size: 20,
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item.title,
                          style: AuthDarkTextStyles.label(context).copyWith(
                            color: AuthDarkColors.textPrimary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          item.body,
                          style: AuthDarkTextStyles.body(context),
                        ),
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
