import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../data/models/learner_reservation.dart';

class LearnerPickupLocationMap extends StatelessWidget {
  const LearnerPickupLocationMap({
    super.key,
    required this.location,
    this.compact = false,
  });

  final LearnerReservationPickupLocation location;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final latitude = location.latitude;
    final longitude = location.longitude;

    if (latitude == null || longitude == null) {
      return const SizedBox.shrink();
    }

    final point = LatLng(latitude, longitude);
    final mapHeight = compact
        ? 180.0
        : (MediaQuery.sizeOf(context).width >= 700 ? 240.0 : 200.0);

    return Semantics(
      label: 'Pickup location map',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (location.isApproximate) ...[
            Text(
              'Map shows an approximate pickup area.',
              style: AppTextStyles.label(
                context,
              ).copyWith(color: palette.textMuted),
            ),
            const SizedBox(height: AppSpacing.xs),
          ],
          ClipRRect(
            borderRadius: AppRadius.mdAll,
            child: DecoratedBox(
              decoration: BoxDecoration(
                border: Border.all(color: palette.borderStrong),
              ),
              child: SizedBox(
                height: mapHeight,
                width: double.infinity,
                child: FlutterMap(
                  options: MapOptions(
                    initialCenter: point,
                    initialZoom: 15,
                    minZoom: 5,
                    maxZoom: 18,
                    interactionOptions: const InteractionOptions(
                      flags: InteractiveFlag.all & ~InteractiveFlag.rotate,
                    ),
                  ),
                  children: [
                    TileLayer(
                      urlTemplate:
                          'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                      userAgentPackageName: 'com.impactloop.frontend',
                    ),
                    MarkerLayer(
                      markers: [
                        Marker(
                          point: point,
                          width: 44,
                          height: 44,
                          alignment: Alignment.topCenter,
                          child: Icon(
                            Icons.location_pin,
                            color: palette.mint,
                            size: 42,
                          ),
                        ),
                      ],
                    ),
                    RichAttributionWidget(
                      alignment: AttributionAlignment.bottomRight,
                      attributions: [
                        TextSourceAttribution(
                          'OpenStreetMap contributors',
                          onTap: () {},
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
