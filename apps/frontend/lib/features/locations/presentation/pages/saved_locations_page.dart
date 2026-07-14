import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:latlong2/latlong.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../shared/widgets/app_dialog_footer.dart';
import '../../../../shared/widgets/app_dialog_shell.dart';
import '../../../../shared/widgets/app_feedback.dart';
import '../../../../shared/widgets/app_inline_error.dart';
import '../../../../shared/widgets/app_primary_button.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/app_text_field.dart';
import '../../../profile/presentation/widgets/profile_image_picker.dart';
import '../../application/saved_locations_providers.dart';
import '../../data/forward_geocode_result.dart';
import '../../data/reverse_geocode_result.dart';
import '../../data/saved_location.dart';

const _palestineFallbackCenter = LatLng(31.9522, 35.2332);
const _nablusFallbackCenter = LatLng(32.2211, 35.2544);

class SavedLocationsPage extends ConsumerStatefulWidget {
  const SavedLocationsPage({super.key});

  @override
  ConsumerState<SavedLocationsPage> createState() => _SavedLocationsPageState();
}

class _SavedLocationsPageState extends ConsumerState<SavedLocationsPage> {
  String? _busyLocationId;

  Future<void> _openCreateDialog() async {
    final saved = await showDialog<bool>(
      context: context,
      builder: (context) => const _SavedLocationFormDialog(),
    );

    if (!mounted || saved != true) {
      return;
    }

    showInfoSnackBar(context, 'Saved location created.');
  }

  Future<void> _openEditDialog(SavedLocation location) async {
    final saved = await showDialog<bool>(
      context: context,
      builder: (context) => _SavedLocationFormDialog(location: location),
    );

    if (!mounted || saved != true) {
      return;
    }

    showInfoSnackBar(context, 'Saved location updated.');
  }

  Future<void> _setDefault(SavedLocation location) async {
    if (location.isDefault || _busyLocationId != null) {
      return;
    }

    setState(() => _busyLocationId = 'default:${location.id}');

    try {
      await ref
          .read(savedLocationsControllerProvider.notifier)
          .setDefault(location.id);

      if (!mounted) {
        return;
      }

      showInfoSnackBar(context, 'Default location updated.');
    } on ApiException catch (error) {
      if (mounted) {
        showErrorSnackBar(context, error);
      }
    } catch (_) {
      if (mounted) {
        showErrorSnackBar(context, 'Could not update the default location.');
      }
    } finally {
      if (mounted) {
        setState(() => _busyLocationId = null);
      }
    }
  }

  Future<void> _deleteLocation(SavedLocation location) async {
    if (_busyLocationId != null) {
      return;
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => _DeleteSavedLocationDialog(location: location),
    );

    if (confirmed != true || !mounted) {
      return;
    }

    setState(() => _busyLocationId = 'delete:${location.id}');

    try {
      await ref
          .read(savedLocationsControllerProvider.notifier)
          .delete(location.id);

      if (!mounted) {
        return;
      }

      showInfoSnackBar(context, 'Saved location deleted.');
    } on ApiException catch (error) {
      if (mounted) {
        showErrorSnackBar(context, error);
      }
    } catch (_) {
      if (mounted) {
        showErrorSnackBar(context, 'Could not delete the saved location.');
      }
    } finally {
      if (mounted) {
        setState(() => _busyLocationId = null);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final locationsAsync = ref.watch(savedLocationsProvider);

    return ProfileSubpageScaffold(
      title: 'Saved locations',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _PrivacyNotice(),
          const SizedBox(height: AppSpacing.md),
          locationsAsync.when(
            data: (locations) => _SavedLocationsContent(
              locations: locations,
              busyLocationId: _busyLocationId,
              onCreate: _openCreateDialog,
              onEdit: _openEditDialog,
              onDelete: _deleteLocation,
              onSetDefault: _setDefault,
            ),
            loading: () => const _SavedLocationsLoading(),
            error: (error, _) => _SavedLocationsError(
              message: userFriendlyErrorMessage(error),
              onRetry: () => ref.invalidate(savedLocationsProvider),
            ),
          ),
        ],
      ),
    );
  }
}

