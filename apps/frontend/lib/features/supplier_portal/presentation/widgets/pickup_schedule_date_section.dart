import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import 'package:frontend/features/supplier_portal/presentation/theme/supplier_theme_extension.dart';
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
    final colors = context.supplierColors;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: AppSpacing.sm),
          child: Text(
            group.label,
            style: context.supplierLabel().copyWith(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: colors.textPrimary,
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
    final colors = context.supplierColors;

    return Text(
      context.s.pickupScheduleSummary(
        summary.todayCount,
        summary.upcomingCount,
        summary.completedCount,
      ),
      style: context.supplierLabel().copyWith(
        fontSize: 13,
        color: colors.textMuted,
        fontWeight: FontWeight.w500,
      ),
    );
  }
}
