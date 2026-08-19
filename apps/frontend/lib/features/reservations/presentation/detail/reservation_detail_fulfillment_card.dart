import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/handover_confirmation_code_panel.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../deliveries/data/models/learner_delivery.dart';
import '../../../deliveries/presentation/delivery_status_presentation.dart';
import '../../data/models/learner_reservation.dart';
import '../learner_reservation_ui_helpers.dart';
import 'reservation_detail_semantic.dart';

class ReservationDetailFulfillmentCard extends StatelessWidget {
  const ReservationDetailFulfillmentCard({
    super.key,
    required this.reservation,
    required this.delivery,
  });

  final LearnerReservation reservation;
  final LearnerDelivery? delivery;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final palette = MaterialsUiPalette.of(context);
    final hasDeliveryRecord = delivery != null;

    if (reservation.isDeliveryFulfillment || hasDeliveryRecord) {
      return _buildDeliveryCard(context, l10n, palette, hasDeliveryRecord);
    }

    if (!shouldShowAcceptedPickupInfo(reservation)) {
      return const SizedBox.shrink();
    }

    final pickupAddress = formatPickupAddress(reservation);
    final instructions = reservation.supplierNote?.trim();

    return ReservationDetailSurfaceCard(
      semantic: ReservationDetailSemantic.pickup,
      title: l10n.reservationDetailFulfillmentTitle,
      titleIcon: Icons.storefront_outlined,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (pickupAddress != null)
            _InfoRow(
              icon: Icons.location_on_outlined,
              label: l10n.pickupAddressValue(pickupAddress),
            ),
          if (instructions != null && instructions.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            _InfoRow(icon: Icons.info_outline, label: instructions),
          ],
          const SizedBox(height: AppSpacing.sm),
          _InfoRow(
            icon: Icons.local_shipping_outlined,
            label: formatDeliveryAvailability(
              reservation,
              l10n: l10n,
              hasDeliveryRecord: hasDeliveryRecord,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDeliveryCard(
    BuildContext context,
    AppLocalizations l10n,
    MaterialsUiPalette palette,
    bool hasDeliveryRecord,
  ) {
    final deliveryId = delivery?.id ?? reservation.activeDelivery?.id;
    final deliveryStatus =
        delivery?.status ?? reservation.activeDelivery?.status;
    final statusLabel = deliveryStatus == null
        ? formatDeliveryAvailability(
            reservation,
            l10n: l10n,
            hasDeliveryRecord: hasDeliveryRecord,
          )
        : deliveryStatusLabel(deliveryStatus, l10n: l10n);

    return ReservationDetailSurfaceCard(
      semantic: ReservationDetailSemantic.delivery,
      title: l10n.reservationDetailFulfillmentTitle,
      titleIcon: Icons.local_shipping_outlined,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (deliveryStatus != null)
            AppStatusBadge(
              label: statusLabel,
              tone: deliveryStatusAppTone(deliveryStatus),
            ),
          if (formatDeliveryAddressSummary(reservation, l10n: l10n)
              case final address?) ...[
            const SizedBox(height: AppSpacing.sm),
            _InfoRow(icon: Icons.home_outlined, label: address),
          ],
          if (reservation.shouldShowLearnerDeliveryCode) ...[
            const SizedBox(height: AppSpacing.sm),
            HandoverConfirmationCodePanel(
              code: reservation.activeDelivery!.learnerDeliveryCode!,
              instructions: l10n.deliveryCodeInstructions,
            ),
          ],
          if (deliveryId != null) ...[
            const SizedBox(height: AppSpacing.md),
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: TextButton.icon(
                onPressed: () {
                  context.push('/learner/deliveries/$deliveryId');
                },
                icon: const Icon(Icons.open_in_new_rounded, size: 16),
                label: Text(l10n.viewDeliveryDetails),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 16, color: palette.textMuted),
        const SizedBox(width: AppSpacing.xs),
        Expanded(
          child: Text(
            label,
            style: AppTextStyles.label(context).copyWith(
              color: palette.textSecondary,
            ),
          ),
        ),
      ],
    );
  }
}
