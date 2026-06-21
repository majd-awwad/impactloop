import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_colors.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';
import '../../../../app/theme/supplier_decorations.dart';
import 'supplier_location_privacy_card.dart';
import 'supplier_selected_coordinates_panel.dart';

/// Palestine fallback center when no coordinates and city is not Nablus.
const palestineFallbackCenter = LatLng(31.9522, 35.2332);

/// Nablus fallback center.
const nablusFallbackCenter = LatLng(32.2211, 35.2544);

enum SupplierLocationButtonState { idle, loading, captured }

class SupplierPickupMap extends StatefulWidget {
  const SupplierPickupMap({
    super.key,
    this.latitude,
    this.longitude,
    this.fallbackCity,
    this.fallbackArea,
    this.fallbackCountry,
    this.visibility,
    this.isEditable = false,
    this.showLocationButton = false,
    this.locationButtonState = SupplierLocationButtonState.idle,
    this.onUseCurrentLocation,
    this.showPanelChrome = false,
    this.compact = false,
    this.showCoordinateDetails = false,
  });

  final double? latitude;
  final double? longitude;
  final String? fallbackCity;
  final String? fallbackArea;
  final String? fallbackCountry;
  final String? visibility;
  final bool isEditable;
  final bool showLocationButton;
  final SupplierLocationButtonState locationButtonState;
  final VoidCallback? onUseCurrentLocation;
  final bool showPanelChrome;
  final bool compact;
  final bool showCoordinateDetails;

  bool get hasCoordinates => latitude != null && longitude != null;

  @override
  State<SupplierPickupMap> createState() => _SupplierPickupMapState();
}

class _SupplierPickupMapState extends State<SupplierPickupMap> {
  final MapController _mapController = MapController();

  bool get _hasCoordinates => widget.hasCoordinates;

  LatLng get _fallbackCenter {
    final city = widget.fallbackCity?.trim().toLowerCase() ?? '';
    if (city == 'nablus') {
      return nablusFallbackCenter;
    }
    return palestineFallbackCenter;
  }

  double get _fallbackZoom {
    final city = widget.fallbackCity?.trim().toLowerCase() ?? '';
    return city == 'nablus' ? 12 : 8;
  }

  LatLng get _mapCenter => _hasCoordinates
      ? LatLng(widget.latitude!, widget.longitude!)
      : _fallbackCenter;

  double get _mapZoom => _hasCoordinates ? 14 : _fallbackZoom;

