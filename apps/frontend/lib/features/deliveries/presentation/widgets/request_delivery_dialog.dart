import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../shared/widgets/app_feedback.dart';
import '../../../../shared/location/current_location_service.dart';
import '../../../home/application/home_suggested_materials_provider.dart';
import '../../../reservations/application/learner_reservation_cache.dart';
import '../../../reservations/data/models/learner_reservation.dart';
import '../../application/delivery_request_controller.dart';
import '../../application/learner_deliveries_provider.dart';
import '../../data/models/request_delivery_request.dart';
import '../../data/models/saved_dropoff_address.dart';
import '../../data/saved_dropoff_addresses_repository.dart';

enum _DropoffInputMode { saved, manual }

Future<bool?> showRequestDeliveryDialog({
  required BuildContext context,
  required WidgetRef ref,
  required LearnerReservation reservation,
}) {
  return showDialog<bool>(
    context: context,
    builder: (dialogContext) => _RequestDeliveryDialog(
      reservation: reservation,
      onSubmitted: () => Navigator.of(dialogContext).pop(true),
      onCancel: () => Navigator.of(dialogContext).pop(false),
    ),
  );
}

class _RequestDeliveryDialog extends ConsumerStatefulWidget {
  const _RequestDeliveryDialog({
    required this.reservation,
    required this.onSubmitted,
    required this.onCancel,
  });

  final LearnerReservation reservation;
  final VoidCallback onSubmitted;
  final VoidCallback onCancel;

  @override
  ConsumerState<_RequestDeliveryDialog> createState() =>
      _RequestDeliveryDialogState();
}

