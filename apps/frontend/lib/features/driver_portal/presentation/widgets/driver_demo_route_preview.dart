import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../application/driver_demo_tracking_controller.dart';

class DriverDemoRoutePreview extends StatelessWidget {
  const DriverDemoRoutePreview({
    super.key,
    required this.route,
    this.currentLatitude,
    this.currentLongitude,
    this.usesFallbackCoordinates = false,
  });

  final DemoRouteCoordinates route;
  final double? currentLatitude;
  final double? currentLongitude;
  final bool usesFallbackCoordinates;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final pickup = LatLng(route.startLatitude, route.startLongitude);
    final dropoff = LatLng(route.endLatitude, route.endLongitude);
    final points = buildDemoRoutePoints(
      startLatitude: route.startLatitude,
      startLongitude: route.startLongitude,
      endLatitude: route.endLatitude,
      endLongitude: route.endLongitude,
    );
    final routePolyline = points
        .map((point) => LatLng(point.latitude, point.longitude))
        .toList(growable: false);

    final bounds = LatLngBounds.fromPoints([
      pickup,
      dropoff,
      if (currentLatitude != null && currentLongitude != null)
        LatLng(currentLatitude!, currentLongitude!),
    ]);

    return ClipRRect(
      borderRadius: AppRadius.mdAll,
      child: SizedBox(
        height: 200,
        width: double.infinity,
        child: FlutterMap(
          options: MapOptions(
            initialCameraFit: CameraFit.bounds(
              bounds: bounds,
              padding: const EdgeInsets.all(36),
            ),
            minZoom: 5,
            maxZoom: 18,
            interactionOptions: const InteractionOptions(
              flags: InteractiveFlag.all & ~InteractiveFlag.rotate,
            ),
          ),
          children: [
            TileLayer(
              urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
              userAgentPackageName: 'com.impactloop.frontend',
            ),
            PolylineLayer(
              polylines: [
                Polyline(
                  points: routePolyline,
                  color: palette.mint.withValues(alpha: 0.85),
                  strokeWidth: 4,
                ),
              ],
            ),
            MarkerLayer(
              markers: [
                Marker(
                  point: pickup,
                  width: 40,
                  height: 40,
                  child: Icon(Icons.storefront_outlined, color: palette.mint),
                ),
                Marker(
                  point: dropoff,
                  width: 40,
                  height: 40,
                  child: Icon(Icons.home_outlined, color: palette.textPrimary),
                ),
                if (currentLatitude != null && currentLongitude != null)
                  Marker(
                    point: LatLng(currentLatitude!, currentLongitude!),
                    width: 44,
                    height: 44,
                    alignment: Alignment.topCenter,
                    child: Icon(Icons.local_shipping, color: palette.mint, size: 36),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