class _SavedLocationsContent extends StatelessWidget {
  const _SavedLocationsContent({
    required this.locations,
    required this.busyLocationId,
    required this.onCreate,
    required this.onEdit,
    required this.onDelete,
    required this.onSetDefault,
  });

  final List<SavedLocation> locations;
  final String? busyLocationId;
  final VoidCallback onCreate;
  final ValueChanged<SavedLocation> onEdit;
  final ValueChanged<SavedLocation> onDelete;
  final ValueChanged<SavedLocation> onSetDefault;

  @override
  Widget build(BuildContext context) {
    if (locations.isEmpty) {
      return _EmptySavedLocations(onCreate: onCreate);
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Align(
          alignment: AlignmentDirectional.centerEnd,
          child: FilledButton.icon(
            onPressed: onCreate,
            icon: const Icon(Icons.add_location_alt_outlined),
            label: const Text('Add location'),
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        for (final location in locations) ...[
          _SavedLocationCard(
            location: location,
            busyLocationId: busyLocationId,
            onEdit: () => onEdit(location),
            onDelete: () => onDelete(location),
            onSetDefault: () => onSetDefault(location),
          ),
          const SizedBox(height: AppSpacing.sm),
        ],
      ],
    );
  }
}

class _SavedLocationCard extends StatelessWidget {
  const _SavedLocationCard({
    required this.location,
    required this.busyLocationId,
    required this.onEdit,
    required this.onDelete,
    required this.onSetDefault,
  });

  final SavedLocation location;
  final String? busyLocationId;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  final VoidCallback onSetDefault;

  bool get _isDeleting => busyLocationId == 'delete:${location.id}';

  bool get _isSettingDefault => busyLocationId == 'default:${location.id}';

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.cardSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(
          color: location.isDefault ? colors.primary : colors.borderSubtle,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: colors.primarySoft,
                  borderRadius: AppRadius.mdAll,
                ),
                child: Icon(
                  location.isDefault
                      ? Icons.home_outlined
                      : Icons.location_on_outlined,
                  color: colors.primary,
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Wrap(
                      spacing: AppSpacing.sm,
                      runSpacing: AppSpacing.xs,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Text(
                          location.label,
                          style: AppTextStyles.title(context).copyWith(
                            color: colors.textPrimary,
                            fontSize: 18,
                            letterSpacing: 0,
                          ),
                        ),
                        if (location.isDefault) const _DefaultBadge(),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      _locationSummary(location),
                      style: AppTextStyles.body(
                        context,
                      ).copyWith(color: colors.textSecondary),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (_privateDetails(location).isNotEmpty) ...[
            const SizedBox(height: AppSpacing.md),
            Container(
              width: double.infinity,
              padding: const EdgeInsetsDirectional.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: colors.surfaceMuted,
                borderRadius: AppRadius.mdAll,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Private exact details',
                    style: AppTextStyles.label(context).copyWith(
                      color: colors.textPrimary,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  for (final detail in _privateDetails(location))
                    Padding(
                      padding: const EdgeInsetsDirectional.only(
                        bottom: AppSpacing.xs,
                      ),
                      child: Text(
                        detail,
                        style: AppTextStyles.label(context).copyWith(
                          color: colors.textSecondary,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 0,
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ],
          const SizedBox(height: AppSpacing.md),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.xs,
            children: [
              OutlinedButton.icon(
                onPressed: onEdit,
                style: AppStatusButtonStyle.outlined(
                  context,
                  AppStatusTone.neutral,
                ),
                icon: const Icon(Icons.edit_location_alt_outlined, size: 18),
                label: const Text('Edit'),
              ),
              OutlinedButton.icon(
                onPressed: location.isDefault || _isSettingDefault
                    ? null
                    : onSetDefault,
                style: AppStatusButtonStyle.outlined(
                  context,
                  AppStatusTone.primary,
                ),
                icon: _isSettingDefault
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.check_circle_outline, size: 18),
                label: const Text('Set default'),
              ),
              TextButton.icon(
                onPressed: _isDeleting ? null : onDelete,
                icon: _isDeleting
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.delete_outline, size: 18),
                label: const Text('Delete'),
                style: AppStatusButtonStyle.text(context, AppStatusTone.danger),
              ),
            ],
          ),
        ],
      ),
    );
  }

