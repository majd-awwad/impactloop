import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../materials/data/models/create_material_request.dart';
import '../../data/models/reverse_geocode_result.dart';
import '../../data/models/supplier_profile_location.dart';
import '../../data/supplier_location_service.dart';
import '../../data/supplier_profile_repository.dart';
import '../theme/supplier_theme_extension.dart';
import 'supplier_dark_form_field.dart';
import 'supplier_feedback.dart';
import 'supplier_pickup_map.dart';
import 'supplier_pickup_map_preview.dart';
import 'supplier_reverse_geocode_state.dart';
import 'supplier_type_selector.dart';

class MaterialPickupSubmitData {
  const MaterialPickupSubmitData({
    required this.useDefaultPickupLocation,
    this.pickupLocation,
  });

  final bool useDefaultPickupLocation;
  final CreateMaterialPickupLocationRequest? pickupLocation;
}

class AddMaterialPickupSection extends ConsumerStatefulWidget {
  const AddMaterialPickupSection({
    super.key,
    required this.supplierType,
    required this.profilePickupLocation,
    required this.pickupAllowed,
    required this.deliveryAllowed,
    required this.pickupNotesController,
    required this.onPickupAllowedChanged,
    required this.onDeliveryAllowedChanged,
    this.onChanged,
  });

  final String supplierType;
  final SupplierProfileLocation profilePickupLocation;
  final bool pickupAllowed;
  final bool deliveryAllowed;
  final TextEditingController pickupNotesController;
  final ValueChanged<bool> onPickupAllowedChanged;
  final ValueChanged<bool> onDeliveryAllowedChanged;
  final VoidCallback? onChanged;

  @override
  ConsumerState<AddMaterialPickupSection> createState() =>
      AddMaterialPickupSectionState();
}

