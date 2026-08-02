import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../l10n/l10n.dart';
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
    final l = context.l10n;
    final colors = context.supplierColors;
    final children = <Widget>[];

    if (showNoDriverOverdueWarning) {
      children.add(
        Text(
          canReportDriverNoShow && !canReportNoDriverAvailable
              ? l.supplierIncidentsDriverNotCompletedPickup
              : l.supplierIncidentsNoDriverBeforeWindow,
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
          l.supplierIncidentsNoDriverWaitHint,
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
          child: Text(l.supplierIncidentsReportNoDriver),
        ),
      );
    } else if (canMarkDeliveryPickupExpired &&
        onMarkDeliveryPickupExpired != null) {
      children.add(
        OutlinedButton(
          onPressed: onMarkDeliveryPickupExpired,
          style: AppStatusButtonStyle.outlined(context, AppStatusTone.danger),
          child: Text(l.supplierIncidentsReportNoDriver),
        ),
      );
    }

    if (canReportDriverNoShow && onReportDriverNoShow != null) {
      children.add(
        OutlinedButton(
          onPressed: onReportDriverNoShow,
          style: AppStatusButtonStyle.outlined(context, AppStatusTone.danger),
          child: Text(l.supplierIncidentsReportDriverNoShow),
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
