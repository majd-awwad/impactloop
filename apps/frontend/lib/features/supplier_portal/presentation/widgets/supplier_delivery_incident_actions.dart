import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../theme/supplier_theme_extension.dart';

class SupplierDeliveryIncidentActions extends StatelessWidget {
  const SupplierDeliveryIncidentActions({
    super.key,
    required this.canReportNoDriverAvailable,
    required this.canReportDriverNoShow,
    this.showNoDriverOverdueWarning = false,
    this.onReportNoDriverAvailable,
    this.onReportDriverNoShow,
    this.canMarkDeliveryPickupExpired = false,
    this.onMarkDeliveryPickupExpired,
    this.showMarkExpiredHint = false,
  });

  final bool canReportNoDriverAvailable;
  final bool canReportDriverNoShow;
  final bool showNoDriverOverdueWarning;
  final VoidCallback? onReportNoDriverAvailable;
  final VoidCallback? onReportDriverNoShow;

  /// Legacy mark-expired action; prefer [onReportNoDriverAvailable].
  final bool canMarkDeliveryPickupExpired;
  final VoidCallback? onMarkDeliveryPickupExpired;
  final bool showMarkExpiredHint;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    final children = <Widget>[];

    if (showNoDriverOverdueWarning) {
      children.add(
        Text(
          canReportDriverNoShow && !canReportNoDriverAvailable
              ? 'The assigned driver has not completed supplier pickup after '
                    'the window ended. Report driver no-show so an admin can review.'
              : 'No driver accepted this delivery before the supplier pickup window '
                    'ended. Report it so an admin can review next steps.',
          style: context.supplierBody().copyWith(
            fontSize: 12,
            color: colors.textSecondary,
            fontWeight: FontWeight.w600,
          ),
        ),
      );
    } else if (showMarkExpiredHint &&
        !canReportNoDriverAvailable &&
        !canMarkDeliveryPickupExpired &&
        !canReportDriverNoShow) {
      children.add(
        Text(
          'No driver yet. You can report no driver available 30 minutes '
          'after the scheduled pickup window ends.',
          style: context.supplierBody().copyWith(
            fontSize: 12,
            color: colors.textSecondary,
          ),
        ),
      );
    }

    if (canReportNoDriverAvailable && onReportNoDriverAvailable != null) {
      children.add(
        OutlinedButton(
          onPressed: onReportNoDriverAvailable,
          style: AppStatusButtonStyle.outlined(context, AppStatusTone.danger),
          child: const Text('Report no driver available'),
        ),
      );
    } else if (canMarkDeliveryPickupExpired &&
        onMarkDeliveryPickupExpired != null) {
      children.add(
        OutlinedButton(
          onPressed: onMarkDeliveryPickupExpired,
          style: AppStatusButtonStyle.outlined(context, AppStatusTone.danger),
          child: const Text('Report no driver available'),
        ),
      );
    }

    if (canReportDriverNoShow && onReportDriverNoShow != null) {
      children.add(
        OutlinedButton(
          onPressed: onReportDriverNoShow,
          style: AppStatusButtonStyle.outlined(context, AppStatusTone.danger),
          child: const Text('Report driver no-show'),
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