  String get _locationSummary {
    final parts = [
      if (widget.fallbackCity != null && widget.fallbackCity!.trim().isNotEmpty)
        widget.fallbackCity!.trim(),
      if (widget.fallbackArea != null && widget.fallbackArea!.trim().isNotEmpty)
        widget.fallbackArea!.trim(),
    ];
    if (parts.isEmpty) {
      return 'No area selected yet';
    }
    return parts.join(', ');
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _syncMapView());
  }

  @override
  void didUpdateWidget(covariant SupplierPickupMap oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.latitude != widget.latitude ||
        oldWidget.longitude != widget.longitude ||
        oldWidget.fallbackCity != widget.fallbackCity) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _syncMapView());
    }
  }

  @override
  void dispose() {
    _mapController.dispose();
    super.dispose();
  }

  void _syncMapView() {
    if (!mounted) {
      return;
    }

    try {
      _mapController.move(_mapCenter, _mapZoom);
    } catch (_) {
      // Map may not be ready on first frame; ignore.
    }
  }

  double _mapHeight(BuildContext context) {
    if (widget.compact) {
      return 220;
    }

    final width = MediaQuery.sizeOf(context).width;
    if (width >= 1024) {
      return 320;
    }
    if (width >= 600) {
      return 260;
    }
    return 240;
  }

  String get _locationButtonLabel {
    return switch (widget.locationButtonState) {
      SupplierLocationButtonState.loading => 'Getting location...',
      SupplierLocationButtonState.captured => 'Location captured',
      SupplierLocationButtonState.idle => 'Use my current location',
    };
  }

  @override
  Widget build(BuildContext context) {
    final content = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (widget.showPanelChrome) ...[
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: AuthDarkColors.accentSoft.withValues(alpha: 0.18),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: AuthDarkColors.border.withValues(alpha: 0.35),
                  ),
                ),
                child: const Icon(
                  Icons.map_outlined,
                  color: AuthDarkColors.accent,
                  size: 20,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Pickup location',
                      style: AuthDarkTextStyles.label(context).copyWith(
                        color: AuthDarkColors.textPrimary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    Text(
                      _locationSummary,
                      style: AuthDarkTextStyles.body(context),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
        ],
        if (widget.showLocationButton) ...[
          OutlinedButton.icon(
            onPressed:
                widget.locationButtonState ==
                    SupplierLocationButtonState.loading
                ? null
                : widget.onUseCurrentLocation,
            icon:
                widget.locationButtonState ==
                    SupplierLocationButtonState.loading
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Icon(
                    widget.locationButtonState ==
                            SupplierLocationButtonState.captured
                        ? Icons.check_circle_outline
                        : Icons.my_location_outlined,
                    size: 18,
                  ),
            label: Text(_locationButtonLabel),
            style: OutlinedButton.styleFrom(
              foregroundColor:
                  widget.locationButtonState ==
                      SupplierLocationButtonState.captured
                  ? AuthDarkColors.accent
                  : AuthDarkColors.textPrimary,
              side: BorderSide(
                color: AuthDarkColors.border.withValues(alpha: 0.55),
              ),
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.md,
                vertical: AppSpacing.sm,
              ),
              shape: RoundedRectangleBorder(borderRadius: AppRadius.mdAll),
            ),
          ),
          const SizedBox(height: AppSpacing.md),
        ],
        if (widget.locationButtonState ==
                SupplierLocationButtonState.captured &&
            widget.isEditable) ...[
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(AppSpacing.sm),
            decoration: SupplierDecorations.profileSectionPanel.copyWith(
              border: Border.all(
                color: AuthDarkColors.accent.withValues(alpha: 0.35),
              ),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(
                  Icons.check_circle_outline,
                  color: AuthDarkColors.accent,
                  size: 18,
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Text(
                    'Location captured. Confirm city and area, then save profile.',
                    style: AuthDarkTextStyles.body(
                      context,
                    ).copyWith(color: AuthDarkColors.accent),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.md),
        ],
        if (_hasCoordinates && widget.showCoordinateDetails) ...[
          SupplierSelectedCoordinatesPanel(
            latitude: widget.latitude!,
            longitude: widget.longitude!,
            showCaptureHelper:
                widget.locationButtonState ==
                SupplierLocationButtonState.captured,
          ),
          const SizedBox(height: AppSpacing.md),
        ],
        SizedBox(
          height: _mapHeight(context),
          width: double.infinity,
          child: ClipRRect(
            borderRadius: AppRadius.lgAll,
            child: DecoratedBox(
              decoration: BoxDecoration(
                border: Border.all(
                  color: AuthDarkColors.border.withValues(alpha: 0.45),
                ),
              ),
              child: Stack(
                fit: StackFit.expand,
                children: [
                  FlutterMap(
                    mapController: _mapController,
                    options: MapOptions(
                      initialCenter: _mapCenter,
                      initialZoom: _mapZoom,
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
                      if (_hasCoordinates)
                        MarkerLayer(
                          markers: [
                            Marker(
                              point: LatLng(
                                widget.latitude!,
                                widget.longitude!,
                              ),
                              width: 44,
                              height: 44,
                              alignment: Alignment.topCenter,
                              child: const _TealMapMarker(),
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
                  if (!_hasCoordinates)
                    Positioned.fill(
                      child: IgnorePointer(
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            color: Colors.black.withValues(alpha: 0.28),
                          ),
                          child: Center(
                            child: Padding(
                              padding: const EdgeInsets.all(AppSpacing.lg),
                              child: Container(
                                padding: const EdgeInsets.all(AppSpacing.md),
                                decoration: SupplierDecorations.badge(
                                  background: AuthDarkColors.surfaceSolid
                                      .withValues(alpha: 0.92),
                                ),
                                child: Text(
                                  'Use your current location or enter pickup details manually.',
                                  textAlign: TextAlign.center,
                                  style: AuthDarkTextStyles.body(context),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  if (_hasCoordinates &&
                      widget.fallbackCity != null &&
                      widget.fallbackCity!.trim().isNotEmpty)
                    Positioned(
                      left: AppSpacing.sm,
                      right: AppSpacing.sm,
                      top: AppSpacing.sm,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.sm,
                          vertical: AppSpacing.xs,
                        ),
                        decoration: SupplierDecorations.badge(
                          background: AuthDarkColors.surfaceSolid.withValues(
                            alpha: 0.92,
                          ),
                        ),
                        child: Text(
                          _locationSummary,
                          style: AuthDarkTextStyles.chip(context),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
        if (widget.visibility != null && widget.visibility!.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Visibility: ${visibilityLabel(widget.visibility!)}',
            style: AuthDarkTextStyles.body(
              context,
            ).copyWith(color: AuthDarkColors.accent),
          ),
        ],
        if (widget.fallbackCountry != null &&
            widget.fallbackCountry!.trim().isNotEmpty) ...[
          const SizedBox(height: AppSpacing.xs),
          Text(
            widget.fallbackCountry!,
            style: AuthDarkTextStyles.body(context),
          ),
        ],
      ],
    );

    if (!widget.showPanelChrome) {
      return content;
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: SupplierDecorations.sideInsightCard,
      child: content,
    );
  }
}

class _TealMapMarker extends StatelessWidget {
  const _TealMapMarker();

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 34,
          height: 34,
          decoration: BoxDecoration(
            color: AuthDarkColors.surfaceSolid.withValues(alpha: 0.95),
            shape: BoxShape.circle,
            border: Border.all(color: AuthDarkColors.accent, width: 2),
            boxShadow: [
              BoxShadow(
                color: AuthDarkColors.accentSoft.withValues(alpha: 0.45),
                blurRadius: 12,
              ),
            ],
          ),
          child: const Icon(
            Icons.location_on,
            color: AuthDarkColors.accent,
            size: 22,
          ),
        ),
        Container(
          width: 4,
          height: 10,
          decoration: BoxDecoration(
            color: AuthDarkColors.accent,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
      ],
    );
  }
}
