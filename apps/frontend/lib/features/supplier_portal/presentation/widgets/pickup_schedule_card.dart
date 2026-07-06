import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../core/config/api_config.dart';
import '../../../../shared/widgets/handover_confirmation_code_panel.dart';
import '../../data/models/supplier_pickup_schedule_item.dart';
import '../../data/pickup_schedule_grouping.dart';
import '../theme/supplier_theme_extension.dart';
import 'pickup_schedule_status_style.dart';
import 'reservation_follow_up_actions.dart';
import 'supplier_delivery_incident_actions.dart';

class PickupScheduleCard extends StatelessWidget {
  const PickupScheduleCard({
    super.key,
    required this.item,
    required this.groupKind,
    this.onViewDetails,
    this.onMarkCompleted,
    this.onReschedule,
    this.onCloseReservation,
    this.onReportToAdmin,
    this.onMarkDeliveryPickupExpired,
    this.onReportNoDriverAvailable,
    this.onReportDriverNoShow,
    this.isCompleting = false,
  });

  final SupplierPickupScheduleItem item;
  final PickupScheduleGroupKind groupKind;
  final VoidCallback? onViewDetails;
  final VoidCallback? onMarkCompleted;
  final VoidCallback? onReschedule;
  final VoidCallback? onCloseReservation;
  final VoidCallback? onReportToAdmin;
  final VoidCallback? onMarkDeliveryPickupExpired;
  final VoidCallback? onReportNoDriverAvailable;
  final VoidCallback? onReportDriverNoShow;
  final bool isCompleting;

  @override
  Widget build(BuildContext context) {
    final l = context.s;
    final colors = context.supplierColors;
    final style = PickupScheduleStatusStyle.forItem(item, groupKind);
    final compact =
        MediaQuery.sizeOf(context).width < AppSpacing.supplierLayoutBreakpoint;
    final windowLabel = item.pickupWindow != null
        ? formatPickupScheduleCardWindow(item.pickupWindow!)
        : item.isCompleted
        ? l.scheduleDone
        : '—';
    final note = _displayNote(item);
    final showFollowUp =
        !item.isCompleted &&
        item.status == SupplierPickupScheduleStatus.accepted &&
        item.pickupHandoverPhase != null;
    final showDeliveryStatus =
        item.status == SupplierPickupScheduleStatus.accepted &&
        item.hasDelivery &&
        !item.canSupplierComplete;

    return Material(
      color: Colors.transparent,
      child: Container(
        padding: EdgeInsets.symmetric(
          horizontal: compact ? AppSpacing.sm : AppSpacing.md,
          vertical: compact ? AppSpacing.sm : AppSpacing.md,
        ),
        decoration: BoxDecoration(
          color: colors.surfaceSolid.withValues(alpha: 0.55),
          borderRadius: AppRadius.mdAll,
          border: Border.all(color: colors.border.withValues(alpha: 0.22)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            InkWell(
              onTap: onViewDetails,
              borderRadius: AppRadius.mdAll,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: compact ? 92 : 108,
                    child: Text(
                      windowLabel,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: context.supplierTitle().copyWith(
                        fontSize: compact ? 13 : 14,
                        fontWeight: FontWeight.w700,
                        color: style.foreground,
                        height: 1.25,
                      ),
                    ),
                  ),
                  Container(
                    width: 1,
                    height: compact ? 48 : 52,
                    margin: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.sm,
                    ),
                    color: colors.border.withValues(alpha: 0.28),
                  ),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: Text(
                                item.materialTitle,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: context.supplierTitle().copyWith(
                                  fontSize: compact ? 15 : 16,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                            const SizedBox(width: AppSpacing.xs),
                            if (item.isOverdue) ...[
                              _FollowUpBadge(label: l.overdueBadge),
                              const SizedBox(width: AppSpacing.xs),
                            ],
                            _StatusBadge(status: item.status, style: style),
                          ],
                        ),
                        const SizedBox(height: 3),
                        Text(
                          '${item.learnerName} · ${item.quantityLabel} · ${item.pickupType}',
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: context.supplierBody().copyWith(
                            fontSize: 13,
                            color: colors.textMuted,
                            height: 1.3,
                          ),
                        ),
                        if (note != null) ...[
                          const SizedBox(height: 4),
                          Text(
                            note,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: context.supplierBody().copyWith(
                              fontSize: 12,
                              color: colors.textPrimary.withValues(alpha: 0.78),
                              height: 1.3,
                            ),
                          ),
                        ],
                        if (item.latestMessage != null) ...[
                          const SizedBox(height: 4),
                          Text(
                            '${item.latestMessage!.sender.displayName}: ${item.latestMessage!.body}',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: context.supplierBody().copyWith(
                              fontSize: 12,
                              color: colors.textSecondary,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  _MaterialThumbnail(
                    imageUrl: item.materialImageUrl,
                    size: compact ? 40 : 48,
                  ),
                ],
              ),
            ),
            if (showDeliveryStatus) ...[
              const SizedBox(height: AppSpacing.sm),
              _DeliveryStatusPanel(
                statusLabel: item.deliveryStatusLabel,
                supplierHandoverCode: item.shouldShowSupplierHandoverCode
                    ? item.supplierHandoverCode
                    : null,
                canReportNoDriverAvailable: item.canReportNoDriverAvailable,
                canMarkDeliveryPickupExpired:
                    item.canSupplierMarkDeliveryPickupExpired,
                canReportDriverNoShow: item.canSupplierReportDriverNoShow,
                showNoDriverOverdueWarning: item.showNoDriverOverdueWarning,
                onReportNoDriverAvailable: onReportNoDriverAvailable,
                onMarkDeliveryPickupExpired: onMarkDeliveryPickupExpired,
                onReportDriverNoShow: onReportDriverNoShow,
              ),
            ],
            if (showFollowUp) ...[
              const SizedBox(height: AppSpacing.sm),
              ReservationFollowUpActions(
                pickupHandoverPhase: item.pickupHandoverPhase,
                canMarkCompleted: item.canSupplierComplete,
                canRequestReschedule: item.canSupplierReschedule,
                canCloseReservation: item.canSupplierCloseOverduePickup,
                canReportToAdmin: item.canSupplierReportAndCloseOverduePickup,
                hasAdminReport: item.noShowReport != null,
                isBusy: isCompleting,
                onMarkCompleted: onMarkCompleted,
                onRequestReschedule: onReschedule,
                onCloseReservation: onCloseReservation,
                onReportToAdmin: onReportToAdmin,
              ),
            ],
          ],
        ),
      ),
    );
  }

  String? _displayNote(SupplierPickupScheduleItem item) {
    final supplierNote = item.supplierNote?.trim();
    if (supplierNote != null && supplierNote.isNotEmpty) {
      return supplierNote;
    }
    final learnerMessage = item.learnerMessage?.trim();
    if (learnerMessage != null && learnerMessage.isNotEmpty) {
      return learnerMessage;
    }
    return null;
  }
}

