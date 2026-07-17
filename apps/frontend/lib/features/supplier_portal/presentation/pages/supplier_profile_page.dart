import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../shared/widgets/app_section_card.dart';
import '../../../profile/application/profile_providers.dart';
import '../../application/supplier_verification_access.dart'
    show supplierVerificationPendingRoute, supplierVerificationStatusRoute;
import '../../data/supplier_location_service.dart';
import '../../data/models/reverse_geocode_result.dart';
import '../../data/models/supplier_profile.dart';
import '../../data/models/update_supplier_profile_request.dart';
import '../../data/supplier_profile_image_helper.dart';
import '../../data/supplier_profile_repository.dart';
import '../controllers/supplier_dashboard_providers.dart';
import '../controllers/supplier_profile_providers.dart';
import '../theme/supplier_theme_extension.dart';
import '../widgets/supplier_feedback.dart';
import '../widgets/supplier_location_input_mode.dart';
import '../widgets/supplier_pickup_map.dart';
import '../widgets/supplier_profile_edit_settings.dart';
import '../widgets/supplier_profile_form.dart';
import '../widgets/supplier_profile_view_widgets.dart';
import '../widgets/supplier_reverse_geocode_state.dart';
import '../widgets/supplier_type_selector.dart';

class SupplierProfilePage extends ConsumerWidget {
  const SupplierProfilePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(supplierProfileManagementProvider);

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

