import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../deliveries/data/models/learner_delivery.dart';
import '../../data/models/learner_reservation.dart';
import '../learner_reservation_ui_helpers.dart';
import 'reservation_detail_semantic.dart';

class ReservationDetailSummaryCard extends StatelessWidget {
  const ReservationDetailSummaryCard({
    super.key,
    required this.reservation,
    required this.delivery,
  });

  final LearnerReservation reservation;
  final LearnerDelivery? delivery;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final chipLabels = learnerReservationStatusChipLabels(
      reservation,
      linkedDeliveryStatus: delivery?.status,
      l10n: l10n,
    );

    return ReservationDetailSurfaceCard(
      semantic: ReservationDetailSemantic.neutral,
      title: l10n.reservationSummaryTitle,
      titleIcon: Icons.receipt_long_outlined,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _SummaryRow(
            label: l10n.reservationDateLabel,
            value: formatReservationDate(reservation.createdAt, l10n: l10n),
          ),
          _SummaryRow(
            label: l10n.quantityLabelShort,
            value: formatQuantityLabel(reservation, l10n: l10n),
          ),
          _SummaryRow(
            label: l10n.fulfillmentMethod,
            value: formatFulfillmentMethodLabel(reservation, l10n: l10n),
          ),
          if (reservation.material.locationLabel.trim().isNotEmpty)
            _SummaryRow(
              label: l10n.reservationLocationLabel,
              value: reservation.material.locationLabel,
            ),
          _SummaryRow(
            label: l10n.reservationStatusLabel,
            value: chipLabels.primary,
          ),
          if (formatPreferredWindowsSummary(reservation, l10n: l10n)
              case final preferredWindows?)
            _SummaryRow(label: l10n.pickupWindow, value: preferredWindows),
          if (formatDeliveryAddressSummary(reservation, l10n: l10n)
              case final deliveryAddress?)
            _SummaryRow(label: l10n.delivery, value: deliveryAddress),
        ],
      ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  const _SummaryRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            flex: 2,
            child: Text(
              label,
              style: AppTextStyles.label(context).copyWith(
                color: palette.textMuted,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            flex: 3,
            child: Text(
              value,
              style: AppTextStyles.label(context).copyWith(
                color: palette.textPrimary,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
