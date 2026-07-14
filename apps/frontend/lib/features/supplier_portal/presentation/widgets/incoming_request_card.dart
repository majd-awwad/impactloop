import 'package:flutter/material.dart';

import '../../../../app/theme/app_color_tokens.dart';
import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../core/config/api_config.dart';
import '../../../../shared/widgets/handover_confirmation_code_panel.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../data/models/supplier_incoming_request.dart';
import '../theme/supplier_theme_extension.dart';
import 'supplier_delivery_incident_actions.dart';
import 'incoming_request_status_style.dart';
import 'reservation_follow_up_actions.dart';

const _noteAreaHeight = 48.0;
const _footerHeight = 52.0;

String formatIncomingRequestDateTime(DateTime value) {
  final local = value.toLocal();
  final month = _monthLabel(local.month);
  final day = local.day.toString().padLeft(2, '0');
  final hour = local.hour.toString().padLeft(2, '0');
  final minute = local.minute.toString().padLeft(2, '0');
  return '$month $day, ${local.year} · $hour:$minute';
}

String formatPickupWindowShort(SupplierPickupWindow window) {
  final start = window.start.toLocal();
  final end = window.end.toLocal();
  final date = '${_monthLabel(start.month)} ${start.day}';
  final startTime =
      '${start.hour.toString().padLeft(2, '0')}:${start.minute.toString().padLeft(2, '0')}';
  final endTime =
      '${end.hour.toString().padLeft(2, '0')}:${end.minute.toString().padLeft(2, '0')}';
  return '$date, $startTime–$endTime';
}

String _monthLabel(int month) {
  const labels = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return labels[month - 1];
}

class IncomingRequestCard extends StatelessWidget {
  const IncomingRequestCard({
    super.key,
    required this.request,
    this.onAccept,
    this.onDecline,
    this.onMarkCompleted,
    this.onReschedule,
    this.onCloseReservation,
    this.onReportToAdmin,
    this.onAcceptLearnerReschedule,
    this.onProposeDifferentTime,
    this.onMarkDeliveryPickupExpired,
    this.onReportNoDriverAvailable,
    this.onReportDriverNoShow,
    this.onSubmitNoDriverPickupWindow,
    this.isCompleting = false,
  });

  final SupplierIncomingRequest request;
  final VoidCallback? onAccept;
  final VoidCallback? onDecline;
  final VoidCallback? onMarkCompleted;
  final VoidCallback? onReschedule;
  final VoidCallback? onCloseReservation;
  final VoidCallback? onReportToAdmin;
  final VoidCallback? onAcceptLearnerReschedule;
  final VoidCallback? onProposeDifferentTime;
  final VoidCallback? onMarkDeliveryPickupExpired;
  final VoidCallback? onReportNoDriverAvailable;
  final VoidCallback? onReportDriverNoShow;
  final VoidCallback? onSubmitNoDriverPickupWindow;
  final bool isCompleting;