  static String _locationSummary(SavedLocation location) {
    return [
      location.city,
      if (location.area != null && location.area!.isNotEmpty) location.area!,
      location.country,
    ].join(' - ');
  }

  static List<String> _privateDetails(SavedLocation location) {
    final details = <String>[];
    final addressLine = location.addressLine?.trim();
    if (addressLine != null && addressLine.isNotEmpty) {
      details.add('Address: $addressLine');
    }
    if (location.latitude != null && location.longitude != null) {
      details.add(
        'Coordinates: ${location.latitude!.toStringAsFixed(6)}, '
        '${location.longitude!.toStringAsFixed(6)}',
      );
    }
    return details;
  }
}

class _SavedLocationFormDialog extends ConsumerStatefulWidget {
  const _SavedLocationFormDialog({this.location});

  final SavedLocation? location;

  @override
  ConsumerState<_SavedLocationFormDialog> createState() =>
      _SavedLocationFormDialogState();
}

class _SavedLocationFormDialogState
    extends ConsumerState<_SavedLocationFormDialog> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _labelController;
  late final TextEditingController _countryController;
  late final TextEditingController _cityController;
  late final TextEditingController _areaController;
  late final TextEditingController _addressController;
  late final TextEditingController _latitudeController;
  late final TextEditingController _longitudeController;

  bool _isDefault = false;
  bool _isSubmitting = false;
  bool _isReverseGeocoding = false;
  bool _isForwardGeocoding = false;
  String? _formError;
  String? _labelError;
  String? _cityError;
  String? _latitudeError;
  String? _longitudeError;

  bool get _isEditing => widget.location != null;

  @override
  void initState() {
    super.initState();
    final location = widget.location;
    _labelController = TextEditingController(text: location?.label ?? '');
    _countryController = TextEditingController(
      text: location?.country ?? 'Palestine',
    );
    _cityController = TextEditingController(text: location?.city ?? '');
    _areaController = TextEditingController(text: location?.area ?? '');
    _addressController = TextEditingController(
      text: location?.addressLine ?? '',
    );
    _latitudeController = TextEditingController(
      text: location?.latitude?.toString() ?? '',
    );
    _longitudeController = TextEditingController(
      text: location?.longitude?.toString() ?? '',
    );
    _isDefault = location?.isDefault ?? false;
  }

  @override
  void dispose() {
    _labelController.dispose();
    _countryController.dispose();
    _cityController.dispose();
    _areaController.dispose();
    _addressController.dispose();
    _latitudeController.dispose();
    _longitudeController.dispose();
    super.dispose();
  }

  void _clearServerErrors() {
    if (_formError == null &&
        _labelError == null &&
        _cityError == null &&
        _latitudeError == null &&
        _longitudeError == null) {
      return;
    }

    setState(() {
      _formError = null;
      _labelError = null;
      _cityError = null;
      _latitudeError = null;
      _longitudeError = null;
    });
  }