class _RequestDeliveryDialogState
    extends ConsumerState<_RequestDeliveryDialog> {
  final _countryController = TextEditingController(text: 'Palestine');
  final _cityController = TextEditingController();
  final _areaController = TextEditingController();
  final _addressController = TextEditingController();
  final _learnerNoteController = TextEditingController();
  final _saveLabelController = TextEditingController();

  _DropoffInputMode _inputMode = _DropoffInputMode.saved;
  String? _selectedSavedAddressId;
  bool _saveForLater = false;
  bool _submitting = false;
  bool _capturingLocation = false;
  double? _latitude;
  double? _longitude;

  @override
  void dispose() {
    _countryController.dispose();
    _cityController.dispose();
    _areaController.dispose();
    _addressController.dispose();
    _learnerNoteController.dispose();
    _saveLabelController.dispose();
    super.dispose();
  }

  void _applySavedAddress(SavedDropoffAddress address) {
    setState(() {
      _selectedSavedAddressId = address.id;
      _countryController.text = address.location.country;
      _cityController.text = address.location.city;
      _areaController.text = address.location.area ?? '';
      _addressController.text = address.location.addressLine ?? '';
      _latitude = address.location.latitude;
      _longitude = address.location.longitude;
    });
  }

  Future<void> _useCurrentLocation() async {
    setState(() => _capturingLocation = true);

    try {
      final capture = await ref
          .read(currentLocationServiceProvider)
          .captureCurrentLocation();

      if (!mounted) {
        return;
      }

      setState(() {
        _latitude = capture.latitude;
        _longitude = capture.longitude;
      });
      showInfoSnackBar(context, 'Current location captured.');
    } on CurrentLocationException catch (error) {
      if (!mounted) {
        return;
      }
      showErrorSnackBar(context, error.message);
    } catch (error) {
      if (!mounted) {
        return;
      }
      showErrorSnackBar(context, error);
    } finally {
      if (mounted) {
        setState(() => _capturingLocation = false);
      }
    }
  }

  Future<void> _submit() async {
    RequestDeliveryRequest request;

    if (_inputMode == _DropoffInputMode.saved) {
      final savedId = _selectedSavedAddressId;
      if (savedId == null || savedId.isEmpty) {
        showErrorSnackBar(context, 'Choose a saved dropoff address.');
        return;
      }

      request = RequestDeliveryRequest(
        savedDropoffAddressId: savedId,
        learnerNote: _learnerNoteController.text.trim().isEmpty
            ? null
            : _learnerNoteController.text.trim(),
      );
    } else {
      final country = _countryController.text.trim();
      final city = _cityController.text.trim();
      if (country.isEmpty || city.isEmpty) {
        showErrorSnackBar(context, 'Country and city are required.');
        return;
      }

      if (_saveForLater && _saveLabelController.text.trim().isEmpty) {
        showErrorSnackBar(context, 'Enter a label to save this address.');
        return;
      }

      request = RequestDeliveryRequest(
        dropoffLocation: DeliveryLocationInput(
          country: country,
          city: city,
          area: _areaController.text.trim().isEmpty
              ? null
              : _areaController.text.trim(),
          addressLine: _addressController.text.trim().isEmpty
              ? null
              : _addressController.text.trim(),
          latitude: _latitude,
          longitude: _longitude,
          isApproximate: _latitude == null || _longitude == null,
        ),
        saveDropoffAddressLabel: _saveForLater
            ? _saveLabelController.text.trim()
            : null,
        learnerNote: _learnerNoteController.text.trim().isEmpty
            ? null
            : _learnerNoteController.text.trim(),
      );
    }

    setState(() => _submitting = true);

    try {
      final delivery = await ref
          .read(deliveryRequestControllerProvider.notifier)
          .requestDelivery(
            reservationId: widget.reservation.id,
            request: request,
          );

      invalidateLearnerReservationCaches(
        ref,
        reservationId: widget.reservation.id,
      );
      ref.invalidate(learnerDeliveriesProvider);
      ref.invalidate(savedDropoffAddressesProvider);
      ref.invalidate(homeSuggestedMaterialsProvider);

      if (!mounted) {
        return;
      }

      showInfoSnackBar(context, 'Delivery requested.');
      final router = GoRouter.of(context);
      widget.onSubmitted();
      router.push('/learner/deliveries/${delivery.id}');
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }
      showErrorSnackBar(context, error.message);
    } catch (_) {
      if (!mounted) {
        return;
      }
      showErrorSnackBar(context, 'Could not request delivery. Try again.');
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final savedAddressesAsync = ref.watch(savedDropoffAddressesProvider);

    return AlertDialog(
      title: const Text('Request delivery'),
      content: SizedBox(
        width: 480,
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Choose where the driver should deliver ${widget.reservation.material.title}.',
              ),
              const SizedBox(height: AppSpacing.md),
              savedAddressesAsync.when(
                loading: () => const Padding(
                  padding: EdgeInsets.symmetric(vertical: AppSpacing.sm),
                  child: LinearProgressIndicator(),
                ),
                error: (_, _) => Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Text('Could not load saved addresses.'),
                    TextButton(
                      onPressed: () =>
                          ref.invalidate(savedDropoffAddressesProvider),
                      child: const Text('Retry'),
                    ),
                  ],
                ),
                data: (addresses) {
                  if (addresses.isEmpty) {
                    if (_inputMode == _DropoffInputMode.saved) {
                      WidgetsBinding.instance.addPostFrameCallback((_) {
                        if (mounted) {
                          setState(() => _inputMode = _DropoffInputMode.manual);
                        }
                      });
                    }
                    return const Text(
                      'No saved addresses yet. Enter one below.',
                    );
                  }

                  final selectedId =
                      _selectedSavedAddressId ?? addresses.first.id;
                  if (_selectedSavedAddressId == null) {
                    WidgetsBinding.instance.addPostFrameCallback((_) {
                      if (mounted && _selectedSavedAddressId == null) {
                        _applySavedAddress(addresses.first);
                      }
                    });
                  }

                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      SegmentedButton<_DropoffInputMode>(
                        segments: const [
                          ButtonSegment(
                            value: _DropoffInputMode.saved,
                            label: Text('Saved'),
                          ),
                          ButtonSegment(
                            value: _DropoffInputMode.manual,
                            label: Text('New address'),
                          ),
                        ],
                        selected: {_inputMode},
                        onSelectionChanged: (selection) {
                          setState(() => _inputMode = selection.first);
                        },
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      if (_inputMode == _DropoffInputMode.saved)
                        DropdownButtonFormField<String>(
                          value: selectedId,
                          decoration: const InputDecoration(
                            labelText: 'Saved dropoff address',
                          ),
                          items: addresses
                              .map(
                                (address) => DropdownMenuItem(
                                  value: address.id,
                                  child: Text(
                                    '${address.label} · ${address.location.summary}',
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              )
                              .toList(),
                          onChanged: (value) {
                            setState(() => _selectedSavedAddressId = value);
                            final selected = addresses.firstWhere(
                              (address) => address.id == value,
                              orElse: () => addresses.first,
                            );
                            _applySavedAddress(selected);
                          },
                        ),
                    ],
                  );
                },
              ),
              if (_inputMode == _DropoffInputMode.manual ||
                  savedAddressesAsync.maybeWhen(
                    data: (addresses) => addresses.isEmpty,
                    orElse: () => false,
                  )) ...[
                const SizedBox(height: AppSpacing.sm),
                TextField(
                  controller: _countryController,
                  decoration: const InputDecoration(labelText: 'Country'),
                  textInputAction: TextInputAction.next,
                ),
                const SizedBox(height: AppSpacing.sm),
                TextField(
                  controller: _cityController,
                  decoration: const InputDecoration(labelText: 'City'),
                  textInputAction: TextInputAction.next,
                ),
                const SizedBox(height: AppSpacing.sm),
                TextField(
                  controller: _areaController,
                  decoration: const InputDecoration(labelText: 'Area'),
                  textInputAction: TextInputAction.next,
                ),
                const SizedBox(height: AppSpacing.sm),
                TextField(
                  controller: _addressController,
                  decoration: const InputDecoration(labelText: 'Address'),
                  textInputAction: TextInputAction.next,
                  maxLines: 2,
                ),
                const SizedBox(height: AppSpacing.sm),
                OutlinedButton.icon(
                  onPressed: _capturingLocation ? null : _useCurrentLocation,
                  icon: _capturingLocation
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.my_location_outlined),
                  label: Text(
                    _capturingLocation
                        ? 'Getting location…'
                        : 'Use current location',
                  ),
                ),
                if (_latitude != null && _longitude != null) ...[
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    'Coordinates: ${_latitude!.toStringAsFixed(5)}, '
                    '${_longitude!.toStringAsFixed(5)}',
                  ),
                ] else ...[
                  const SizedBox(height: AppSpacing.sm),
                  const Text(
                    'Precise location helps drivers find you. You can still submit city and address only.',
                  ),
                ],
                CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  value: _saveForLater,
                  onChanged: (value) =>
                      setState(() => _saveForLater = value ?? false),
                  title: const Text('Save this address for later'),
                  controlAffinity: ListTileControlAffinity.leading,
                ),
                if (_saveForLater)
                  TextField(
                    controller: _saveLabelController,
                    decoration: const InputDecoration(
                      labelText: 'Address label',
                      hintText: 'Home, campus, workshop...',
                    ),
                  ),
              ],
              const SizedBox(height: AppSpacing.md),
              TextField(
                controller: _learnerNoteController,
                decoration: const InputDecoration(
                  labelText: 'Note for driver (optional)',
                ),
                maxLines: 2,
              ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: _submitting ? null : widget.onCancel,
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: _submitting ? null : _submit,
          child: _submitting
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Text('Request delivery'),
        ),
      ],
    );
  }
}
