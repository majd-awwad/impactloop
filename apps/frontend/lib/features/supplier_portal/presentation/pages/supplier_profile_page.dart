import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/errors/api_exception.dart';
import '../../data/supplier_location_service.dart';
import '../../data/models/reverse_geocode_result.dart';
import '../../data/models/supplier_profile.dart';
import '../../data/models/update_supplier_profile_request.dart';
import '../../data/supplier_profile_repository.dart';
import '../controllers/supplier_dashboard_providers.dart';
import '../controllers/supplier_profile_providers.dart';
import '../theme/supplier_theme_extension.dart';
import '../widgets/profile_completion_card.dart';
import '../widgets/supplier_account_security_card.dart';
import '../widgets/supplier_feedback.dart';
import '../widgets/supplier_location_privacy_card.dart';
import '../widgets/supplier_location_input_mode.dart';
import '../widgets/supplier_pickup_map.dart';
import '../widgets/supplier_pickup_map_preview.dart';
import '../widgets/supplier_profile_form.dart';
import '../widgets/supplier_profile_identity_card.dart';
import '../widgets/supplier_profile_preview_card.dart';
import '../widgets/supplier_reverse_geocode_state.dart';
import '../widgets/supplier_type_selector.dart';
import '../widgets/supplier_verification_card.dart';

class SupplierProfilePage extends ConsumerWidget {
  const SupplierProfilePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(supplierProfileProvider);

    return profile.when(
      data: (data) => _SupplierProfileContent(profile: data),
      loading: () => const _SupplierProfileLoading(),
      error: (error, _) => _SupplierProfileError(
        message: error is ApiException
            ? error.message
            : context.s.profileLoadError,
      ),
    );
  }
}

class _SupplierProfileContent extends ConsumerStatefulWidget {
  const _SupplierProfileContent({required this.profile});

  final SupplierProfileResponse profile;

  @override
  ConsumerState<_SupplierProfileContent> createState() =>
      _SupplierProfileContentState();
}

