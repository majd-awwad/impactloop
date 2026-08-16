import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../core/format/localized_formatters.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../data/models/learner_reservation.dart';
import '../../data/models/reservation_payment_summary.dart';
import 'reservation_detail_semantic.dart';

class ReservationDetailTimelineEntry {
  const ReservationDetailTimelineEntry({
    required this.label,
    this.timestamp,
    required this.semantic,
    required this.isActive,
  });

  final String label;
  final DateTime? timestamp;
  final ReservationDetailSemantic semantic;
  final bool isActive;
}

List<ReservationDetailTimelineEntry> buildReservationDetailTimeline(
  LearnerReservation reservation, {
  required AppLocalizations l10n,
}) {
  final entries = <ReservationDetailTimelineEntry>[];
  final summary = reservation.paymentSummary;

  entries.add(
    ReservationDetailTimelineEntry(
      label: l10n.reservationDetailTimelineCreated,
      timestamp: reservation.createdAt,
      semantic: ReservationDetailSemantic.neutral,
      isActive: reservation.isPending,
    ),
  );

  if (reservation.isPending || reservation.isAwaitingSupplierConfirmation) {
    entries.add(
      ReservationDetailTimelineEntry(
        label: l10n.reservationDetailTimelinePending,
        semantic: ReservationDetailSemantic.waiting,
        isActive: true,
      ),
    );
  }

  if (reservation.isAwaitingConfirmation) {
    entries.add(
      ReservationDetailTimelineEntry(
        label: l10n.reservationDetailTimelineAwaitingConfirmation,
        semantic: ReservationDetailSemantic.waiting,
        isActive: true,
      ),
    );
  }

  if (summary != null &&
      !summary.isPaymentsDisabled &&
      (summary.isPaymentActionRequired || summary.canStartCheckout)) {
    entries.add(
      ReservationDetailTimelineEntry(
        label: l10n.reservationDetailTimelinePaymentRequired,
        semantic: ReservationDetailSemantic.payment,
        isActive: true,
      ),
    );
  }

  if (summary != null && !summary.isPaymentsDisabled && summary.isPaid) {
    entries.add(
      ReservationDetailTimelineEntry(
        label: l10n.reservationDetailTimelinePaymentCompleted,
        semantic: ReservationDetailSemantic.success,
        isActive: false,
      ),
    );
  }

  if (summary != null && !summary.isPaymentsDisabled && summary.isProcessing) {
    entries.add(
      ReservationDetailTimelineEntry(
        label: l10n.paymentStatusProcessing,
        semantic: ReservationDetailSemantic.waiting,
        isActive: true,
      ),
    );
  }

  if (reservation.isAwaitingResolution) {
    entries.add(
      ReservationDetailTimelineEntry(
        label: l10n.reservationDetailTimelineUnderReview,
        semantic: ReservationDetailSemantic.resolution,
        isActive: true,
      ),
    );
  }

  if (reservation.isAccepted && _canShowFulfillmentReady(summary)) {
    entries.add(
      ReservationDetailTimelineEntry(
        label: reservation.isPickupFulfillment
            ? l10n.reservationDetailTimelineReadyPickup
            : l10n.reservationDetailTimelineReadyDelivery,
        timestamp: reservation.pickupWindowStart,
        semantic: reservation.isPickupFulfillment
            ? ReservationDetailSemantic.pickup
            : ReservationDetailSemantic.delivery,
        isActive: !reservation.isCompleted,
      ),
    );
  }

  if (summary != null && summary.isRefundPending) {
    entries.add(
      ReservationDetailTimelineEntry(
        label: l10n.paymentStatusRefundPending,
        semantic: ReservationDetailSemantic.waiting,
        isActive: true,
      ),
    );
  }

  if (summary != null && summary.isRefunded) {
    entries.add(
      ReservationDetailTimelineEntry(
        label: l10n.reservationDetailTimelineRefunded,
        semantic: ReservationDetailSemantic.neutral,
        isActive: false,
      ),
    );
  }

  if (reservation.isCancelled ||
      reservation.isRejected ||
      reservation.isExpired) {
    entries.add(
      ReservationDetailTimelineEntry(
        label: l10n.reservationDetailTimelineCancelled,
        timestamp: reservation.updatedAt,
        semantic: ReservationDetailSemantic.neutral,
        isActive: false,
      ),
    );
  }

  if (reservation.isCompleted) {
    entries.add(
      ReservationDetailTimelineEntry(
        label: l10n.reservationDetailTimelineCompleted,
        timestamp: reservation.updatedAt,
        semantic: ReservationDetailSemantic.success,
        isActive: false,
      ),
    );
  }

  return entries;
}