  Future<void> _setCoordinatesFromMap(LatLng point) async {
    setState(() {
      _latitudeController.text = point.latitude.toStringAsFixed(6);
      _longitudeController.text = point.longitude.toStringAsFixed(6);
      _latitudeError = null;
      _longitudeError = null;
      _formError = null;
      _isReverseGeocoding = true;
    });

    try {
      final result = await ref
          .read(savedLocationsApiProvider)
          .reverseGeocode(latitude: point.latitude, longitude: point.longitude);

      if (!mounted) {
        return;
      }

      _applyReverseGeocodeResult(result);
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _formError =
            'Coordinates were selected, but address lookup failed: ${error.displayMessage}';
      });
    } catch (_) {
      if (!mounted) {
        return;
      }

      setState(() {
        _formError =
            'Coordinates were selected, but address lookup failed. You can save them manually.';
      });
    } finally {
      if (mounted) {
        setState(() => _isReverseGeocoding = false);
      }
    }
  }

  Future<void> _setCoordinatesFromTypedAddress() async {
    if (_isForwardGeocoding || _isReverseGeocoding) {
      return;
    }

    final city = _cityController.text.trim();
    if (city.isEmpty) {
      setState(() {
        _cityError = 'City is required before looking up coordinates';
      });
      return;
    }

    setState(() {
      _formError = null;
      _cityError = null;
      _latitudeError = null;
      _longitudeError = null;
      _isForwardGeocoding = true;
    });

    try {
      final result = await ref
          .read(savedLocationsApiProvider)
          .forwardGeocode(
            country: _countryController.text.trim().isEmpty
                ? 'Palestine'
                : _countryController.text.trim(),
            city: city,
            area: _areaController.text,
            addressLine: _addressController.text,
          );

      if (!mounted) {
        return;
      }

      _applyForwardGeocodeResult(result);
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _formError =
            'Could not find coordinates for this typed address: ${error.displayMessage}';
      });
    } catch (_) {
      if (!mounted) {
        return;
      }

      setState(() {
        _formError =
            'Could not find coordinates for this typed address. Try adding area/street details or pick a point on the map.';
      });
    } finally {
      if (mounted) {
        setState(() => _isForwardGeocoding = false);
      }
    }
  }

  void _applyReverseGeocodeResult(ReverseGeocodeResult result) {
    setState(() {
      if (result.country != null) {
        _countryController.text = result.country!;
      }
      if (result.city != null) {
        _cityController.text = result.city!;
        _cityError = null;
      }
      if (result.area != null) {
        _areaController.text = result.area!;
      }
      if (result.addressLine != null) {
        _addressController.text = result.addressLine!;
      }
    });
  }

  void _applyForwardGeocodeResult(ForwardGeocodeResult result) {
    setState(() {
      _latitudeController.text = result.latitude.toStringAsFixed(6);
      _longitudeController.text = result.longitude.toStringAsFixed(6);
      _latitudeError = null;
      _longitudeError = null;

      if (result.country != null) {
        _countryController.text = result.country!;
      }
      if (result.city != null) {
        _cityController.text = result.city!;
        _cityError = null;
      }
      if (result.area != null) {
        _areaController.text = result.area!;
      }
      if (result.addressLine != null) {
        _addressController.text = result.addressLine!;
      }
    });
  }

  Future<void> _openMapPicker() async {
    final point = await showDialog<LatLng>(
      context: context,
      builder: (context) => _SavedLocationMapDialog(
        latitude: _parseOptionalCoordinate(_latitudeController.text),
        longitude: _parseOptionalCoordinate(_longitudeController.text),
        city: _cityController.text,
        area: _areaController.text,
        country: _countryController.text,
      ),
    );

    if (point == null || !mounted) {
      return;
    }

    await _setCoordinatesFromMap(point);
  }

  Future<void> _submit() async {
    _clearServerErrors();

    if (_isSubmitting || !(_formKey.currentState?.validate() ?? false)) {
      return;
    }

    final latitude = _parseCoordinate(_latitudeController.text);
    final longitude = _parseCoordinate(_longitudeController.text);
    final payload = SavedLocationPayload(
      label: _labelController.text.trim(),
      country: _countryController.text.trim().isEmpty
          ? 'Palestine'
          : _countryController.text.trim(),
      city: _cityController.text.trim(),
      area: _areaController.text.trim(),
      addressLine: _addressController.text.trim(),
      latitude: latitude,
      longitude: longitude,
      isDefault: _isDefault,
    );

    setState(() => _isSubmitting = true);

    try {
      final controller = ref.read(savedLocationsControllerProvider.notifier);
      if (_isEditing) {
        await controller.update(widget.location!.id, payload);
      } else {
        await controller.create(payload);
      }

      if (!mounted) {
        return;
      }

      Navigator.of(context).pop(true);
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _isSubmitting = false;
        _labelError = firstFieldError(error, const ['label']);
        _cityError = firstFieldError(error, const ['city']);
        _latitudeError = firstFieldError(error, const ['latitude']);
        _longitudeError = firstFieldError(error, const ['longitude']);
        _formError =
            _labelError == null &&
                _cityError == null &&
                _latitudeError == null &&
                _longitudeError == null
            ? error.displayMessage
            : null;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }

      setState(() {
        _isSubmitting = false;
        _formError = _isEditing
            ? 'Could not update this saved location.'
            : 'Could not create this saved location.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return AppDialogShell(
      title: Text(_isEditing ? 'Edit saved location' : 'Add saved location'),
      maxWidth: 520,
      onClose: () => Navigator.of(context).pop(),
      closeEnabled: !_isSubmitting,
      content: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AppTextField(
              controller: _labelController,
              label: 'Label',
              hint: 'Home, Workshop, Campus',
              textInputAction: TextInputAction.next,
              errorText: _labelError,
              validator: _required('Label is required'),
              onChanged: (_) => _clearServerErrors(),
            ),
            const AppFieldGap(),
            AppTextField(
              controller: _cityController,
              label: 'City',
              textInputAction: TextInputAction.next,
              errorText: _cityError,
              validator: _required('City is required'),
              onChanged: (_) => _clearServerErrors(),
            ),
            const AppFieldGap(),
            AppTextField(
              controller: _areaController,
              label: 'Area',
              hint: 'Optional',
              textInputAction: TextInputAction.next,
              onChanged: (_) => _clearServerErrors(),
            ),
            const AppFieldGap(),
            AppTextField(
              controller: _addressController,
              label: 'Exact address',
              hint: 'Private, optional',
              textInputAction: TextInputAction.next,
              onChanged: (_) => _clearServerErrors(),
            ),
            const AppFieldGap(),
            AppTextField(
              controller: _countryController,
              label: 'Country',
              textInputAction: TextInputAction.next,
              validator: _required('Country is required'),
              onChanged: (_) => _clearServerErrors(),
            ),
            const AppFieldGap(),
            AppTextField(
              controller: _latitudeController,
              label: 'Latitude',
              hint: 'Optional exact coordinate',
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
                signed: true,
              ),
              textInputAction: TextInputAction.next,
              errorText: _latitudeError,
              validator: (value) => _validateCoordinate(
                value,
                min: -90,
                max: 90,
                missingPairController: _longitudeController,
                missingPairMessage: 'Longitude is required with latitude',
              ),
              onChanged: (_) {
                _clearServerErrors();
                setState(() {});
              },
            ),
            const AppFieldGap(),
            AppTextField(
              controller: _longitudeController,
              label: 'Longitude',
              hint: 'Optional exact coordinate',
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
                signed: true,
              ),
              textInputAction: TextInputAction.done,
              errorText: _longitudeError,
              validator: (value) => _validateCoordinate(
                value,
                min: -180,
                max: 180,
                missingPairController: _latitudeController,
                missingPairMessage: 'Latitude is required with longitude',
              ),
              onFieldSubmitted: (_) => _submit(),
              onChanged: (_) {
                _clearServerErrors();
                setState(() {});
              },
            ),
            const SizedBox(height: AppSpacing.md),
            _SavedLocationMapLauncher(
              latitude: _parseOptionalCoordinate(_latitudeController.text),
              longitude: _parseOptionalCoordinate(_longitudeController.text),
              isForwardGeocoding: _isForwardGeocoding,
              isReverseGeocoding: _isReverseGeocoding,
              onFindTypedAddress: _setCoordinatesFromTypedAddress,
              onPickMap: _openMapPicker,
            ),
            const SizedBox(height: AppSpacing.sm),
            CheckboxListTile(
              contentPadding: EdgeInsets.zero,
              value: _isDefault,
              onChanged: (value) {
                setState(() => _isDefault = value ?? false);
              },
              title: const Text('Use as default saved location'),
              controlAffinity: ListTileControlAffinity.leading,
            ),
            if (_formError != null) ...[
              const SizedBox(height: AppSpacing.sm),
              AppInlineError(message: _formError!),
            ],
          ],
        ),
      ),
      footer: AppDialogFooter.form(
        primaryAction: FilledButton(
          onPressed: _isSubmitting ? null : _submit,
          style: AppStatusButtonStyle.filled(context, AppStatusTone.primary),
          child: _isSubmitting
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : Text(_isEditing ? 'Save changes' : 'Create location'),
        ),
      ),
    );
  }

  String? Function(String?) _required(String message) {
    return (value) {
      if (value == null || value.trim().isEmpty) {
        return message;
      }
      return null;
    };
  }

  String? _validateCoordinate(
    String? value, {
    required double min,
    required double max,
    required TextEditingController missingPairController,
    required String missingPairMessage,
  }) {
    final normalized = value?.trim() ?? '';
    final pairValue = missingPairController.text.trim();

    if (normalized.isEmpty) {
      return pairValue.isEmpty ? null : missingPairMessage;
    }

    final parsed = double.tryParse(normalized);
    if (parsed == null) {
      return 'Enter a valid number';
    }
    if (parsed < min || parsed > max) {
      return 'Must be between ${min.toStringAsFixed(0)} and ${max.toStringAsFixed(0)}';
    }

    return null;
  }

  double? _parseCoordinate(String value) {
    final normalized = value.trim();
    return normalized.isEmpty ? null : double.parse(normalized);
  }

  double? _parseOptionalCoordinate(String value) {
    return double.tryParse(value.trim());
  }
}

