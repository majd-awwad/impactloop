import 'package:flutter/material.dart';

import 'supplier_pickup_map.dart';

/// Sidebar/card wrapper around [SupplierPickupMap] for profile layout panels.
class SupplierPickupMapPreview extends StatelessWidget {
  const SupplierPickupMapPreview({
    super.key,
    required this.city,
    this.area,
    this.country,
    this.visibility,
    this.latitude,
    this.longitude,
    this.showUseLocationButton = false,
    this.locationButtonState = SupplierLocationButtonState.idle,
    this.onUseCurrentLocation,
    this.compact = false,
    this.showCoordinateDetails = false,
    this.showCoordinatesAsLabel = false,
  });

  final String city;
  final String? area;
  final String? country;
  final String? visibility;
  final double? latitude;
  final double? longitude;
  final bool showUseLocationButton;
  final SupplierLocationButtonState locationButtonState;
  final VoidCallback? onUseCurrentLocation;
  final bool compact;
  final bool showCoordinateDetails;
  final bool showCoordinatesAsLabel;

  @override
  Widget build(BuildContext context) {
    return SupplierPickupMap(
      latitude: latitude,
      longitude: longitude,
      fallbackCity: city,
      fallbackArea: area,
      fallbackCountry: country,
      visibility: visibility,
      isEditable: showUseLocationButton,
      showLocationButton: showUseLocationButton,
      locationButtonState: locationButtonState,
      onUseCurrentLocation: onUseCurrentLocation,
      showPanelChrome: true,
      compact: compact,
      showCoordinateDetails: showCoordinateDetails,
      showCoordinatesAsLabel: showCoordinatesAsLabel,
    );
  }
}