/// Ready-for-pickup/delivery is only truthful once payment no longer blocks
/// fulfillment. Unpaid accepted reservations stay on the payment step.
bool _canShowFulfillmentReady(ReservationPaymentSummary? summary) {
  if (summary == null || summary.isPaymentsDisabled) {
    return true;
  }
  if (summary.fulfillmentReady) {
    return true;
  }
  if (summary.isPaymentActionRequired || summary.canStartCheckout) {
    return false;
  }
  if (summary.isProcessing ||
      summary.isRefundPending ||
      summary.isResolutionRequired) {
    return false;
  }
  return summary.isPaid || summary.overallStatus == 'NOT_REQUIRED';
}

class ReservationDetailTimeline extends StatefulWidget {
  const ReservationDetailTimeline({
    super.key,
    required this.reservation,
    this.previewLimit = 4,
    this.compact = false,
  });

  final LearnerReservation reservation;
  final int previewLimit;
  final bool compact;

  @override
  State<ReservationDetailTimeline> createState() =>
      _ReservationDetailTimelineState();
}

class _ReservationDetailTimelineState extends State<ReservationDetailTimeline> {
  var _expanded = false;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final entries = buildReservationDetailTimeline(
      widget.reservation,
      l10n: l10n,
    );

    if (entries.isEmpty) {
      return const SizedBox.shrink();
    }

    final visible = _expanded || entries.length <= widget.previewLimit
        ? entries
        : entries.sublist(entries.length - widget.previewLimit);

    return ReservationDetailSurfaceCard(
      semantic: ReservationDetailSemantic.neutral,
      title: l10n.paymentHistoryTitle,
      titleIcon: Icons.timeline_rounded,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ...visible.asMap().entries.map(
            (entry) => _TimelineRow(
              entry: entry.value,
              isLast: entry.key == visible.length - 1,
              compact: widget.compact,
            ),
          ),
          if (entries.length > widget.previewLimit) ...[
            const SizedBox(height: AppSpacing.sm),
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: TextButton(
                onPressed: () => setState(() => _expanded = !_expanded),
                child: Text(
                  _expanded ? l10n.showLessHistory : l10n.showFullHistory,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _TimelineRow extends StatelessWidget {
  const _TimelineRow({
    required this.entry,
    required this.isLast,
    required this.compact,
  });

  final ReservationDetailTimelineEntry entry;
  final bool isLast;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final accent = entry.semantic.foreground(context);
    final formatters = LocalizedFormatters(context.l10n);

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: compact ? 20 : 24,
            child: Column(
              children: [
                Container(
                  width: 10,
                  height: 10,
                  decoration: BoxDecoration(
                    color: entry.isActive ? accent : accent.withValues(alpha: 0.35),
                    shape: BoxShape.circle,
                    border: Border.all(color: accent),
                  ),
                ),
                if (!isLast)
                  Expanded(
                    child: Container(
                      width: 2,
                      color: palette.borderSubtle,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: isLast ? 0 : AppSpacing.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    entry.label,
                    style: AppTextStyles.label(context).copyWith(
                      color: palette.textPrimary,
                      fontWeight:
                          entry.isActive ? FontWeight.w700 : FontWeight.w500,
                    ),
                  ),
                  if (entry.timestamp != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      formatters.dateTime(entry.timestamp!),
                      style: AppTextStyles.label(context).copyWith(
                        color: palette.textMuted,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