  @override
  Widget build(BuildContext context) {
    final l = context.s;
    final colors = context.supplierColors;
    final isPending = request.status == SupplierIncomingRequestStatus.pending;
    final isDeclined = request.status == SupplierIncomingRequestStatus.declined;
    final isExpired = request.status == SupplierIncomingRequestStatus.expired;
    final isAccepted = request.status == SupplierIncomingRequestStatus.accepted;
    final isAwaiting =
        request.status == SupplierIncomingRequestStatus.awaitingConfirmation;
    final isAwaitingSupplier = request.status ==
        SupplierIncomingRequestStatus.awaitingSupplierConfirmation;
    final isCompleted =
        request.status == SupplierIncomingRequestStatus.completed;
    final compact =
        MediaQuery.sizeOf(context).width < AppSpacing.supplierLayoutBreakpoint;

    return Opacity(
      opacity: isDeclined || isExpired ? 0.78 : 1,
      child: Container(
        width: double.infinity,
        decoration: BoxDecoration(
          color: colors.surfaceSolid.withValues(alpha: 0.78),
          borderRadius: AppRadius.lgAll,
          border: Border.all(
            color: isPending
                ? colors.border.withValues(alpha: 0.42)
                : colors.border.withValues(alpha: 0.28),
          ),
        ),
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _MaterialThumbnail(
                  imageUrl: request.materialImageUrl,
                  size: compact ? 56 : 64,
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Text(
                              request.materialTitle,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: context.supplierTitle().copyWith(
                                fontSize: compact ? 16 : 17,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          if (isAccepted && request.isOverdue) ...[
                            _FollowUpBadge(label: l.overdueBadge),
                            const SizedBox(width: AppSpacing.xs),
                          ],
                          if (request.groupedDelivery) ...[
                            _FollowUpBadge(
                              label: request.combinedDeliveryLabel ??
                                  'Combined delivery',
                            ),
                            const SizedBox(width: AppSpacing.xs),
                          ],
                          _StatusBadge(
                            label: request.supplierActionStatusLabel,
                            status: request.status,
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        request.learnerName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: context.supplierBody().copyWith(
                          color: colors.textSecondary,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            _MetaRow(
              quantity:
                  '${_formatQuantity(request.quantityRequested)} ${request.unit}',
              requestedAt: formatIncomingRequestDateTime(request.requestedAt),
              pickupPreference: request.fulfillmentSummary,
            ),
            if (isPending) ...[
              const SizedBox(height: AppSpacing.sm),
              _FulfillmentDetails(request: request),
            ],
            const SizedBox(height: AppSpacing.sm),
            _LearnerNoteSlot(note: request.learnerNote),
            if (request.latestMessage != null)
              Padding(
                padding: const EdgeInsets.only(top: AppSpacing.xs),
                child: Text(
                  '${request.latestMessage!.sender.displayName}: ${request.latestMessage!.body}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: context.supplierBody().copyWith(
                    fontSize: 12,
                    color: colors.textSecondary,
                  ),
                ),
              ),
            if ((isAccepted || isCompleted) && request.pickupWindow != null)
              Padding(
                padding: const EdgeInsets.only(top: AppSpacing.sm),
                child: _PickupFooter(window: request.pickupWindow!),
              ),
            if (isAwaiting)
              Padding(
                padding: const EdgeInsets.only(top: AppSpacing.sm),
                child: _AwaitingConfirmationFooter(
                  message: request.schedulingConflictReason != null &&
                          request.schedulingConflictReason!.trim().isNotEmpty
                      ? l.awaitingSchedulingConflictConfirmation
                      : l.awaitingProposedTimeConfirmation,
                ),
              ),
            if (isAccepted &&
                request.hasDelivery &&
                !request.canSupplierComplete)
              Padding(
                padding: const EdgeInsets.only(top: AppSpacing.sm),
                child: _DeliveryFooter(
                  statusLabel: request.deliveryStatusLabel,
                  supplierHandoverCode: request.shouldShowSupplierHandoverCode
                      ? request.supplierHandoverCode
                      : null,
                  canReportNoDriverAvailable:
                      request.canReportNoDriverAvailable,
                  canMarkDeliveryPickupExpired:
                      request.canSupplierMarkDeliveryPickupExpired,
                  canReportDriverNoShow: request.canSupplierReportDriverNoShow,
                  showNoDriverOverdueWarning: request.showNoDriverOverdueWarning,
                  onReportNoDriverAvailable: onReportNoDriverAvailable,
                  onMarkDeliveryPickupExpired: onMarkDeliveryPickupExpired,
                  onReportDriverNoShow: onReportDriverNoShow,
                ),
              ),
            if (isAwaitingSupplier && request.canSubmitNoDriverPickupWindow)
              Padding(
                padding: const EdgeInsets.only(top: AppSpacing.sm),
                child: _NoDriverPickupRescheduleFooter(
                  onChoosePickupWindow: onSubmitNoDriverPickupWindow,
                ),
              ),
            if (isDeclined)
              Padding(
                padding: const EdgeInsets.only(top: AppSpacing.sm),
                child: _DeclineFooter(
                  reason: request.declineReason?.trim().isNotEmpty == true
                      ? request.declineReason!.trim()
                      : l.noDeclineReasonProvided,
                ),
              ),
            if (isExpired)
              Padding(
                padding: const EdgeInsets.only(top: AppSpacing.sm),
                child: _ExpiredFooter(message: l.expiredIncomingRequestMessage),
              ),
            if (isPending) ...[
              const SizedBox(height: AppSpacing.md),
              const Divider(
                height: 1,
                color: AppColorTokens.supplierDividerStrong,
              ),
              const SizedBox(height: AppSpacing.md),
              _ActionRow(
                onAccept: onAccept,
                onDecline: onDecline,
                stacked: compact,
              ),
            ],
            if ((isAccepted || isAwaitingSupplier) &&
                !request.isReadOnlyFinalState &&
                request.isPickupFulfillment &&
                (request.pickupHandoverPhase != null || isAwaitingSupplier)) ...[
              if (isAwaitingSupplier &&
                  (request.learnerProposedPickupWindow != null ||
                      request.pendingRescheduleReason?.trim().isNotEmpty ==
                          true ||
                      request.pendingRescheduleNote?.trim().isNotEmpty ==
                          true)) ...[
                const SizedBox(height: AppSpacing.sm),
                _LearnerRescheduleRequestSummary(request: request),
              ],
              const SizedBox(height: AppSpacing.md),
              ReservationFollowUpActions(
                pickupHandoverPhase: request.pickupHandoverPhase,
                canMarkCompleted: request.canSupplierComplete,
                canRequestReschedule: request.canSupplierReschedule,
                canCloseReservation: request.canSupplierCloseOverduePickup ||
                    request.canSupplierCloseAwaitingLearnerRequest,
                canReportToAdmin:
                    request.canSupplierReportAndCloseOverduePickup ||
                    request.canSupplierReportAwaitingLearnerRequest,
                hasAdminReport: request.noShowReport != null,
                canAcceptLearnerReschedule:
                    request.canSupplierAcceptLearnerReschedule,
                canProposeDifferentTime:
                    request.canSupplierProposeDifferentTime,
                canCloseAwaitingLearnerRequest:
                    request.canSupplierCloseAwaitingLearnerRequest,
                canReportAwaitingLearnerRequest:
                    request.canSupplierReportAwaitingLearnerRequest,
                isBusy: isCompleting,
                onMarkCompleted: onMarkCompleted,
                onRequestReschedule: onReschedule,
                onCloseReservation: onCloseReservation,
                onReportToAdmin: onReportToAdmin,
                onAcceptLearnerReschedule: onAcceptLearnerReschedule,
                onProposeDifferentTime: onProposeDifferentTime,
              ),
            ],
          ],
        ),
      ),
    );
  }

  String _formatQuantity(double value) {
    if (value % 1 == 0) {
      return value.toInt().toString();
    }
    return value.toString();
  }
}

class _MaterialThumbnail extends StatelessWidget {
  const _MaterialThumbnail({required this.size, this.imageUrl});

  final double size;
  final String? imageUrl;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    return ClipRRect(
      borderRadius: AppRadius.mdAll,
      child: Container(
        width: size,
        height: size,
        color: colors.backgroundElevated,
        child: imageUrl == null || imageUrl!.isEmpty
            ? Icon(
                Icons.inventory_2_outlined,
                color: colors.textSecondary,
                size: size * 0.38,
              )
            : Image.network(
                ApiConfig.resolveMediaUrl(imageUrl!),
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => Icon(
                  Icons.broken_image_outlined,
                  color: colors.textSecondary,
                  size: size * 0.38,
                ),
              ),
      ),
    );
  }
}

class _MetaRow extends StatelessWidget {
  const _MetaRow({
    required this.quantity,
    required this.requestedAt,
    required this.pickupPreference,
  });