class _SavedLocationMapLauncher extends StatelessWidget {
  const _SavedLocationMapLauncher({
    required this.latitude,
    required this.longitude,
    required this.isForwardGeocoding,
    required this.isReverseGeocoding,
    required this.onFindTypedAddress,
    required this.onPickMap,
  });

  final double? latitude;
  final double? longitude;
  final bool isForwardGeocoding;
  final bool isReverseGeocoding;
  final VoidCallback onFindTypedAddress;
  final VoidCallback onPickMap;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final hasCoordinates = latitude != null && longitude != null;
    final isLookingUp = isForwardGeocoding || isReverseGeocoding;

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: colors.surfaceMuted,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: colors.borderSubtle),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.map_outlined, color: colors.primary),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Map point',
                  style: AppTextStyles.label(context).copyWith(
                    color: colors.textPrimary,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0,
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  isForwardGeocoding
                      ? 'Finding coordinates from typed address...'
                      : isReverseGeocoding
                      ? 'Looking up address for selected point...'
                      : hasCoordinates
                      ? '${latitude!.toStringAsFixed(6)}, ${longitude!.toStringAsFixed(6)}'
                      : 'Type city/area/street to find coordinates, or pick a point on the map.',
                  style: AppTextStyles.label(context).copyWith(
                    color: colors.textSecondary,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0,
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                Wrap(
                  spacing: AppSpacing.sm,
                  runSpacing: AppSpacing.xs,
                  children: [
                    OutlinedButton.icon(
                      onPressed: isLookingUp ? null : onFindTypedAddress,
                      icon: const Icon(Icons.travel_explore_rounded, size: 18),
                      label: const Text('Find typed address'),
                    ),
                    OutlinedButton.icon(
                      onPressed: isLookingUp ? null : onPickMap,
                      icon: const Icon(
                        Icons.add_location_alt_outlined,
                        size: 18,
                      ),
                      label: Text(
                        hasCoordinates ? 'Change map point' : 'Pick on map',
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          if (isLookingUp)
            const SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
        ],
      ),
    );
  }
}

class _SavedLocationMapDialog extends StatelessWidget {
  const _SavedLocationMapDialog({
    required this.latitude,
    required this.longitude,
    required this.city,
    required this.area,
    required this.country,
  });

  final double? latitude;
  final double? longitude;
  final String city;
  final String area;
  final String country;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return AppDialogShell(
      title: Text(
        'Pick exact point',
        style: AppTextStyles.title(
          context,
        ).copyWith(color: colors.textPrimary, fontSize: 22),
      ),
      maxWidth: 680,
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Tap the map to set private exact coordinates. The app will reverse-geocode the point into readable fields when possible.',
            style: AppTextStyles.body(
              context,
            ).copyWith(color: colors.textSecondary),
          ),
          const SizedBox(height: AppSpacing.md),
          _SavedLocationMapPicker(
            latitude: latitude,
            longitude: longitude,
            city: city,
            area: area,
            country: country,
            isReverseGeocoding: false,
            onPointSelected: (point) => Navigator.of(context).pop(point),
          ),
        ],
      ),
    );
  }
}