class _SupplierProfileContentState
    extends ConsumerState<_SupplierProfileContent> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _publicNameController;
  late final TextEditingController _descriptionController;
  late final TextEditingController _countryController;
  late final TextEditingController _cityController;
  late final TextEditingController _areaController;
  late final TextEditingController _addressLineController;
  late final TextEditingController _organizationNameController;
  late final TextEditingController _contactPersonController;
  late final TextEditingController _workingDaysController;
  late final TextEditingController _workingFromController;
  late final TextEditingController _workingToController;
  late final TextEditingController _businessCountryController;
  late final TextEditingController _businessCityController;
  late final TextEditingController _businessAreaController;
  late final TextEditingController _businessAddressLineController;
  late String _supplierType;
  late String _visibility;
  late bool _isApproximate;
  late bool _useSeparateBusinessLocation;
  bool _isEditing = false;
  bool _isSaving = false;
  int _draftTick = 0;
  double? _latitude;
  double? _longitude;
  SupplierLocationInputMode _locationInputMode =
      SupplierLocationInputMode.manual;
  bool _locationCapturedThisSession = false;
  bool _manualAddressEditedAfterCapture = false;
  SupplierReverseGeocodeState _reverseGeocodeState =
      SupplierReverseGeocodeState.idle;
  SupplierLocationButtonState _locationButtonState =
      SupplierLocationButtonState.idle;
  final _locationService = const SupplierLocationService();

  @override
  void initState() {
    super.initState();
    _publicNameController = TextEditingController();
    _descriptionController = TextEditingController();
    _countryController = TextEditingController();
    _cityController = TextEditingController();
    _areaController = TextEditingController();
    _addressLineController = TextEditingController();
    _organizationNameController = TextEditingController();
    _contactPersonController = TextEditingController();
    _workingDaysController = TextEditingController();
    _workingFromController = TextEditingController();
    _workingToController = TextEditingController();
    _businessCountryController = TextEditingController();
    _businessCityController = TextEditingController();
    _businessAreaController = TextEditingController();
    _businessAddressLineController = TextEditingController();
    _applyProfile(widget.profile);
    _isEditing = !widget.profile.hasSupplierProfile;
  }

  @override
  void didUpdateWidget(covariant _SupplierProfileContent oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.profile != widget.profile && !_isEditing) {
      _applyProfile(widget.profile);
    }
  }

  void _clearManualAddressFields() {
    _countryController.clear();
    _cityController.clear();
    _areaController.clear();
    _addressLineController.clear();
  }

  void _restoreManualAddressFromProfile() {
    final location = widget.profile.supplier?.defaultPickupLocation;
    _countryController.text = location?.country ?? '';
    _cityController.text = location?.city ?? '';
    _areaController.text = location?.area ?? '';
    _addressLineController.text = location?.addressLine ?? '';
  }

  void _applyProfile(SupplierProfileResponse profile) {
    final supplier = profile.supplier;
    final location = supplier?.defaultPickupLocation;
    final organization = supplier?.organizationProfile;
    final businessLocation = organization?.businessLocation;

    _publicNameController.text = supplier?.publicName.isNotEmpty == true
        ? supplier!.publicName
        : profile.user.displayName;
    _descriptionController.text = supplier?.description ?? '';
    _countryController.text = location?.country ?? '';
    _cityController.text = location?.city ?? '';
    _areaController.text = location?.area ?? '';
    _addressLineController.text = location?.addressLine ?? '';
    _organizationNameController.text = organization?.organizationName ?? '';
    _contactPersonController.text = organization?.contactPersonName ?? '';
    _workingDaysController.text = organization?.workingDays?.join(', ') ?? '';
    _workingFromController.text =
        organization?.workingHours?['from']?.toString() ?? '';
    _workingToController.text =
        organization?.workingHours?['to']?.toString() ?? '';
    _businessCountryController.text = businessLocation?.country ?? '';
    _businessCityController.text = businessLocation?.city ?? '';
    _businessAreaController.text = businessLocation?.area ?? '';
    _businessAddressLineController.text = businessLocation?.addressLine ?? '';
    _supplierType = supplierTypeValues.contains(supplier?.supplierType)
        ? supplier!.supplierType
        : 'INDIVIDUAL_SUPPLIER';
    _visibility = location?.visibility ?? 'ORDER_ONLY';
    _isApproximate = location?.isApproximate ?? true;
    _useSeparateBusinessLocation = businessLocation != null;
    _latitude = location?.latitude;
    _longitude = location?.longitude;
    _locationInputMode = SupplierLocationInputMode.manual;
    _locationCapturedThisSession = false;
    _manualAddressEditedAfterCapture = false;
    _reverseGeocodeState = SupplierReverseGeocodeState.idle;
    _locationButtonState = SupplierLocationButtonState.idle;
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
        _draftTick++;
      });

      if (kDebugMode) {
        debugPrint(
          '[SupplierProfile] reverse geocode country=${result.country} '
          'city=${result.city} area=${result.area} '
          'address=${result.addressLine}',
        );
      }
    } catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _reverseGeocodeState = SupplierReverseGeocodeState.failure;
      });

      if (kDebugMode) {
        debugPrint('[SupplierProfile] reverse geocode failed: $error');
      }
    }
  }

  void _onPickupAddressFieldChanged() {
    if (_locationCapturedThisSession) {
      _manualAddressEditedAfterCapture = true;
    }
    setState(() => _draftTick++);
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
        _locationInputMode = SupplierLocationInputMode.currentLocation;
        _locationCapturedThisSession = true;
        _locationButtonState = SupplierLocationButtonState.captured;
        _clearManualAddressFields();
        _draftTick++;
      });

      if (kDebugMode) {
        debugPrint(
          '[SupplierProfile] form state lat=$_latitude lng=$_longitude '
          '(manual address fields cleared)',
        );
      }

      await _lookupAddressFromCoordinates(capture.latitude, capture.longitude);
    } on SupplierLocationException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _locationButtonState = SupplierLocationButtonState.idle;
        _locationCapturedThisSession = false;
        _manualAddressEditedAfterCapture = false;
        _reverseGeocodeState = SupplierReverseGeocodeState.idle;
        _restoreManualAddressFromProfile();
      });
      showSupplierErrorSnackBar(context, error.message);
    } catch (_) {
      if (!mounted) {
        return;
      }

      setState(() {
        _locationButtonState = SupplierLocationButtonState.idle;
        _locationCapturedThisSession = false;
        _manualAddressEditedAfterCapture = false;
        _reverseGeocodeState = SupplierReverseGeocodeState.idle;
        _restoreManualAddressFromProfile();
      });
      showSupplierErrorSnackBar(context, context.s.couldNotGetLocation);
    }
  }

  void _onLocationInputModeChanged(SupplierLocationInputMode mode) {
    if (mode == SupplierLocationInputMode.currentLocation) {
      setState(() {
        _locationInputMode = mode;
        _latitude = null;
        _longitude = null;
        _locationCapturedThisSession = false;
        _manualAddressEditedAfterCapture = false;
        _reverseGeocodeState = SupplierReverseGeocodeState.idle;
        _locationButtonState = SupplierLocationButtonState.idle;
        _clearManualAddressFields();
      });
      _captureCurrentLocation();
      return;
    }

    setState(() {
      _locationInputMode = mode;
      _locationCapturedThisSession = false;
      _manualAddressEditedAfterCapture = false;
      _reverseGeocodeState = SupplierReverseGeocodeState.idle;
      _locationButtonState = SupplierLocationButtonState.idle;
      if (_latitude == null && _longitude == null) {
        final savedLocation = widget.profile.supplier?.defaultPickupLocation;
        _latitude = savedLocation?.latitude;
        _longitude = savedLocation?.longitude;
      }
    });
  }

  @override
  void dispose() {
    _publicNameController.dispose();
    _descriptionController.dispose();
    _countryController.dispose();
    _cityController.dispose();
    _areaController.dispose();
    _addressLineController.dispose();
    _organizationNameController.dispose();
    _contactPersonController.dispose();
    _workingDaysController.dispose();
    _workingFromController.dispose();
    _workingToController.dispose();
    _businessCountryController.dispose();
    _businessCityController.dispose();
    _businessAreaController.dispose();
    _businessAddressLineController.dispose();
    super.dispose();
  }

  SupplierProfileDraft get _draft {
    final usesCoordinateSource = _locationInputMode ==
            SupplierLocationInputMode.currentLocation &&
        _locationCapturedThisSession &&
        _latitude != null &&
        _longitude != null;

    return SupplierProfileDraft(
      publicName: _publicNameController.text,
      supplierType: _supplierType,
      description: _descriptionController.text,
      country: _countryController.text,
      city: _cityController.text,
      area: _areaController.text,
      visibility: _visibility,
      latitude: _latitude,
      longitude: _longitude,
      usesCurrentLocationCoordinates: usesCoordinateSource,
    );
  }

  bool get _hasAutofilledOrEditedAddress {
    return _countryController.text.trim().isNotEmpty ||
        _cityController.text.trim().isNotEmpty ||
        _areaController.text.trim().isNotEmpty ||
        _addressLineController.text.trim().isNotEmpty;
  }

  String? _locationStatusMessage(SupplierL10n l) {
    if (_locationButtonState == SupplierLocationButtonState.loading) {
      return l.gettingLocation;
    }

    if (_reverseGeocodeState == SupplierReverseGeocodeState.loading) {
      return l.findingAddress;
    }

    if (_reverseGeocodeState == SupplierReverseGeocodeState.success) {
      return l.addressFoundFromLocation;
    }

    if (_reverseGeocodeState == SupplierReverseGeocodeState.failure &&
        _locationCapturedThisSession) {
      return l.addressLookupFailed;
    }

    if (_locationCapturedThisSession) {
      return l.locationCapturedOptionalDetails;
    }

    return null;
  }

  @override
  Widget build(BuildContext context) {
    final l = context.s;
    final profile = widget.profile;
    final supplier = profile.supplier;
    final isWide = MediaQuery.sizeOf(context).width >= 1024;
    final draft = _isEditing ? _draft : null;
    // Trigger rebuild when draft fields change during edit mode.
    final _ = _draftTick;
    final activeLatitude = _isEditing
        ? _latitude
        : supplier?.defaultPickupLocation?.latitude;
    final activeLongitude = _isEditing
        ? _longitude
        : supplier?.defaultPickupLocation?.longitude;
    final useCoordinateMapLabel = _isEditing &&
        _locationInputMode == SupplierLocationInputMode.currentLocation &&
        _locationCapturedThisSession &&
        activeLatitude != null &&
        activeLongitude != null &&
        !_hasAutofilledOrEditedAddress;
    final mapCityLabel = useCoordinateMapLabel
        ? ''
        : (draft?.city ?? supplier?.defaultPickupLocation?.city ?? '');
    final mapAreaLabel = useCoordinateMapLabel
        ? null
        : (draft?.area ?? supplier?.defaultPickupLocation?.area);

    final previewLocationLabel = useCoordinateMapLabel
        ? l.currentLocationLabel
        : null;

    final preview = SupplierProfilePreviewCard(
      publicName: draft?.publicName ??
          (supplier?.publicName.isNotEmpty == true
              ? supplier!.publicName
              : profile.user.displayName),
      supplierType: draft?.supplierType ?? supplier?.supplierType ?? _supplierType,
      verificationStatus: supplier?.verificationStatus ?? 'UNVERIFIED',
      description: draft?.description ?? supplier?.description,
      city: useCoordinateMapLabel
          ? null
          : (draft?.city ?? supplier?.defaultPickupLocation?.city),
      area: useCoordinateMapLabel
          ? null
          : (draft?.area ?? supplier?.defaultPickupLocation?.area),
      country: useCoordinateMapLabel
          ? null
          : (draft?.country ?? supplier?.defaultPickupLocation?.country),
      visibility: draft?.visibility ?? supplier?.defaultPickupLocation?.visibility,
      locationSummaryOverride: previewLocationLabel,
    );

    final sideColumn = Column(
      children: [
        ProfileCompletionCard(profile: profile, draft: draft),
        const SizedBox(height: AppSpacing.lg),
        SupplierVerificationCard(
          status: supplier?.verificationStatus ?? 'UNVERIFIED',
          adminNote: supplier?.verificationAdminNote,
        ),
        const SizedBox(height: AppSpacing.lg),
        SupplierLocationPrivacyCard(
          visibility: draft?.visibility ?? supplier?.defaultPickupLocation?.visibility,
        ),
        const SizedBox(height: AppSpacing.lg),
        SupplierPickupMapPreview(
          city: mapCityLabel,
          area: mapAreaLabel,
          country: useCoordinateMapLabel
              ? null
              : (draft?.country ?? supplier?.defaultPickupLocation?.country),
          visibility:
              draft?.visibility ?? supplier?.defaultPickupLocation?.visibility,
          latitude: activeLatitude,
          longitude: activeLongitude,
          showUseLocationButton: _isEditing && isWide,
          locationButtonState: _locationButtonState,
          onUseCurrentLocation: _captureCurrentLocation,
          showCoordinateDetails: _isEditing,
          showCoordinatesAsLabel: useCoordinateMapLabel,
        ),
        const SizedBox(height: AppSpacing.lg),
        const SupplierAccountSecurityCard(),
      ],
    );

    final mainColumn = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (!_isEditing && profile.hasSupplierProfile) ...[
          SupplierProfileIdentityCard(
            profile: profile,
            onEdit: () => setState(() => _isEditing = true),
          ),
          const SizedBox(height: AppSpacing.lg),
          preview,
          if (!isWide) ...[
            const SizedBox(height: AppSpacing.lg),
            SupplierPickupMap(
              latitude: supplier?.defaultPickupLocation?.latitude,
              longitude: supplier?.defaultPickupLocation?.longitude,
              fallbackCity: supplier?.defaultPickupLocation?.city,
              fallbackArea: supplier?.defaultPickupLocation?.area,
              fallbackCountry: supplier?.defaultPickupLocation?.country,
              visibility: supplier?.defaultPickupLocation?.visibility,
            ),
          ],
          const SizedBox(height: AppSpacing.lg),
        ],
        if (_isEditing) ...[
          if (profile.hasSupplierProfile) ...[
            preview,
            const SizedBox(height: AppSpacing.lg),
          ],
          SupplierProfileForm(
            formKey: _formKey,
            isSaving: _isSaving,
            hasExistingProfile: profile.hasSupplierProfile,
            publicNameController: _publicNameController,
            descriptionController: _descriptionController,
            countryController: _countryController,
            cityController: _cityController,
            areaController: _areaController,
            addressLineController: _addressLineController,
            supplierType: _supplierType,
            visibility: _visibility,
            isApproximate: _isApproximate,
            organizationNameController: _organizationNameController,
            contactPersonController: _contactPersonController,
            workingDaysController: _workingDaysController,
            workingFromController: _workingFromController,
            workingToController: _workingToController,
            useSeparateBusinessLocation: _useSeparateBusinessLocation,
            businessCountryController: _businessCountryController,
            businessCityController: _businessCityController,
            businessAreaController: _businessAreaController,
            businessAddressLineController: _businessAddressLineController,
            onSupplierTypeChanged: (value) => setState(() {
              _supplierType = value;
            }),
            onVisibilityChanged: (value) => setState(() {
              _visibility = value;
            }),
            onApproximateChanged: (value) => setState(() {
              _isApproximate = value;
            }),
            onSeparateBusinessLocationChanged: (value) => setState(() {
              _useSeparateBusinessLocation = value;
            }),
            onFieldChanged: () => setState(() => _draftTick++),
            onCancel: profile.hasSupplierProfile
                ? () {
                    _applyProfile(profile);
                    setState(() => _isEditing = false);
                  }
                : null,
            onSave: _saveProfile,
            locationInputMode: _locationInputMode,
            locationCapturedThisSession: _locationCapturedThisSession,
            reverseGeocodeState: _reverseGeocodeState,
            locationStatusMessage: _locationStatusMessage(l),
            onPickupAddressFieldChanged: _onPickupAddressFieldChanged,
            onLocationInputModeChanged: _onLocationInputModeChanged,
            showMapInForm: !isWide,
            showLocationButton: !isWide,
            latitude: _latitude,
            longitude: _longitude,
            locationButtonState: _locationButtonState,
            onUseCurrentLocation: _captureCurrentLocation,
          ),
        ],
      ],
    );

    return SingleChildScrollView(
      padding: context.supplierDecorations.pagePadding(compact: !isWide),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _PageIntro(hasProfile: profile.hasSupplierProfile),
          const SizedBox(height: AppSpacing.xl),
          if (isWide)
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(flex: 3, child: mainColumn),
                const SizedBox(width: AppSpacing.lg),
                Expanded(flex: 2, child: sideColumn),
              ],
            )
          else ...[
            mainColumn,
            const SizedBox(height: AppSpacing.xl),
            sideColumn,
          ],
        ],
      ),
    );
  }

  Future<void> _saveProfile() async {
    if (_isSaving) {
      return;
    }

    final usingCurrentLocation =
        _locationInputMode == SupplierLocationInputMode.currentLocation;
    final hasCoordinates = _latitude != null && _longitude != null;

    if (usingCurrentLocation &&
        (!_locationCapturedThisSession || !hasCoordinates)) {
      showSupplierErrorSnackBar(context, context.s.captureLocationBeforeSave);
      return;
    }

    if (!(_formKey.currentState?.validate() ?? false)) {
      return;
    }

    if (kDebugMode) {
      debugPrint(
        '[SupplierProfile] save payload lat=$_latitude lng=$_longitude '
        'city="${_cityController.text.trim()}" '
        'area="${_areaController.text.trim()}" '
        'address="${_addressLineController.text.trim()}" '
        'mode=$_locationInputMode captured=$_locationCapturedThisSession',
      );
    }

    setState(() => _isSaving = true);
    try {
      final request = _buildRequest();
      if (kDebugMode) {
        final loc = request.defaultPickupLocation;
        debugPrint(
          '[SupplierProfile] request location lat=${loc.latitude} '
          'lng=${loc.longitude} city="${loc.city}" area="${loc.area}" '
          'address="${loc.addressLine}"',
        );
      }
      await ref.read(supplierProfileRepositoryProvider).updateProfile(request);
      final refreshed = await ref.refresh(supplierProfileProvider.future);
      ref.invalidate(supplierDashboardProvider);
      if (mounted) {
        _applyProfile(refreshed);
        setState(() {
          _isSaving = false;
          _isEditing = false;
          _locationButtonState = SupplierLocationButtonState.idle;
        });
        showSupplierInfoSnackBar(context, context.s.profileUpdated);
      }
    } on ApiException catch (error) {
      _showSaveError(error.message);
    } catch (_) {
      _showSaveError(context.s.profileCouldNotSave);
    }
  }

  UpdateSupplierProfileRequest _buildRequest() {
    final organizationProfile = isOrganizationSupplierType(_supplierType)
        ? UpdateSupplierOrganizationProfileRequest(
            organizationName: _organizationNameController.text.trim(),
            organizationType: _supplierType,
            contactPersonName: _emptyToNull(_contactPersonController.text),
            workingDays: _workingDaysController.text
                .split(',')
                .map((item) => item.trim())
                .where((item) => item.isNotEmpty)
                .toList(),
            workingHours: {
              if (_workingFromController.text.trim().isNotEmpty)
                'from': _workingFromController.text.trim(),
              if (_workingToController.text.trim().isNotEmpty)
                'to': _workingToController.text.trim(),
            },
            businessLocation: _useSeparateBusinessLocation
                ? UpdateSupplierProfileLocationRequest(
                    country: _businessCountryController.text.trim(),
                    city: _businessCityController.text.trim(),
                    area: _emptyToNull(_businessAreaController.text),
                    addressLine: _emptyToNull(
                      _businessAddressLineController.text,
                    ),
                    visibility: _visibility,
                    isApproximate: _isApproximate,
                    locationType: 'BUSINESS_LOCATION',
                  )
                : null,
          )
        : null;

    return UpdateSupplierProfileRequest(
      publicName: _publicNameController.text.trim(),
      supplierType: _supplierType,
      description: _emptyToNull(_descriptionController.text),
      defaultPickupLocation: UpdateSupplierProfileLocationRequest(
        country: _countryController.text.trim(),
        city: _cityController.text.trim(),
        area: _emptyToNull(_areaController.text),
        addressLine: _emptyToNull(_addressLineController.text),
        latitude: _latitude,
        longitude: _longitude,
        visibility: _visibility,
        isApproximate: _isApproximate,
        locationType: 'PICKUP_POINT',
      ),
      organizationProfile: organizationProfile,
    );
  }

  String? _emptyToNull(String value) {
    final trimmed = value.trim();
    return trimmed.isEmpty ? null : trimmed;
  }

  void _showSaveError(String message) {
    if (!mounted) {
      return;
    }

    setState(() => _isSaving = false);
    showSupplierErrorSnackBar(context, message);
  }
}

