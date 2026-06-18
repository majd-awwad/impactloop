import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_colors.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';
import '../../data/models/supplier_pickup_schedule_item.dart';
import '../controllers/supplier_pickup_schedule_providers.dart';

class PickupScheduleDateSection extends StatelessWidget {
  const PickupScheduleDateSection({
    super.key,
    required this.group,
    required this.itemBuilder,
  });

  final PickupScheduleDateGroup group;
  final Widget Function(SupplierPickupScheduleItem item) itemBuilder;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: AppSpacing.sm),
          child: Text(
            group.label,
            style: AuthDarkTextStyles.label(context).copyWith(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: AuthDarkColors.textPrimary,
              letterSpacing: 0.2,
            ),
          ),
        ),
        ...group.items.map(
          (item) => Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.sm),
            child: itemBuilder(item),
          ),
        ),
      ],
    );
  }
}

class PickupScheduleSummaryRow extends StatelessWidget {
  const PickupScheduleSummaryRow({super.key, required this.summary});

  final PickupScheduleSummary summary;

  @override
  Widget build(BuildContext context) {
    return Text(
      'Today: ${summary.todayCount}   Upcoming: ${summary.upcomingCount}   Completed: ${summary.completedCount}',
      style: AuthDarkTextStyles.label(context).copyWith(
        fontSize: 13,
        color: AuthDarkColors.textMuted,
        fontWeight: FontWeight.w500,
      ),
    );
  }
}