class AddMaterialPickupSectionState
    extends ConsumerState<AddMaterialPickupSection> {
  final _locationService = const SupplierLocationService();
  final _countryController = TextEditingController();
  final _cityController = TextEditingController();
  final _areaController = TextEditingController();
  final _addressLineController = TextEditingController();

  bool _useProfilePickupLocation = true;
  SupplierReverseGeocodeState _reverseGeocodeState =
      SupplierReverseGeocodeState.idle;
  SupplierLocationButtonState _locationButtonState =
      SupplierLocationButtonState.idle;
  bool _locationCapturedThisSession = false;
  bool _manualAddressEditedAfterCapture = false;
  double? _latitude;
  double? _longitude;
  static const _overrideVisibility = 'ORDER_ONLY';
  static const _overrideIsApproximate = true;

  bool get _isOrganizationSupplier =>
      isOrganizationSupplierType(widget.supplierType);

  @override
  void initState() {
    super.initState();
    _applyProfileDefaults();
  }

  @override
  void didUpdateWidget(covariant AddMaterialPickupSection oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.profilePickupLocation.id !=
            widget.profilePickupLocation.id ||
        oldWidget.supplierType != widget.supplierType) {
      _applyProfileDefaults();
    }
  }

  @override
  void dispose() {
    _countryController.dispose();
    _cityController.dispose();
    _areaController.dispose();
    _addressLineController.dispose();
    super.dispose();
  }

  void reset() {
    setState(() {
      _useProfilePickupLocation = true;
      _applyProfileDefaults();
      _reverseGeocodeState = SupplierReverseGeocodeState.idle;
      _locationButtonState = SupplierLocationButtonState.idle;
      _locationCapturedThisSession = false;
      _manualAddressEditedAfterCapture = false;
    });
    widget.onChanged?.call();
  }

  void applyDraftPickup(Map<String, dynamic> json) {
    final useDefault = json['useDefaultPickupLocation'] as bool? ?? true;
    final pickupJson = json['pickupLocation'];

    setState(() {
      _useProfilePickupLocation = useDefault;
      if (!useDefault && pickupJson is Map) {
        final draft = Map<String, dynamic>.from(pickupJson);
        _countryController.text = draft['country'] as String? ?? '';
        _cityController.text = draft['city'] as String? ?? '';
        _areaController.text = draft['area'] as String? ?? '';
        _addressLineController.text = draft['addressLine'] as String? ?? '';
        _latitude = _parseCoordinate(draft['latitude']);
        _longitude = _parseCoordinate(draft['longitude']);
        _locationCapturedThisSession =
            _latitude != null && _longitude != null;
      } else {
        _applyProfileDefaults();
      }
    });
    widget.onChanged?.call();
  }

  Map<String, dynamic>? buildDraftPickupJson() {
    if (_isOrganizationSupplier) {
      return const {'useDefaultPickupLocation': true};
    }

    final submitData = buildSubmitData();
    return {
      'useDefaultPickupLocation': submitData.useDefaultPickupLocation,
      if (!submitData.useDefaultPickupLocation &&
          submitData.pickupLocation != null)
        'pickupLocation': submitData.pickupLocation!.toJson(),
    };
  }

  void _applyProfileDefaults() {
    final location = widget.profilePickupLocation;
    _countryController.text = location.country;
    _cityController.text = location.city;
    _areaController.text = location.area ?? '';
    _addressLineController.text = location.addressLine ?? '';
    _latitude = location.latitude;
    _longitude = location.longitude;
  }

  MaterialPickupSubmitData buildSubmitData() {
    if (_isOrganizationSupplier || _useProfilePickupLocation) {
      return const MaterialPickupSubmitData(useDefaultPickupLocation: true);
    }

    return MaterialPickupSubmitData(
      useDefaultPickupLocation: false,
      pickupLocation: CreateMaterialPickupLocationRequest(
        country: _countryController.text.trim(),
        city: _cityController.text.trim(),
        area: _emptyToNull(_areaController.text),
        addressLine: _emptyToNull(_addressLineController.text),
        latitude: _latitude,
        longitude: _longitude,
        visibility: _overrideVisibility,
        isApproximate: _overrideIsApproximate,
      ),
    );
  }

  String buildPreviewPickupLabel() {
    if (_isOrganizationSupplier || _useProfilePickupLocation) {
      return widget.profilePickupLocation.summary;
    }

    return _formatPickupLabel(
      city: _cityController.text.trim(),
      area: _emptyToNull(_areaController.text),
      addressLine: _emptyToNull(_addressLineController.text),
      hasCoordinates: _latitude != null && _longitude != null,
    );
  }

  String? validateOverrideLocation() {
    if (_isOrganizationSupplier || _useProfilePickupLocation) {
      return null;
    }

    final hasCoordinates = _latitude != null && _longitude != null;
    if (!hasCoordinates && _cityController.text.trim().isEmpty) {
      return context.s.cityRequiredForPickup;
    }

    return null;
  }

  String? _emptyToNull(String value) {
    final trimmed = value.trim();
    return trimmed.isEmpty ? null : trimmed;
  }

  double? _parseCoordinate(dynamic value) {
    if (value == null) {
      return null;
    }
    if (value is num) {
      return value.toDouble();
    }
    if (value is String) {
      return double.tryParse(value);
    }
    return null;
  }

  String _formatPickupLabel({
    required String city,
    required String? area,
    required String? addressLine,
    required bool hasCoordinates,
  }) {
    final parts = <String>[
      if (city.isNotEmpty) city,
      if (area != null && area.isNotEmpty) area,
      if (addressLine != null && addressLine.isNotEmpty) addressLine,
    ];
    if (parts.isNotEmpty) {
      return parts.join(', ');
    }
    if (hasCoordinates) {
      return context.s.pickupPinSelectedOnMap;
    }
    return '—';
  }

  void _notifyChanged() {
    widget.onChanged?.call();
  }

  void _applyReverseGeocodeResult(ReverseGeocodeResult result) {
    if (result.country != null) {
      _countryController.text = result.country!;
    }
    if (result.city != null) {
      _cityController.text = result.city!;
    }
    if (result.area != null) {
      _areaController.text = result.area!;
    }
    if (result.addressLine != null) {
      _addressLineController.text = result.addressLine!;
    }
  }

  Future<void> _lookupAddressFromCoordinates(
    double latitude,
    double longitude,
  ) async {
    setState(() => _reverseGeocodeState = SupplierReverseGeocodeState.loading);

    try {
      final result = await ref
          .read(supplierProfileRepositoryProvider)
          .reverseGeocode(latitude: latitude, longitude: longitude);

      if (!mounted) {
        return;
      }

      if (!_manualAddressEditedAfterCapture) {
        _applyReverseGeocodeResult(result);
      }

      setState(() {
        _reverseGeocodeState = SupplierReverseGeocodeState.success;
      });
      _notifyChanged();
    } catch (_) {
      if (!mounted) {
        return;
      }

      setState(() {
        _reverseGeocodeState = SupplierReverseGeocodeState.failure;
      });
      _notifyChanged();
    }
  }

  void _setPinFromMap(LatLng point) {
    setState(() {
      _latitude = point.latitude;
      _longitude = point.longitude;
      _locationCapturedThisSession = true;
      _manualAddressEditedAfterCapture = false;
      _locationButtonState = SupplierLocationButtonState.captured;
    });
    _lookupAddressFromCoordinates(point.latitude, point.longitude);
    _notifyChanged();
  }

  Future<void> _captureCurrentLocation() async {
    setState(() {
      _locationButtonState = SupplierLocationButtonState.loading;
      _locationCapturedThisSession = false;
      _manualAddressEditedAfterCapture = false;
      _reverseGeocodeState = SupplierReverseGeocodeState.idle;
    });

    try {
      final capture = await _locationService.captureCurrentLocation();
      if (!mounted) {
        return;
      }

      setState(() {
        _latitude = capture.latitude;
        _longitude = capture.longitude;
        _locationCapturedThisSession = true;
        _locationButtonState = SupplierLocationButtonState.captured;
        _countryController.clear();
        _cityController.clear();
        _areaController.clear();
        _addressLineController.clear();
      });

      await _lookupAddressFromCoordinates(capture.latitude, capture.longitude);
      _notifyChanged();
    } on SupplierLocationException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _locationButtonState = SupplierLocationButtonState.idle;
        _locationCapturedThisSession = false;
      });
      showSupplierErrorSnackBar(context, error.message);
    } catch (_) {
      if (!mounted) {
        return;
      }

      setState(() {
        _locationButtonState = SupplierLocationButtonState.idle;
        _locationCapturedThisSession = false;
      });
      showSupplierErrorSnackBar(context, context.s.couldNotGetLocation);
    }
  }

  void _onOverrideAddressFieldChanged() {
    if (_locationCapturedThisSession) {
      _manualAddressEditedAfterCapture = true;
    }
    setState(() {});
    _notifyChanged();
  }

  @override
  Widget build(BuildContext context) {
    final l = context.s;
    final colors = context.supplierColors;
    final profileLocation = widget.profilePickupLocation;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SupplierFormSectionHeader(
          icon: Icons.place_outlined,
          title: l.pickupSectionTitle,
          subtitle: _isOrganizationSupplier
              ? l.orgPickupSectionSubtitle
              : l.pickupSectionSubtitle,
        ),
        const SizedBox(height: AppSpacing.lg),
        if (_isOrganizationSupplier) ...[
          SupplierPickupMapPreview(
            city: profileLocation.city,
            area: profileLocation.area,
            country: profileLocation.country,
            visibility: profileLocation.visibility,
            latitude: profileLocation.latitude,
            longitude: profileLocation.longitude,
            compact: true,
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            l.orgFixedPickupMessage,
            style: context.supplierBody().copyWith(color: colors.textMuted),
          ),
          const SizedBox(height: AppSpacing.sm),
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: TextButton.icon(
              onPressed: () => context.go('/supplier/profile'),
              icon: const Icon(Icons.edit_location_alt_outlined, size: 18),
              label: Text(l.editPickupInProfile),
            ),
          ),
        ] else ...[
          SupplierDarkSwitchTile(
            title: l.useProfilePickupLocation,
            subtitle: l.useProfilePickupLocationSubtitle,
            value: _useProfilePickupLocation,
            onChanged: (value) {
              setState(() {
                _useProfilePickupLocation = value;
                if (!value) {
                  _applyProfileDefaults();
                  _reverseGeocodeState = SupplierReverseGeocodeState.idle;
                  _locationButtonState = SupplierLocationButtonState.idle;
                  _locationCapturedThisSession =
                      _latitude != null && _longitude != null;
                }
              });
              _notifyChanged();
            },
          ),
          const SizedBox(height: AppSpacing.md),
          if (_useProfilePickupLocation)
            SupplierPickupMapPreview(
              city: profileLocation.city,
              area: profileLocation.area,
              country: profileLocation.country,
              visibility: profileLocation.visibility,
              latitude: profileLocation.latitude,
              longitude: profileLocation.longitude,
              compact: true,
            )
          else
            _buildOverridePickupEditor(context),
        ],
        const SizedBox(height: AppSpacing.md),
        SupplierDarkSwitchTile(
          title: l.pickupAllowed,
          subtitle: l.pickupAllowedSubtitle,
          value: widget.pickupAllowed,
          onChanged: widget.onPickupAllowedChanged,
        ),
        const SupplierFieldGap(),
        SupplierDarkSwitchTile(
          title: l.deliveryAllowed,
          subtitle: l.deliveryAllowedSubtitle,
          value: widget.deliveryAllowed,
          onChanged: widget.onDeliveryAllowedChanged,
        ),
        const SupplierFieldGap(),
        SupplierDarkTextArea(
          controller: widget.pickupNotesController,
          label: l.pickupNotes,
          hint: l.pickupNotesHint,
          maxLines: 3,
        ),
      ],
    );
  }

  Widget _buildOverridePickupEditor(BuildContext context) {
    final l = context.s;
    final colors = context.supplierColors;
    final hasCoordinates = _latitude != null && _longitude != null;
    final hasFreshCapture = _locationCapturedThisSession && hasCoordinates;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          l.materialPickupOverrideTitle,
          style: context.supplierSectionTitle(),
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          l.materialPickupOverrideSubtitle,
          style: context.supplierBody().copyWith(color: colors.textMuted),
        ),
        const SizedBox(height: AppSpacing.md),
        SupplierPickupMap(
          latitude: _latitude,
          longitude: _longitude,
          fallbackCity: _cityController.text.trim().isEmpty
              ? widget.profilePickupLocation.city
              : _cityController.text.trim(),
          fallbackArea: _emptyToNull(_areaController.text) ??
              widget.profilePickupLocation.area,
          fallbackCountry: _countryController.text.trim().isEmpty
              ? widget.profilePickupLocation.country
              : _countryController.text.trim(),
          visibility: _overrideVisibility,
          isEditable: true,
          allowPinPlacement: true,
          onPinMoved: _setPinFromMap,
          showLocationButton: false,
          compact: true,
          showCoordinateDetails: hasCoordinates,
        ),
        const SizedBox(height: AppSpacing.md),
        OutlinedButton.icon(
          onPressed: _locationButtonState == SupplierLocationButtonState.loading
              ? null
              : _captureCurrentLocation,
          icon: _locationButtonState == SupplierLocationButtonState.loading
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.my_location_outlined, size: 18),
          label: Text(
            _locationButtonState == SupplierLocationButtonState.loading
                ? l.gettingLocation
                : l.useCurrentLocation,
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        Text(
          l.optionalAddressDetails,
          style: context.supplierLabel().copyWith(
            color: colors.textSecondary,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          l.coordinatesSourceOfTruth,
          style: context.supplierBody().copyWith(
            color: colors.textSecondary,
            fontSize: 13,
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        SupplierDarkTextField(
          controller: _countryController,
          label: hasFreshCapture ? l.countryOptionalLabel : l.country,
          hint: hasFreshCapture ? l.optional : l.country,
          onChanged: (_) => _onOverrideAddressFieldChanged(),
        ),
        const SupplierFieldGap(),
        SupplierDarkTextField(
          controller: _cityController,
          label: hasFreshCapture ? l.cityOptionalLabel : l.city,
          hint: hasFreshCapture ? l.optional : l.city,
          onChanged: (_) => _onOverrideAddressFieldChanged(),
        ),
        const SupplierFieldGap(),
        SupplierDarkTextField(
          controller: _areaController,
          label: hasFreshCapture ? l.areaOptionalLabel : l.area,
          hint: hasFreshCapture ? l.optionalNeighborhoodOrDistrict : l.areaHint,
          onChanged: (_) => _onOverrideAddressFieldChanged(),
        ),
        const SupplierFieldGap(),
        SupplierDarkTextField(
          controller: _addressLineController,
          label: hasFreshCapture ? l.addressLineOptionalLabel : l.addressLine,
          hint: hasFreshCapture ? l.optionalStreetOrBuilding : l.addressHint,
          onChanged: (_) => _onOverrideAddressFieldChanged(),
        ),
        if (_reverseGeocodeState == SupplierReverseGeocodeState.loading)
          const Padding(
            padding: EdgeInsets.only(top: AppSpacing.sm),
            child: LinearProgressIndicator(minHeight: 2),
          ),
        if (_reverseGeocodeState == SupplierReverseGeocodeState.failure &&
            _locationCapturedThisSession) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(
            l.addressLookupFailed,
            style: context.supplierBody().copyWith(color: colors.textMuted),
          ),
        ],
      ],
    );
  }
}