class _SavedLocationMapPicker extends StatefulWidget {
  const _SavedLocationMapPicker({
    required this.latitude,
    required this.longitude,
    required this.city,
    required this.area,
    required this.country,
    required this.isReverseGeocoding,
    required this.onPointSelected,
  });

  final double? latitude;
  final double? longitude;
  final String city;
  final String area;
  final String country;
  final bool isReverseGeocoding;
  final ValueChanged<LatLng> onPointSelected;

  bool get hasCoordinates => latitude != null && longitude != null;

  @override
  State<_SavedLocationMapPicker> createState() =>
      _SavedLocationMapPickerState();
}

class _SavedLocationMapPickerState extends State<_SavedLocationMapPicker> {
  final MapController _mapController = MapController();

  LatLng get _fallbackCenter {
    final city = widget.city.trim().toLowerCase();
    return city == 'nablus' ? _nablusFallbackCenter : _palestineFallbackCenter;
  }

  LatLng get _center => widget.hasCoordinates
      ? LatLng(widget.latitude!, widget.longitude!)
      : _fallbackCenter;

  double get _zoom {
    if (widget.hasCoordinates) {
      return 15;
    }
    return widget.city.trim().toLowerCase() == 'nablus' ? 12 : 8;
  }

  String get _summary {
    if (widget.hasCoordinates) {
      return '${widget.latitude!.toStringAsFixed(6)}, '
          '${widget.longitude!.toStringAsFixed(6)}';
    }

    final parts = [
      if (widget.city.trim().isNotEmpty) widget.city.trim(),
      if (widget.area.trim().isNotEmpty) widget.area.trim(),
      if (widget.country.trim().isNotEmpty) widget.country.trim(),
    ];
    return parts.isEmpty
        ? 'Tap the map to choose exact coordinates.'
        : parts.join(' - ');
  }