  final String quantity;
  final String requestedAt;
  final String pickupPreference;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: AppSpacing.md,
      runSpacing: AppSpacing.xs,
      children: [
        _MetaItem(icon: Icons.straighten_outlined, label: quantity),
        _MetaItem(icon: Icons.schedule_outlined, label: requestedAt),
        _MetaItem(icon: Icons.place_outlined, label: pickupPreference),
      ],
    );
  }
}

class _MetaItem extends StatelessWidget {
  const _MetaItem({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 13, color: colors.textMuted),
        const SizedBox(width: 4),
        Text(
          label,
          style: context.supplierBody().copyWith(
            fontSize: 12,
            color: colors.textSecondary,
          ),
        ),
      ],
    );
  }
}

class _FulfillmentDetails extends StatelessWidget {
  const _FulfillmentDetails({required this.request});

  final SupplierIncomingRequest request;

  @override
  Widget build(BuildContext context) {
    final l = context.s;
    final colors = context.supplierColors;
    final windows = request.isDeliveryFulfillment
        ? request.learnerPreferredDeliveryWindows
        : request.learnerPreferredPickupWindows;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (windows.isNotEmpty) ...[
          Text(
            request.isDeliveryFulfillment
                ? l.learnerPreferredDeliveryWindows
                : l.learnerPreferredPickupWindows,
            style: context.supplierLabel().copyWith(fontSize: 12),
          ),
          const SizedBox(height: 4),
          ...windows.map(
            (window) => Padding(
              padding: const EdgeInsets.only(bottom: 2),
              child: Text(
                formatPickupWindowShort(
                  SupplierPickupWindow(start: window.start, end: window.end),
                ),
                style: context.supplierBody().copyWith(
                  fontSize: 12,
                  color: colors.textSecondary,
                ),
              ),
            ),
          ),
        ],
        if (request.isDeliveryFulfillment &&
            request.deliveryAddressText?.trim().isNotEmpty == true) ...[
          const SizedBox(height: AppSpacing.xs),
          Text(
            request.deliveryAddressText!.trim(),
            style: context.supplierBody().copyWith(
              fontSize: 12,
              color: colors.textSecondary,
            ),
          ),
        ],
        if (request.isDeliveryFulfillment) ...[
          const SizedBox(height: 4),
          Text(
            request.safeDropoffAllowed
                ? l.safeDropoffAllowed
                : l.safeDropoffNotAllowed,
            style: context.supplierBody().copyWith(
              fontSize: 12,
              color: colors.textSecondary,
            ),
          ),
        ],
        if (request.isDeliveryFulfillment &&
            request.reservationDeliveryNote?.trim().isNotEmpty == true) ...[
          const SizedBox(height: 4),
          Text(
            '${l.deliveryNoteLabel}: ${request.reservationDeliveryNote!.trim()}',
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: context.supplierBody().copyWith(
              fontSize: 12,
              color: colors.textSecondary,
            ),
          ),
        ],
      ],
    );
  }
}