class _PageIntro extends StatelessWidget {
  const _PageIntro({required this.hasProfile});

  final bool hasProfile;

  @override
  Widget build(BuildContext context) {
    final l = context.s;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.xl),
      decoration: context.supplierDecorations.profileGlassCard,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(l.supplierProfileTitle, style: context.supplierDisplay()),
          const SizedBox(height: AppSpacing.sm),
          Text(
            hasProfile ? l.profileIntroHasProfile : l.profileIntroNoProfile,
            style: context.supplierBody(),
          ),
        ],
      ),
    );
  }
}

class _SupplierProfileLoading extends StatelessWidget {
  const _SupplierProfileLoading();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: CircularProgressIndicator(color: context.supplierColors.accent),
    );
  }
}

class _SupplierProfileError extends ConsumerWidget {
  const _SupplierProfileError({required this.message});

  final String message;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.s;
    final colors = context.supplierColors;
    final decorations = context.supplierDecorations;

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Container(
          padding: const EdgeInsets.all(AppSpacing.lg),
          decoration: decorations.dashboardCard,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.error_outline,
                color: colors.error,
                size: 40,
              ),
              const SizedBox(height: AppSpacing.md),
              Text(
                l.profileUnavailable,
                style: context.supplierTitle(),
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                message,
                textAlign: TextAlign.center,
                style: context.supplierBody(),
              ),
              const SizedBox(height: AppSpacing.lg),
              OutlinedButton.icon(
                onPressed: () => ref.invalidate(supplierProfileProvider),
                icon: const Icon(Icons.refresh),
                label: Text(l.tryAgain),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