  @override
  void didUpdateWidget(covariant _SavedLocationMapPicker oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.latitude != widget.latitude ||
        oldWidget.longitude != widget.longitude ||
        oldWidget.city != widget.city) {
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
      _mapController.move(_center, _zoom);
    } catch (_) {
      // The map can be between frames while the dialog is resizing.
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: colors.surfaceMuted,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: colors.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.map_outlined, color: colors.primary, size: 20),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Pick exact point on map',
                      style: AppTextStyles.label(context).copyWith(
                        color: colors.textPrimary,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      widget.isReverseGeocoding
                          ? 'Looking up address for selected point...'
                          : _summary,
                      style: AppTextStyles.label(context).copyWith(
                        color: colors.textSecondary,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 0,
                      ),
                    ),
                  ],
                ),
              ),
              if (widget.isReverseGeocoding)
                const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          SizedBox(
            height: 220,
            child: ClipRRect(
              borderRadius: AppRadius.mdAll,
              child: FlutterMap(
                mapController: _mapController,
                options: MapOptions(
                  initialCenter: _center,
                  initialZoom: _zoom,
                  minZoom: 5,
                  maxZoom: 18,
                  onTap: (_, point) => widget.onPointSelected(point),
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
                  if (widget.hasCoordinates)
                    MarkerLayer(
                      markers: [
                        Marker(
                          point: LatLng(widget.latitude!, widget.longitude!),
                          width: 42,
                          height: 42,
                          alignment: Alignment.topCenter,
                          child: _SavedLocationMarker(),
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
          const SizedBox(height: AppSpacing.xs),
          Text(
            'Tap the map to set private exact coordinates. The app will reverse-geocode the point into readable fields when possible.',
            style: AppTextStyles.label(context).copyWith(
              color: colors.textMuted,
              fontWeight: FontWeight.w600,
              letterSpacing: 0,
              height: 1.35,
            ),
          ),
        ],
      ),
    );
  }
}

class _SavedLocationMarker extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            color: colors.cardSurface.withValues(alpha: 0.96),
            shape: BoxShape.circle,
            border: Border.all(color: colors.primary, width: 2),
            boxShadow: [
              BoxShadow(
                color: colors.primary.withValues(alpha: 0.22),
                blurRadius: 10,
              ),
            ],
          ),
          child: Icon(Icons.location_on, color: colors.primary, size: 21),
        ),
        Container(
          width: 4,
          height: 9,
          decoration: BoxDecoration(
            color: colors.primary,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
      ],
    );
  }
}