class _DeliveryStatusPanel extends StatelessWidget {
  const _DeliveryStatusPanel({
    required this.statusLabel,
    this.supplierHandoverCode,
    this.canReportNoDriverAvailable = false,
    this.canMarkDeliveryPickupExpired = false,
    this.canReportDriverNoShow = false,
    this.showNoDriverOverdueWarning = false,
    this.onReportNoDriverAvailable,
    this.onMarkDeliveryPickupExpired,
    this.onReportDriverNoShow,
  });

  final String statusLabel;
  final String? supplierHandoverCode;
  final bool canReportNoDriverAvailable;
  final bool canMarkDeliveryPickupExpired;
  final bool canReportDriverNoShow;
  final bool showNoDriverOverdueWarning;
  final VoidCallback? onReportNoDriverAvailable;
  final VoidCallback? onMarkDeliveryPickupExpired;
  final VoidCallback? onReportDriverNoShow;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.accentSoft.withValues(alpha: 0.16),
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: colors.border.withValues(alpha: 0.24)),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.sm,
          vertical: AppSpacing.sm,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  Icons.local_shipping_outlined,
                  size: 18,
                  color: colors.accent,
                ),
                const SizedBox(width: AppSpacing.xs),
                Expanded(
                  child: Text(
                    statusLabel,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: context.supplierLabel().copyWith(
                      color: colors.textPrimary,
                      fontWeight: FontWeight.w600,
                      fontSize: 13,
                    ),
                  ),
                ),
              ],
            ),
            if (supplierHandoverCode != null) ...[
              const SizedBox(height: AppSpacing.sm),
              HandoverConfirmationCodePanel(
                code: supplierHandoverCode!,
                instructions:
                    'Give this code to the driver after handing over the material.',
              ),
            ],
            SupplierDeliveryIncidentActions(
              canReportNoDriverAvailable: canReportNoDriverAvailable,
              canMarkDeliveryPickupExpired: canMarkDeliveryPickupExpired,
              canReportDriverNoShow: canReportDriverNoShow,
              showNoDriverOverdueWarning: showNoDriverOverdueWarning,
              onReportNoDriverAvailable: onReportNoDriverAvailable,
              onMarkDeliveryPickupExpired: onMarkDeliveryPickupExpired,
              onReportDriverNoShow: onReportDriverNoShow,
            ),
          ],
        ),
      ),
    );
  }
}

class _FollowUpBadge extends StatelessWidget {
  const _FollowUpBadge({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
        color: colors.amberAccent.withValues(alpha: 0.18),
        borderRadius: AppRadius.pillAll,
        border: Border.all(color: colors.amberAccent.withValues(alpha: 0.45)),
      ),
      child: Text(
        label,
        style: context.supplierChip().copyWith(
          fontSize: 10,
          color: colors.textPrimary,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.status, required this.style});

  final SupplierPickupScheduleStatus status;
  final PickupScheduleStatusStyle style;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
        color: style.background,
        borderRadius: AppRadius.pillAll,
        border: Border.all(color: style.border.withValues(alpha: 0.7)),
      ),
      child: Text(
        context.s.pickupScheduleStatusLabel(status),
        style: context.supplierChip().copyWith(
          fontSize: 10,
          color: style.foreground,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class _MaterialThumbnail extends StatelessWidget {
  const _MaterialThumbnail({required this.imageUrl, required this.size});

  final String? imageUrl;
  final double size;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    return ClipRRect(
      borderRadius: AppRadius.smAll,
      child: Container(
        width: size,
        height: size,
        color: colors.surfaceSolid,
        child: imageUrl != null && imageUrl!.isNotEmpty
            ? Image.network(
                ApiConfig.resolveMediaUrl(imageUrl!),
                width: size,
                height: size,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => _placeholder(size, context),
              )
            : _placeholder(size, context),
      ),
    );
  }

  Widget _placeholder(double size, BuildContext context) {
    final colors = context.supplierColors;
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      color: colors.accentSoft.withValues(alpha: 0.1),
      child: Icon(
        Icons.inventory_2_outlined,
        size: size * 0.45,
        color: colors.textMuted,
      ),
    );
  }
}
