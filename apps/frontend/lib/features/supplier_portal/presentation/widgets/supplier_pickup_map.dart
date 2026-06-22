import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import 'package:frontend/features/supplier_portal/presentation/theme/supplier_theme_extension.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../../../../app/theme/app_color_tokens.dart';
import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import 'supplier_selected_coordinates_panel.dart';

/// Palestine fallback center when no coordinates and city is not Nablus.
const palestineFallbackCenter = LatLng(31.9522, 35.2332);

/// Nablus fallback center.
const nablusFallbackCenter = LatLng(32.2211, 35.2544);

enum SupplierLocationButtonState {
  idle,
  loading,
  captured,
}

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
    this.showCoordinatesAsLabel = false,
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
  final bool showCoordinatesAsLabel;

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

  LatLng get _mapCenter =>
      _hasCoordinates ? LatLng(widget.latitude!, widget.longitude!) : _fallbackCenter;

  double get _mapZoom => _hasCoordinates ? 14 : _fallbackZoom;

  String _locationButtonLabel(BuildContext context) {
    return switch (widget.locationButtonState) {
      SupplierLocationButtonState.loading => context.s.gettingLocation,
      SupplierLocationButtonState.captured => context.s.locationCapturedShort,
      SupplierLocationButtonState.idle => context.s.useCurrentLocation,
    };
  }

  String _locationSummary(BuildContext context) {
    if (widget.showCoordinatesAsLabel && _hasCoordinates) {
      return '${widget.latitude!.toStringAsFixed(5)}, '
          '${widget.longitude!.toStringAsFixed(5)}';
    }

    final parts = [
      if (widget.fallbackCity != null && widget.fallbackCity!.trim().isNotEmpty)
        widget.fallbackCity!.trim(),
      if (widget.fallbackArea != null && widget.fallbackArea!.trim().isNotEmpty)
        widget.fallbackArea!.trim(),
    ];
    if (parts.isEmpty) {
      return context.s.noAreaSelectedYet;
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
      if (kDebugMode && _hasCoordinates) {
        debugPrint(
          '[SupplierProfile] map marker lat=${widget.latitude} '
          'lng=${widget.longitude}',
        );
      }
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

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    final locationSummary = _locationSummary(context);
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
                  color: context.supplierColors.accentSoft.withValues(alpha: 0.18),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: context.supplierColors.border.withValues(alpha: 0.35),
                  ),
                ),
                child: Icon(
                  Icons.map_outlined,
                  color: context.supplierColors.accent,
                  size: 20,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      context.s.pickupLocation,
                      style: context.supplierLabel().copyWith(
                        color: colors.textPrimary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    Text(
                      locationSummary,
                      style: context.supplierBody(),
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
                widget.locationButtonState == SupplierLocationButtonState.loading
                ? null
                : widget.onUseCurrentLocation,
            icon: widget.locationButtonState == SupplierLocationButtonState.loading
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
            label: Text(_locationButtonLabel(context)),
            style: OutlinedButton.styleFrom(
              foregroundColor:
                  widget.locationButtonState == SupplierLocationButtonState.captured
                  ? context.supplierColors.accent
                  : context.supplierColors.textPrimary,
              side: BorderSide(
                color: context.supplierColors.border.withValues(alpha: 0.55),
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
        if (widget.locationButtonState == SupplierLocationButtonState.captured &&
            widget.isEditable) ...[
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(AppSpacing.sm),
            decoration: context.supplierDecorations.profileSectionPanel.copyWith(
              border: Border.all(
                color: context.supplierColors.accent.withValues(alpha: 0.35),
              ),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  Icons.check_circle_outline,
                  color: context.supplierColors.accent,
                  size: 18,
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Text(
                    context.s.locationCapturedOptionalDetails,
                    style: context.supplierBody().copyWith(
                      color: context.supplierColors.accent,
                    ),
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
            helperMessage:
                widget.locationButtonState ==
                    SupplierLocationButtonState.captured
                ? context.s.selectedCoordinates
                : null,
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
                  color: context.supplierColors.border.withValues(alpha: 0.45),
                ),
              ),
              child: Stack(
                fit: StackFit.expand,
                children: [
                  FlutterMap(
                    key: ValueKey(
                      '${widget.latitude}_${widget.longitude}_'
                      '${widget.showCoordinatesAsLabel}',
                    ),
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
                              point: LatLng(widget.latitude!, widget.longitude!),
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
                            color: AppColorTokens.supplierMapDisabledOverlay,
                          ),
                          child: Center(
                            child: Padding(
                              padding: const EdgeInsets.all(AppSpacing.lg),
                              child: Container(
                                padding: const EdgeInsets.all(AppSpacing.md),
                                decoration: context.supplierDecorations.badge(
                                  background: context.supplierColors.surfaceSolid
                                      .withValues(alpha: 0.92),
                                ),
                                child: Text(
                                  context.s.mapLocationHelp,
                                  textAlign: TextAlign.center,
                                  style: context.supplierBody(),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  if (_hasCoordinates &&
                      widget.showCoordinatesAsLabel)
                    Positioned(
                      left: AppSpacing.sm,
                      right: AppSpacing.sm,
                      top: AppSpacing.sm,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.sm,
                          vertical: AppSpacing.xs,
                        ),
                        decoration: context.supplierDecorations.badge(
                          background: context.supplierColors.surfaceSolid.withValues(
                            alpha: 0.92,
                          ),
                        ),
                        child: Text(
                          context.s.currentLocationLabel,
                          style: context.supplierChip(),
                        ),
                      ),
                    )
                  else if (_hasCoordinates &&
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
                        decoration: context.supplierDecorations.badge(
                          background: context.supplierColors.surfaceSolid.withValues(
                            alpha: 0.92,
                          ),
                        ),
                        child: Text(
                          locationSummary,
                          style: context.supplierChip(),
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
            context.s.visibilitySummary(
              context.s.visibilityLabel(widget.visibility!),
            ),
            style: context.supplierBody().copyWith(
              color: context.supplierColors.accent,
            ),
          ),
        ],
        if (widget.fallbackCountry != null &&
            widget.fallbackCountry!.trim().isNotEmpty) ...[
          const SizedBox(height: AppSpacing.xs),
          Text(
            widget.fallbackCountry!,
            style: context.supplierBody(),
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
      decoration: context.supplierDecorations.sideInsightCard,
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
            color: context.supplierColors.surfaceSolid.withValues(alpha: 0.95),
            shape: BoxShape.circle,
            border: Border.all(color: context.supplierColors.accent, width: 2),
            boxShadow: [
              BoxShadow(
                color: context.supplierColors.accentSoft.withValues(alpha: 0.45),
                blurRadius: 12,
              ),
            ],
          ),
          child: Icon(
            Icons.location_on,
            color: context.supplierColors.accent,
            size: 22,
          ),
        ),
        Container(
          width: 4,
          height: 10,
          decoration: BoxDecoration(
            color: context.supplierColors.accent,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
      ],
    );
  }
}