class _NoDriverPickupRescheduleFooter extends StatelessWidget {
  const _NoDriverPickupRescheduleFooter({this.onChoosePickupWindow});

  final VoidCallback? onChoosePickupWindow;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.accentSoft.withValues(alpha: 0.16),
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: colors.border.withValues(alpha: 0.28)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.sm),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'No driver was available. Please choose a new pickup window if the material is still available.',
              style: context.supplierBody().copyWith(
                fontSize: 13,
                color: colors.textPrimary,
              ),
            ),
            if (onChoosePickupWindow != null) ...[
              const SizedBox(height: AppSpacing.sm),
              FilledButton(
                onPressed: onChoosePickupWindow,
                child: const Text('Choose new pickup window'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _AwaitingConfirmationFooter extends StatelessWidget {
  const _AwaitingConfirmationFooter({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.accentSoft.withValues(alpha: 0.16),
        borderRadius: AppRadius.mdAll,
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.sm),
        child: Text(
          message,
          style: context.supplierBody().copyWith(
            fontSize: 13,
            color: colors.textPrimary,
          ),
        ),
      ),
    );
  }
}

class _LearnerNoteSlot extends StatelessWidget {
  const _LearnerNoteSlot({this.note});

  final String? note;

  @override
  Widget build(BuildContext context) {
    final l = context.s;
    final colors = context.supplierColors;
    final hasNote = note != null && note!.trim().isNotEmpty;

    return SizedBox(
      height: _noteAreaHeight,
      width: double.infinity,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: colors.chipUnselected.withValues(alpha: 0.45),
          borderRadius: AppRadius.mdAll,
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.sm,
            vertical: AppSpacing.xs,
          ),
          child: Align(
            alignment: Alignment.centerLeft,
            child: Text(
              hasNote ? '"${note!.trim()}"' : l.noLearnerNote,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: context.supplierBody().copyWith(
                fontSize: 13,
                color: hasNote ? colors.textPrimary : colors.textMuted,
                fontStyle: hasNote ? FontStyle.italic : FontStyle.normal,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _LearnerRescheduleRequestSummary extends StatelessWidget {
  const _LearnerRescheduleRequestSummary({required this.request});

  final SupplierIncomingRequest request;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    final bodyStyle = context.supplierBody().copyWith(
      fontSize: 13,
      color: colors.textPrimary,
    );
    final labelStyle = bodyStyle.copyWith(fontWeight: FontWeight.w600);
    final window = request.learnerProposedPickupWindow;
    final reason = request.pendingRescheduleReason?.trim();
    final note = request.pendingRescheduleNote?.trim();

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: colors.accentSoft.withValues(alpha: 0.12),
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: colors.border.withValues(alpha: 0.28)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (window != null) ...[
            Text('Requested new pickup', style: labelStyle),
            const SizedBox(height: 4),
            Text(formatPickupWindowShort(window), style: bodyStyle),
          ],
          if (reason != null && reason.isNotEmpty) ...[
            if (window != null) const SizedBox(height: AppSpacing.sm),
            Text('Reason', style: labelStyle),
            const SizedBox(height: 4),
            Text(reason, style: bodyStyle),
          ],
          if (note != null && note.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            Text('Learner note', style: labelStyle),
            const SizedBox(height: 4),
            Text(note, style: bodyStyle.copyWith(fontStyle: FontStyle.italic)),
          ],
        ],
      ),
    );
  }
}

class _PickupFooter extends StatelessWidget {
  const _PickupFooter({required this.window});

  final SupplierPickupWindow window;

  @override
  Widget build(BuildContext context) {
    final l = context.s;
    final colors = context.supplierColors;
    return SizedBox(
      height: _footerHeight,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: colors.accentSoft.withValues(alpha: 0.16),
          borderRadius: AppRadius.mdAll,
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.sm,
            vertical: AppSpacing.xs,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                l.pickupWindowLabel(formatPickupWindowShort(window)),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: context.supplierLabel().copyWith(
                  color: colors.textPrimary,
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                ),
              ),
              if (window.note != null && window.note!.trim().isNotEmpty)
                Text(
                  window.note!.trim(),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: context.supplierBody().copyWith(
                    fontSize: 12,
                    color: colors.textSecondary,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DeclineFooter extends StatelessWidget {
  const _DeclineFooter({required this.reason});

  final String reason;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    return SizedBox(
      height: _footerHeight,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: colors.backgroundElevated.withValues(alpha: 0.45),
          borderRadius: AppRadius.mdAll,
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.sm,
            vertical: AppSpacing.xs,
          ),
          child: Align(
            alignment: Alignment.centerLeft,
            child: Text(
              reason,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: context.supplierBody().copyWith(
                fontSize: 12,
                color: colors.textSecondary,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _ExpiredFooter extends StatelessWidget {
  const _ExpiredFooter({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.backgroundElevated.withValues(alpha: 0.45),
        borderRadius: AppRadius.mdAll,
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.sm),
        child: Text(
          message,
          style: context.supplierBody().copyWith(
            fontSize: 12,
            color: colors.textSecondary,
          ),
        ),
      ),
    );
  }
}

class _DeliveryFooter extends StatelessWidget {
  const _DeliveryFooter({
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

  String get _title {
    if (statusLabel == 'Delivered') {
      return 'Delivered';
    }
    if (statusLabel == 'Driver not assigned in time') {
      return 'Driver not assigned in time';
    }
    return 'Waiting for driver delivery';
  }

  String get _subtitle {
    if (statusLabel == 'Driver not assigned in time') {
      return 'No driver accepted before the supplier pickup window ended.';
    }
    if (supplierHandoverCode == null) {
      return 'The driver will complete this reservation after delivery.';
    }
    return 'Give the handover code to the driver after handing over the material.';
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    final isOverdue = statusLabel == 'Driver not assigned in time';
    return DecoratedBox(
      decoration: BoxDecoration(
        color: (isOverdue ? colors.surfaceSolid : colors.accentSoft)
            .withValues(alpha: isOverdue ? 0.92 : 0.16),
        borderRadius: AppRadius.mdAll,
        border: Border.all(
          color: isOverdue
              ? colors.border.withValues(alpha: 0.5)
              : colors.border.withValues(alpha: 0.24),
        ),
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
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  isOverdue
                      ? Icons.warning_amber_outlined
                      : Icons.local_shipping_outlined,
                  size: 18,
                  color: isOverdue ? colors.textPrimary : colors.accent,
                ),
                const SizedBox(width: AppSpacing.xs),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _title,
                        style: context.supplierLabel().copyWith(
                          color: colors.textPrimary,
                          fontWeight: FontWeight.w700,
                          fontSize: 13,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        _subtitle,
                        style: context.supplierBody().copyWith(
                          color: colors.textSecondary,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            if (supplierHandoverCode != null) ...[
              const SizedBox(height: AppSpacing.sm),
              HandoverConfirmationCodePanel(
                code: supplierHandoverCode!,
                instructions:
                    'Supplier handover code for the driver at pickup:',
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

class _ActionRow extends StatelessWidget {
  const _ActionRow({
    required this.onAccept,
    required this.onDecline,
    required this.stacked,
  });

  final VoidCallback? onAccept;
  final VoidCallback? onDecline;
  final bool stacked;

  @override
  Widget build(BuildContext context) {
    if (stacked) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _AcceptButton(onPressed: onAccept),
          const SizedBox(height: AppSpacing.sm),
          _DeclineButton(onPressed: onDecline),
        ],
      );
    }

    return Row(
      children: [
        Expanded(child: _AcceptButton(onPressed: onAccept)),
        const SizedBox(width: AppSpacing.sm),
        Expanded(child: _DeclineButton(onPressed: onDecline)),
      ],
    );
  }
}

class _IncomingRequestActionButtonMetrics {
  static const iconSize = 18.0;
  static const padding = EdgeInsets.symmetric(horizontal: 16, vertical: 12);
  static const minimumSize = Size(64, 44);

  static ButtonStyle semanticStyle(
    BuildContext context,
    AppStatusTone tone,
  ) {
    return AppStatusButtonStyle.filled(
      context,
      tone,
      padding: padding,
    ).copyWith(
      minimumSize: const WidgetStatePropertyAll(minimumSize),
      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
      textStyle: const WidgetStatePropertyAll(
        TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
      ),
    );
  }
}

class _AcceptButton extends StatelessWidget {
  const _AcceptButton({required this.onPressed});

  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final l = context.s;
    return FilledButton.icon(
      onPressed: onPressed,
      style: _IncomingRequestActionButtonMetrics.semanticStyle(
        context,
        AppStatusTone.success,
      ),
      icon: const Icon(
        Icons.check_circle_outline,
        size: _IncomingRequestActionButtonMetrics.iconSize,
      ),
      label: Text(l.accept),
    );
  }
}

class _DeclineButton extends StatelessWidget {
  const _DeclineButton({required this.onPressed});

  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return FilledButton.icon(
      onPressed: onPressed,
      style: _IncomingRequestActionButtonMetrics.semanticStyle(
        context,
        AppStatusTone.danger,
      ),
      icon: const Icon(
        Icons.close,
        size: _IncomingRequestActionButtonMetrics.iconSize,
      ),
      label: Text(context.s.decline),
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
  const _StatusBadge({required this.label, required this.status});

  final String label;
  final SupplierIncomingRequestStatus status;

  @override
  Widget build(BuildContext context) {
    final style = IncomingRequestStatusStyle.forStatus(status).resolve(context);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: style.background,
        borderRadius: AppRadius.pillAll,
        border: Border.all(color: style.border),
      ),
      child: Text(
        label,
        style: context.supplierChip().copyWith(
          color: style.foreground,
          fontSize: 11,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
