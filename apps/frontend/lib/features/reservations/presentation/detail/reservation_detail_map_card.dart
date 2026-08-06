import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../l10n/l10n.dart';
import '../../data/models/learner_reservation.dart';
import '../learner_reservation_ui_helpers.dart';
import '../widgets/learner_pickup_location_map.dart';
import 'reservation_detail_semantic.dart';

class ReservationDetailMapCard extends StatelessWidget {
  const ReservationDetailMapCard({
    super.key,
    required this.reservation,
    required this.hasDeliveryRecord,
    this.compact = false,
  });

  final LearnerReservation reservation;
  final bool hasDeliveryRecord;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final showMap = shouldShowSelfPickupMap(
      reservation,
      hasDeliveryRecord: hasDeliveryRecord,
    );
    final location = reservation.pickupLocationFull;

    if (!showMap || location == null) {
      return const SizedBox.shrink();
    }

    final l10n = context.l10n;
    final mapHeight = compact ? 180.0 : 280.0;

    return ReservationDetailSurfaceCard(
      semantic: ReservationDetailSemantic.pickup,
      title: l10n.reservationLocationLabel,
      titleIcon: Icons.map_outlined,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          LearnerPickupLocationMap(
            location: location,
            height: mapHeight,
          ),
          if (location.hasCoordinates) ...[
            const SizedBox(height: AppSpacing.sm),
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: TextButton.icon(
                onPressed: () => _openInMaps(location),
                icon: const Icon(Icons.open_in_new_rounded, size: 16),
                label: Text(l10n.openInMaps),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Future<void> _openInMaps(LearnerReservationPickupLocation location) async {
    final lat = location.latitude;
    final lng = location.longitude;
    if (lat == null || lng == null) return;

    final uri = Uri.parse(
      'https://www.google.com/maps/search/?api=1&query=$lat,$lng',
    );
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }
}
