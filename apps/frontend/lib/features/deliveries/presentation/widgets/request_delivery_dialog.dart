import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/widgets/bidi_text.dart';
import '../../../../shared/widgets/app_dialog_footer.dart';
import '../../../../shared/widgets/app_dialog_shell.dart';
import '../../../../shared/widgets/app_feedback.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/location/current_location_service.dart';
import '../../../auth/application/auth_route_helpers.dart';
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
      showInfoSnackBar(context, context.l10n.currentLocationCaptured);
    } on CurrentLocationException {
      if (!mounted) {
        return;
      }
      showErrorSnackBar(context, context.l10n.currentLocationFailed);
    } catch (_) {
      if (!mounted) {
        return;
      }
      showErrorSnackBar(context, context.l10n.currentLocationFailed);
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
        showErrorSnackBar(context, context.l10n.chooseSavedDropoffAddress);
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
        showErrorSnackBar(context, context.l10n.countryAndCityRequired);
        return;
      }

      if (_saveForLater && _saveLabelController.text.trim().isEmpty) {
        showErrorSnackBar(context, context.l10n.addressLabelRequired);
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

      final isFreeDelivery =
          widget.reservation.deliveryFee == null ||
          widget.reservation.deliveryFee == 0;
      showInfoSnackBar(
        context,
        isFreeDelivery
            ? context.l10n.deliveryRequestedFree
            : context.l10n.deliveryRequested,
      );
      final router = GoRouter.of(context);
      widget.onSubmitted();
      // Use go (not push) so web history isn't stuck behind a dismissed dialog.
      router.go('/learner/deliveries/${delivery.id}');
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }

      invalidateLearnerReservationCaches(
        ref,
        reservationId: widget.reservation.id,
      );
      ref.invalidate(learnerDeliveriesProvider);

      if (error.code == 'DELIVERY_FEE_REQUIRED') {
        showInfoSnackBar(context, context.l10n.deliveryFeePaymentRequired);
        final router = GoRouter.of(context);
        widget.onSubmitted();
        router.push(
          learnerReservationDetailRoute(
            widget.reservation.id,
            focus: 'payment',
          ),
        );
        return;
      }

      showErrorSnackBar(context, localizedApiErrorMessage(error, context.l10n));
    } catch (_) {
      if (!mounted) {
        return;
      }
      showErrorSnackBar(context, context.l10n.deliveryRequestFailed);
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final savedAddressesAsync = ref.watch(savedDropoffAddressesProvider);

    return AppDialogShell(
      title: Text(context.l10n.requestDelivery),
      maxWidth: 480,
      onClose: widget.onCancel,
      closeEnabled: !_submitting,
      content: SizedBox(
        width: 480,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              context.l10n.requestDeliveryForMaterial(
                widget.reservation.material.title,
              ),
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
                  Text(context.l10n.savedAddressesLoadFailed),
                  TextButton(
                    onPressed: () =>
                        ref.invalidate(savedDropoffAddressesProvider),
                    style: AppStatusButtonStyle.text(
                      context,
                      AppStatusTone.primary,
                    ),
                    child: Text(context.l10n.retry),
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
                  return Text(context.l10n.noSavedAddresses);
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
                      segments: [
                        ButtonSegment(
                          value: _DropoffInputMode.saved,
                          label: Text(context.l10n.saved),
                        ),
                        ButtonSegment(
                          value: _DropoffInputMode.manual,
                          label: Text(context.l10n.newAddress),
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
                        isExpanded: true,
                        initialValue: selectedId,
                        decoration: InputDecoration(
                          labelText: context.l10n.savedDropoffAddress,
                        ),
                        items: addresses
                            .map(
                              (address) => DropdownMenuItem(
                                value: address.id,
                                child: Text(
                                  '${address.label} · ${address.location.summary}',
                                  overflow: TextOverflow.ellipsis,
                                  maxLines: 1,
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
                decoration: InputDecoration(labelText: context.l10n.country),
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: AppSpacing.sm),
              TextField(
                controller: _cityController,
                decoration: InputDecoration(labelText: context.l10n.city),
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: AppSpacing.sm),
              TextField(
                controller: _areaController,
                decoration: InputDecoration(labelText: context.l10n.area),
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: AppSpacing.sm),
              TextField(
                controller: _addressController,
                decoration: InputDecoration(labelText: context.l10n.address),
                textInputAction: TextInputAction.next,
                maxLines: 2,
              ),
              const SizedBox(height: AppSpacing.sm),
              OutlinedButton.icon(
                onPressed: _capturingLocation ? null : _useCurrentLocation,
                style: AppStatusButtonStyle.outlined(
                  context,
                  AppStatusTone.info,
                ),
                icon: _capturingLocation
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.my_location_outlined),
                label: Text(
                  _capturingLocation
                      ? context.l10n.gettingLocation
                      : context.l10n.useCurrentLocation,
                ),
              ),
              if (_latitude != null && _longitude != null) ...[
                const SizedBox(height: AppSpacing.sm),
                BidiText(
                  context.l10n.coordinatesValue(
                    '${_latitude!.toStringAsFixed(5)}, '
                    '${_longitude!.toStringAsFixed(5)}',
                  ),
                  technical: true,
                ),
              ] else ...[
                const SizedBox(height: AppSpacing.sm),
                Text(context.l10n.preciseLocationHelp),
              ],
              CheckboxListTile(
                contentPadding: EdgeInsets.zero,
                value: _saveForLater,
                onChanged: (value) =>
                    setState(() => _saveForLater = value ?? false),
                title: Text(context.l10n.saveAddressForLater),
                controlAffinity: ListTileControlAffinity.leading,
              ),
              if (_saveForLater)
                TextField(
                  controller: _saveLabelController,
                  decoration: InputDecoration(
                    labelText: context.l10n.addressLabel,
                    hintText: context.l10n.addressLabelHint,
                  ),
                ),
            ],
            const SizedBox(height: AppSpacing.md),
            TextField(
              controller: _learnerNoteController,
              decoration: InputDecoration(
                labelText: context.l10n.driverNoteOptional,
              ),
              maxLines: 2,
            ),
          ],
        ),
      ),
      footer: AppDialogFooter.form(
        primaryAction: FilledButton(
          onPressed: _submitting ? null : _submit,
          style: AppStatusButtonStyle.filled(context, AppStatusTone.primary),
          child: _submitting
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : Text(context.l10n.requestDelivery),
        ),
      ),
    );
  }
}