  final SupplierProfileManagement profile;

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
  bool _isUploadingAvatar = false;
  bool _isUploadingCover = false;
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
    final location = widget.profile.pickupLocation;
    _countryController.text = location?.country ?? '';
    _cityController.text = location?.city ?? '';
    _areaController.text = location?.area ?? '';
    _addressLineController.text = location?.addressLine ?? '';
  }

  void _applyProfile(SupplierProfileManagement profile) {
    final identity = profile.identity;
    final location = profile.pickupLocation;
    final organization = profile.organization;

    _publicNameController.text = identity?.publicName ?? '';
    _descriptionController.text = identity?.description ?? '';
    _countryController.text = location?.country ?? '';
    _cityController.text = location?.city ?? '';
    _areaController.text = location?.area ?? '';
    _addressLineController.text = location?.addressLine ?? '';
    _organizationNameController.text = organization?.organizationName ?? '';
    _contactPersonController.text = organization?.contactPersonName ?? '';
    _workingDaysController.text = organization?.workingDays?.join(', ') ?? '';
    _workingFromController.text =
        organization?.workingHours?['from']?.toString() ??
        organization?.workingHours?['start']?.toString() ??
        '';
    _workingToController.text =
        organization?.workingHours?['to']?.toString() ??
        organization?.workingHours?['end']?.toString() ??
        '';
    _businessCountryController.clear();
    _businessCityController.clear();
    _businessAreaController.clear();
    _businessAddressLineController.clear();
    _supplierType = supplierTypeValues.contains(identity?.supplierType)
        ? identity!.supplierType
        : 'INDIVIDUAL_SUPPLIER';
    final visibility = location?.visibility?.trim().toUpperCase();
    _visibility = const {'PUBLIC', 'ORDER_ONLY', 'PRIVATE'}.contains(visibility)
        ? visibility!
        : 'ORDER_ONLY';
    _isApproximate = location?.isApproximate ?? true;
    _useSeparateBusinessLocation = false;
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
        final savedLocation = widget.profile.pickupLocation;
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

  Future<void> _uploadProfileImage(SupplierProfileImageKind kind) async {
    if (_isUploadingAvatar || _isUploadingCover) {
      return;
    }

    setState(() {
      if (kind == SupplierProfileImageKind.avatar) {
        _isUploadingAvatar = true;
      } else {
        _isUploadingCover = true;
      }
    });

    try {
      final helper = SupplierProfileImageHelper(
        ref.read(supplierProfileRepositoryProvider),
        ref.read(profileRepositoryProvider),
      );
      await helper.pickUploadAndSave(kind);
      ref.invalidate(supplierProfileManagementProvider);
      await ref.read(supplierProfileManagementProvider.future);
      if (kind == SupplierProfileImageKind.avatar) {
        ref.invalidate(supplierProfileProvider);
      }
      if (!mounted) {
        return;
      }
      showSupplierInfoSnackBar(
        context,
        kind == SupplierProfileImageKind.avatar
            ? 'Profile photo updated'
            : 'Cover image updated',
      );
    } on ApiException catch (error) {
      if (mounted) {
        showSupplierErrorSnackBar(context, error.message);
      }
    } catch (_) {
      if (mounted) {
        showSupplierErrorSnackBar(context, context.s.profileCouldNotSave);
      }
    } finally {
      if (mounted) {
        setState(() {
          _isUploadingAvatar = false;
          _isUploadingCover = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.s;
    final profile = widget.profile;
    final isWide = MediaQuery.sizeOf(context).width >= 1024;
    final verificationAction = profile.verification.canResubmit
        ? () => context.go(supplierVerificationStatusRoute)
        : profile.verification.canSubmit
        ? () => context.go(supplierVerificationPendingRoute)
        : null;

    if (_isEditing) {
      return SingleChildScrollView(
        padding: context.supplierDecorations.pagePadding(compact: !isWide),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (profile.hasSupplierProfile) ...[
              Row(
                children: [
                  Expanded(
                    child: Text(
                      l.editSupplierProfile,
                      style: context.supplierTitle(),
                    ),
                  ),
                  TextButton(
                    onPressed: _isSaving
                        ? null
                        : () {
                            _applyProfile(profile);
                            setState(() => _isEditing = false);
                          },
                    child: Text(l.cancel),
                  ),
                ],
              ),
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
              showMapInForm: true,
              showLocationButton: true,
              latitude: _latitude,
              longitude: _longitude,
              locationButtonState: _locationButtonState,
              onUseCurrentLocation: _captureCurrentLocation,
            ),
            if (profile.hasSupplierProfile) ...[
              const SizedBox(height: AppSpacing.xl),
              SupplierProfileEditSettings(
                onChangeAvatar: () =>
                    _uploadProfileImage(SupplierProfileImageKind.avatar),
                onChangeCover: () =>
                    _uploadProfileImage(SupplierProfileImageKind.cover),
                isUploadingAvatar: _isUploadingAvatar,
                isUploadingCover: _isUploadingCover,
              ),
            ],
          ],
        ),
      );
    }

    if (!profile.hasSupplierProfile) {
      return SingleChildScrollView(
        padding: context.supplierDecorations.pagePadding(compact: !isWide),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(l.profileIntroNoProfile, style: context.supplierBody()),
            const SizedBox(height: AppSpacing.lg),
            SupplierProfileForm(
              formKey: _formKey,
              isSaving: _isSaving,
              hasExistingProfile: false,
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
              onCancel: null,
              onSave: _saveProfile,
              locationInputMode: _locationInputMode,
              locationCapturedThisSession: _locationCapturedThisSession,
              reverseGeocodeState: _reverseGeocodeState,
              locationStatusMessage: _locationStatusMessage(l),
              onPickupAddressFieldChanged: _onPickupAddressFieldChanged,
              onLocationInputModeChanged: _onLocationInputModeChanged,
              showMapInForm: true,
              showLocationButton: true,
              latitude: _latitude,
              longitude: _longitude,
              locationButtonState: _locationButtonState,
              onUseCurrentLocation: _captureCurrentLocation,
            ),
          ],
        ),
      );
    }

    return SingleChildScrollView(
      padding: context.supplierDecorations.pagePadding(compact: !isWide),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SupplierProfileHeader(
            profile: profile,
            onEdit: () => setState(() => _isEditing = true),
            onChangeAvatar: () =>
                _uploadProfileImage(SupplierProfileImageKind.avatar),
            onChangeCover: () =>
                _uploadProfileImage(SupplierProfileImageKind.cover),
            isUploadingAvatar: _isUploadingAvatar,
            isUploadingCover: _isUploadingCover,
          ),
          const SizedBox(height: AppSpacing.lg),
          const SizedBox(height: AppSpacing.xl),
          ProfileDetailsSection(
            profile: profile,
            onEdit: () => setState(() => _isEditing = true),
            onVerificationAction: verificationAction,
          ),
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
      final refreshed = await ref.refresh(
        supplierProfileManagementProvider.future,
      );
      ref.invalidate(supplierDashboardProvider);
      if (!mounted) {
        return;
      }
      _applyProfile(refreshed);
      setState(() {
        _isSaving = false;
        _isEditing = false;
        _locationButtonState = SupplierLocationButtonState.idle;
      });
      showSupplierInfoSnackBar(context, context.s.profileUpdated);
    } on ApiException catch (error) {
      if (mounted) {
        _showSaveError(error.message);
      }
    } catch (_) {
      if (mounted) {
        _showSaveError(context.s.profileCouldNotSave);
      }
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

class _SupplierProfileLoading extends StatelessWidget {
  const _SupplierProfileLoading();

  @override
  Widget build(BuildContext context) => const SupplierProfileLoadingSkeleton();
}

class _SupplierProfileError extends ConsumerWidget {
  const _SupplierProfileError({required this.message});

  final String message;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.s;
    final colors = context.supplierColors;

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: AppSectionCard(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.error_outline, color: colors.error, size: 40),
              const SizedBox(height: AppSpacing.md),
              Text(
                l.t('Couldn’t load supplier profile', 'تعذّر تحميل ملف المورد'),
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
                onPressed: () =>
                    ref.invalidate(supplierProfileManagementProvider),
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