class _DeleteSavedLocationDialog extends StatelessWidget {
  const _DeleteSavedLocationDialog({required this.location});

  final SavedLocation location;

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Delete saved location?'),
      content: Text(
        location.isDefault
            ? 'This is your default saved location. Deleting it may make another saved location the default.'
            : 'This removes "${location.label}" from your private saved locations.',
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: () => Navigator.of(context).pop(true),
          style: AppStatusButtonStyle.filled(context, AppStatusTone.danger),
          child: const Text('Delete'),
        ),
      ],
    );
  }
}

class _PrivacyNotice extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.primarySoft,
        borderRadius: AppRadius.lgAll,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.privacy_tip_outlined, color: colors.primary),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              'Exact address and coordinates are private account data. '
              'Public material browsing uses only safe approximate location fields.',
              style: AppTextStyles.label(context).copyWith(
                color: colors.textPrimary,
                height: 1.35,
                fontWeight: FontWeight.w700,
                letterSpacing: 0,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _DefaultBadge extends StatelessWidget {
  const _DefaultBadge();

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: colors.primarySoft,
        borderRadius: AppRadius.pillAll,
      ),
      child: Text(
        'Default',
        style: AppTextStyles.label(context).copyWith(
          color: colors.primary,
          fontSize: 11,
          fontWeight: FontWeight.w800,
          letterSpacing: 0,
        ),
      ),
    );
  }
}

class _EmptySavedLocations extends StatelessWidget {
  const _EmptySavedLocations({required this.onCreate});

  final VoidCallback onCreate;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return ProfileEditCard(
      child: Column(
        children: [
          Icon(
            Icons.add_location_alt_outlined,
            size: 42,
            color: colors.primary,
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            'No saved locations yet',
            style: AppTextStyles.title(
              context,
            ).copyWith(color: colors.textPrimary),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Add a private location to reuse it when sorting materials by nearest first.',
            style: AppTextStyles.body(
              context,
            ).copyWith(color: colors.textSecondary),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: AppSpacing.lg),
          AppPrimaryButton(label: 'Add location', onPressed: onCreate),
        ],
      ),
    );
  }
}

class _SavedLocationsLoading extends StatelessWidget {
  const _SavedLocationsLoading();

  @override
  Widget build(BuildContext context) {
    return const ProfileEditCard(
      child: Center(child: CircularProgressIndicator()),
    );
  }
}

class _SavedLocationsError extends StatelessWidget {
  const _SavedLocationsError({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return ProfileEditCard(
      child: Column(
        children: [
          AppInlineError(message: message),
          const SizedBox(height: AppSpacing.md),
          OutlinedButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh_rounded),
            label: const Text('Retry'),
          ),
        ],
      ),
    );
  }
}
