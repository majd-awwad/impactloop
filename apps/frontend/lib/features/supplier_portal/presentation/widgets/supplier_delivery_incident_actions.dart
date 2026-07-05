import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../theme/supplier_theme_extension.dart';

class SupplierDeliveryIncidentActions extends StatelessWidget {
  const SupplierDeliveryIncidentActions({
    super.key,
    required this.canMarkDeliveryPickupExpired,
    required this.canReportDriverNoShow,
    this.showMarkExpiredHint = false,
    this.onMarkDeliveryPickupExpired,
    this.onReportDriverNoShow,
  });

  final bool canMarkDeliveryPickupExpired;
  final bool canReportDriverNoShow;
  final bool showMarkExpiredHint;
  final VoidCallback? onMarkDeliveryPickupExpired;
  final VoidCallback? onReportDriverNoShow;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    final children = <Widget>[];

    if (canMarkDeliveryPickupExpired && onMarkDeliveryPickupExpired != null) {
      children.add(
        OutlinedButton(
          onPressed: onMarkDeliveryPickupExpired,
          child: const Text('Mark pickup window expired'),
        ),
      );
    }

    if (canReportDriverNoShow && onReportDriverNoShow != null) {
      children.add(
        OutlinedButton(
          onPressed: onReportDriverNoShow,
          child: const Text('Report driver no-show'),
        ),
      );
    }

    if (showMarkExpiredHint &&
        !canMarkDeliveryPickupExpired &&
        !canReportDriverNoShow) {
      children.add(
        Text(
          'No driver yet. You can mark the pickup window expired 30 minutes '
          'after the scheduled pickup window ends.',
          style: context.supplierBody().copyWith(
            fontSize: 12,
            color: colors.textSecondary,
          ),
        ),
      );
    }

    if (children.isEmpty) {
      return const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: AppSpacing.sm),
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: children,
        ),
      ],
    );
  }
}
