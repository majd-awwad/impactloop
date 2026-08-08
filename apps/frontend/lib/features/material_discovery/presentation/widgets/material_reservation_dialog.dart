import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../l10n/l10n.dart';
import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../reservations/application/reservation_timing_policy.dart';
import '../../../reservations/data/models/create_reservation_request.dart';
import '../../../reservations/data/models/reservation_preferred_window.dart';
import '../../../reservations/data/models/reservation_quote.dart';
import '../../../reservations/data/reservations_repository.dart';
import '../../../reservations/presentation/reservation_create_error_message.dart';
import '../../../reservations/presentation/widgets/reservation_price_breakdown.dart';
import '../../../../shared/models/localized_text.dart';
import '../../domain/discovery_material.dart';
import '../reservation_dialog_copy.dart';
import '../widgets/preferred_window_input.dart';

const reservationDialogMaxWidth = 460.0;
const reservationDialogMaxHeightFactor = 0.85;
const reservationMessageMaxLength = 1000;
const reservationDialogChromeHeight = 156.0;
const reservationDialogSectionGap = AppSpacing.md;

ButtonStyle _reservationDialogSubmitButtonStyle(BuildContext context) {
  final colors = AppThemeColors.of(context);
  final palette = MaterialsUiPalette.of(context);

  return ButtonStyle(
    minimumSize: const WidgetStatePropertyAll(Size(0, 44)),
    padding: const WidgetStatePropertyAll(
      EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm),
    ),
    shape: WidgetStatePropertyAll(
      RoundedRectangleBorder(borderRadius: AppRadius.lgAll),
    ),
    elevation: const WidgetStatePropertyAll(0),
    backgroundColor: WidgetStateProperty.resolveWith((states) {
      if (states.contains(WidgetState.disabled)) {
        return palette.mutedSurface;
      }
      if (states.contains(WidgetState.pressed) ||
          states.contains(WidgetState.hovered)) {
        return colors.primaryHover;
      }
      return colors.primary;
    }),
    foregroundColor: WidgetStateProperty.resolveWith((states) {
      if (states.contains(WidgetState.disabled)) {
        return palette.textMuted;
      }
      return colors.textOnPrimary;
    }),
  );
}

class MaterialReservationDialog extends ConsumerStatefulWidget {
  const MaterialReservationDialog({
    required this.material,
    required this.onSubmit,
  });

  final DiscoveryMaterial material;
  final Future<void> Function(CreateReservationRequest request) onSubmit;

  @override
  ConsumerState<MaterialReservationDialog> createState() =>
      MaterialReservationDialogState();
}

class MaterialReservationDialogState
    extends ConsumerState<MaterialReservationDialog> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _quantityController;
  final _messageController = TextEditingController();
  final _deliveryAddressController = TextEditingController();
  final _dropoffCityController = TextEditingController();
  final _deliveryNoteController = TextEditingController();
  String? _fulfillmentMethod;
  final _pickupWindows = <PreferredWindowDraft>[PreferredWindowDraft()];
  final _deliveryWindows = <PreferredWindowDraft>[PreferredWindowDraft()];
  bool? _safeDropoffAllowed;
  var _isSubmitting = false;
  String? _errorMessage;
  ReservationQuote? _quote;
  var _quoteLoading = false;
  String? _quoteError;
  var _combineWithGroup = true;
  Timer? _quoteDebounce;

  @override
  void initState() {
    super.initState();
    final defaultQuantity = _defaultQuantity(
      widget.material.availableQuantity,
      widget.material.unit,
    );
    _quantityController = TextEditingController(
      text: _formatQuantity(defaultQuantity),
    );
    _fulfillmentMethod = _initialFulfillmentMethod();
    _quantityController.addListener(_scheduleQuoteRefresh);
    _deliveryAddressController.addListener(_scheduleQuoteRefresh);
    _dropoffCityController.addListener(_scheduleQuoteRefresh);
    WidgetsBinding.instance.addPostFrameCallback((_) => _refreshQuote());
  }

  @override
  void dispose() {
    _quoteDebounce?.cancel();
    _quantityController.removeListener(_scheduleQuoteRefresh);
    _deliveryAddressController.removeListener(_scheduleQuoteRefresh);
    _dropoffCityController.removeListener(_scheduleQuoteRefresh);
    _quantityController.dispose();
    _messageController.dispose();
    _deliveryAddressController.dispose();
    _dropoffCityController.dispose();
    _deliveryNoteController.dispose();
    super.dispose();
  }

  void _scheduleQuoteRefresh() {
    _quoteDebounce?.cancel();
    _quoteDebounce = Timer(const Duration(milliseconds: 400), _refreshQuote);
  }

  List<Map<String, String>> _deliveryWindowsPayload() {
    final now = DateTime.now();
    final windows = <Map<String, String>>[];

    for (final draft in _deliveryWindows) {
      if (draft.start != null && draft.end != null) {
        final error = draft.validationError(now: now);
        if (error == null) {
          windows.add({
            'start': draft.start!.toUtc().toIso8601String(),
            'end': draft.end!.toUtc().toIso8601String(),
          });
        }
      }
    }

    return windows;
  }

  Future<void> _refreshQuote() async {
    if (!mounted || _isSubmitting) {
      return;
    }

    final quantity = _parsedQuantity();
    if (quantity == null || quantity <= 0 || _fulfillmentMethod == null) {
      setState(() {
        _quote = null;
        _quoteError = null;
        _quoteLoading = false;
      });
      return;
    }

    if (_isDelivery) {
      final dropoffCity = _dropoffCityController.text.trim();
      if (dropoffCity.isEmpty) {
        setState(() {
          _quote = null;
          _quoteError = null;
          _quoteLoading = false;
        });
        return;
      }
    }

    setState(() {
      _quoteLoading = true;
      _quoteError = null;
    });

    try {
      final repository = ref.read(reservationsRepositoryProvider);
      final baseRequest = ReservationQuoteRequest(
        materialId: widget.material.id,
        quantity: quantity,
        fulfillmentMethod: _fulfillmentMethod!,
        dropoffCity: _isDelivery ? _dropoffCityController.text.trim() : null,
        learnerPreferredDeliveryWindows: _isDelivery
            ? _deliveryWindowsPayload()
            : const [],
      );

      var quote = await repository.fetchReservationQuote(baseRequest);

      if (_isDelivery &&
          _combineWithGroup &&
          quote.deliveryGroupCandidate != null) {
        quote = await repository.fetchReservationQuote(
          ReservationQuoteRequest(
            materialId: widget.material.id,
            quantity: quantity,
            fulfillmentMethod: 'DELIVERY',
            dropoffCity: _dropoffCityController.text.trim(),
            learnerPreferredDeliveryWindows: _deliveryWindowsPayload(),
            combineWithDeliveryGroupId: quote.deliveryGroupCandidate!.id,
          ),
        );
      }

      if (!mounted) {
        return;
      }

      setState(() {
        _quote = quote;
        _quoteLoading = false;
      });
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _quoteLoading = false;
        _quote = null;
        _quoteError = error.code == 'NETWORK_ERROR' || error.code == 'TIMEOUT'
            ? localizedApiErrorMessage(error, context.l10n)
            : context.l10n.deliveryQuoteFailed;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }

      setState(() {
        _quoteLoading = false;
        _quote = null;
        _quoteError = context.l10n.deliveryQuoteFailed;
      });
    }
  }

  String? _initialFulfillmentMethod() {
    final canPickup = widget.material.pickupAllowed;
    final canDelivery = widget.material.deliveryAvailable;

    if (canPickup) {
      return 'PICKUP';
    }

    if (canDelivery) {
      return 'DELIVERY';
    }

    return null;
  }

  bool get _isPickup => _fulfillmentMethod == 'PICKUP';

  bool get _isDelivery => _fulfillmentMethod == 'DELIVERY';

  bool get _canChoosePickup => widget.material.pickupAllowed;

  bool get _canChooseDelivery => widget.material.deliveryAvailable;

  List<ReservationPreferredWindow>? _validatedPreferredWindows(
    List<PreferredWindowDraft> drafts, {
    Duration? minimumRemainingTime,
    String? minimumRemainingTimeMessage,
    Duration? minimumLeadTime,
    String? minimumLeadTimeMessage,
  }) {
    final now = DateTime.now();
    final windows = <ReservationPreferredWindow>[];

    for (final draft in drafts) {
      if (draft.isBlank) {
        continue;
      }

      final error = draft.validationError(
        now: now,
        minimumRemainingTime: minimumRemainingTime,
        minimumRemainingTimeMessage: minimumRemainingTimeMessage,
        minimumLeadTime: minimumLeadTime,
        minimumLeadTimeMessage: minimumLeadTimeMessage,
      );
      if (error != null) {
        setState(() => _errorMessage = error);
        return null;
      }

      windows.add(
        ReservationPreferredWindow(start: draft.start!, end: draft.end!),
      );
    }

    return windows;
  }

  bool get _usesCountSteps => _isCountLikeUnit(widget.material.unit);

  double get _availableQuantity => widget.material.availableQuantity;

  double _defaultQuantity(double available, String unit) {
    if (available <= 0) {
      return 0;
    }

    if (_isCountLikeUnit(unit)) {
      return available >= 1 ? 1 : available;
    }

    return available;
  }

  static bool _isCountLikeUnit(String unit) {
    const countLike = {
      'piece',
      'pieces',
      'item',
      'items',
      'unit',
      'units',
      'sheet',
      'sheets',
      'panel',
      'panels',
      'crate',
      'crates',
    };

    return countLike.contains(unit.toLowerCase());
  }

  static String _formatAvailableQuantityLabel(DiscoveryMaterial material) {
    return formatReservationAvailableQuantityLabel(
      availableQuantity: material.availableQuantity,
      unit: material.unit,
    );
  }

  String _formatQuantity(double value) => formatReservationQuantity(value);

  double? _parsedQuantity() {
    return double.tryParse(_quantityController.text.trim());
  }

  void _setQuantity(double value) {
    final clamped = value.clamp(0, _availableQuantity).toDouble();
    _quantityController.text = _formatQuantity(clamped);
  }

  void _incrementQuantity() {
    final current = _parsedQuantity();
    if (current == null) {
      setState(() => _setQuantity(1));
      return;
    }

    if (current >= _availableQuantity) {
      return;
    }

    final step = _usesCountSteps ? 1.0 : 0.1;
    setState(() => _setQuantity(current + step));
    _scheduleQuoteRefresh();
  }

  void _decrementQuantity() {
    final current = _parsedQuantity();
    if (current == null) {
      setState(() => _setQuantity(1));
      return;
    }

    final step = _usesCountSteps ? 1.0 : 0.1;
    final minValue = _usesCountSteps ? 1.0 : 0.1;
    if (current <= minValue) {
      return;
    }

    setState(() => _setQuantity(current - step));
    _scheduleQuoteRefresh();
  }

  bool get _canSubmitReservation {
    if (_isSubmitting || _fulfillmentMethod == null) {
      return false;
    }

    final quantity = _parsedQuantity();
    if (quantity == null || quantity <= 0 || quantity > _availableQuantity) {
      return false;
    }

    if (_isPickup) {
      return _quote != null && !_quoteLoading;
    }

    if (_isDelivery) {
      if (_dropoffCityController.text.trim().isEmpty ||
          _deliveryAddressController.text.trim().isEmpty) {
        return false;
      }

      return _quote != null && !_quoteLoading && _quoteError == null;
    }

    return false;
  }

  String? get _quoteWaitingMessage {
    if (_fulfillmentMethod == null) {
      return 'Choose pickup or delivery to see the estimated total.';
    }

    if (_isDelivery && _dropoffCityController.text.trim().isEmpty) {
      return 'Enter drop-off city to calculate delivery fee.';
    }

    if (!_quoteLoading && _quote == null && _quoteError == null) {
      return 'Estimated total will appear after required details are entered.';
    }

    return null;
  }

  Future<void> _submit() async {
    if (_isSubmitting || _formKey.currentState?.validate() != true) {
      return;
    }

    final quantity = double.parse(_quantityController.text.trim());
    final message = _messageController.text.trim();

    if (_fulfillmentMethod == null) {
      setState(
        () => _errorMessage = 'Choose pickup or delivery before reserving.',
      );
      return;
    }

    if (_isPickup) {
      final windows = _validatedPreferredWindows(
        _pickupWindows,
        minimumRemainingTime: minRemainingPickupWindow,
        minimumRemainingTimeMessage: learnerPickupWindowTooCloseMessage,
        minimumLeadTime: minPickupLeadTime,
      );
      if (windows == null) {
        return;
      }

      setState(() {
        _isSubmitting = true;
        _errorMessage = null;
      });

      try {
        await widget.onSubmit(
          CreateReservationRequest(
            materialId: widget.material.id,
            quantityRequested: quantity,
            fulfillmentMethod: 'PICKUP',
            message: message.isEmpty ? null : message,
            learnerPreferredPickupWindows: windows,
          ),
        );
      } on ApiException catch (error) {
        if (!mounted) {
          return;
        }

        setState(() {
          _isSubmitting = false;
          _errorMessage = reservationCreateErrorMessage(
            error,
            l10n: context.l10n,
          );
        });
        return;
      } catch (_) {
        if (!mounted) {
          return;
        }

        setState(() {
          _isSubmitting = false;
          _errorMessage =
              'Could not request this reservation. Please try again.';
        });
        return;
      }
    } else if (_isDelivery) {
      final windows = _validatedPreferredWindows(_deliveryWindows);
      if (windows == null) {
        return;
      }

      final deliveryAddress = _deliveryAddressController.text.trim();
      final dropoffCity = _dropoffCityController.text.trim();
      if (deliveryAddress.isEmpty) {
        setState(() => _errorMessage = 'Enter a delivery address.');
        return;
      }

      if (dropoffCity.isEmpty) {
        setState(() => _errorMessage = 'Enter a drop-off city.');
        return;
      }

      if (_safeDropoffAllowed == null) {
        setState(
          () => _errorMessage = 'Choose whether safe drop-off is allowed.',
        );
        return;
      }

      final deliveryNote = _deliveryNoteController.text.trim();

      setState(() {
        _isSubmitting = true;
        _errorMessage = null;
      });

      try {
        await widget.onSubmit(
          CreateReservationRequest(
            materialId: widget.material.id,
            quantityRequested: quantity,
            fulfillmentMethod: 'DELIVERY',
            message: message.isEmpty ? null : message,
            learnerPreferredDeliveryWindows: windows,
            deliveryAddressText: deliveryAddress,
            dropoffCity: dropoffCity,
            safeDropoffAllowed: _safeDropoffAllowed,
            deliveryNote: deliveryNote.isEmpty ? null : deliveryNote,
            combineWithDeliveryGroupId:
                _combineWithGroup && _quote?.deliveryGroupCandidate != null
                ? _quote!.deliveryGroupCandidate!.id
                : null,
          ),
        );
      } on ApiException catch (error) {
        if (!mounted) {
          return;
        }

        setState(() {
          _isSubmitting = false;
          _errorMessage = reservationCreateErrorMessage(
            error,
            l10n: context.l10n,
          );
        });
        return;
      } catch (_) {
        if (!mounted) {
          return;
        }

        setState(() {
          _isSubmitting = false;
          _errorMessage =
              'Could not request this reservation. Please try again.';
        });
        return;
      }
    } else {
      setState(
        () => _errorMessage =
            'This material does not have an available receive method.',
      );
      return;
    }

    if (!mounted) {
      return;
    }

    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final material = widget.material;
    final palette = MaterialsUiPalette.of(context);
    final screenSize = MediaQuery.sizeOf(context);
    final isNarrow = screenSize.width < 480;
    final dialogWidth = isNarrow
        ? screenSize.width * 0.92
        : reservationDialogMaxWidth;
    final maxDialogHeight =
        screenSize.height * reservationDialogMaxHeightFactor;
    final maxBodyHeight = (maxDialogHeight - reservationDialogChromeHeight)
        .clamp(180.0, maxDialogHeight);

    return Dialog(
      insetPadding: EdgeInsets.symmetric(
        horizontal: isNarrow ? screenSize.width * 0.04 : AppSpacing.lg,
        vertical: AppSpacing.lg,
      ),
      backgroundColor: palette.panelSurface,
      shape: RoundedRectangleBorder(borderRadius: AppRadius.lgAll),
      child: SizedBox(
        width: dialogWidth,
        child: ConstrainedBox(
          constraints: BoxConstraints(maxHeight: maxDialogHeight),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsetsDirectional.fromSTEB(
                  AppSpacing.md,
                  AppSpacing.sm,
                  AppSpacing.xs,
                  AppSpacing.sm,
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Request reservation',
                        style: AppTextStyles.body(context).copyWith(
                          color: palette.textPrimary,
                          fontWeight: FontWeight.w600,
                          fontSize: 18,
                        ),
                      ),
                    ),
                    IconButton(
                      onPressed: _isSubmitting
                          ? null
                          : () => Navigator.of(context).pop(),
                      tooltip: 'Close',
                      visualDensity: VisualDensity.compact,
                      constraints: const BoxConstraints(
                        minWidth: 36,
                        minHeight: 36,
                      ),
                      icon: Icon(Icons.close_rounded, color: palette.textMuted),
                    ),
                  ],
                ),
              ),
              Divider(height: 1, color: palette.borderSubtle),
              ConstrainedBox(
                constraints: BoxConstraints(maxHeight: maxBodyHeight),
                child: SingleChildScrollView(
                  padding: const EdgeInsetsDirectional.fromSTEB(
                    AppSpacing.md,
                    AppSpacing.md,
                    AppSpacing.md,
                    AppSpacing.sm,
                  ),
                  child: Form(
                    key: _formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        _ReservationDialogMaterialSummary(
                          material: material,
                          availabilityLabel: _formatAvailableQuantityLabel(
                            material,
                          ),
                        ),
                        if (_errorMessage != null) ...[
                          const SizedBox(height: reservationDialogSectionGap),
                          Container(
                            padding: const EdgeInsetsDirectional.all(
                              AppSpacing.sm,
                            ),
                            decoration: BoxDecoration(
                              color: palette.inputSurface,
                              borderRadius: AppRadius.mdAll,
                              border: Border.all(color: palette.borderStrong),
                            ),
                            child: Text(
                              _errorMessage!,
                              style: AppTextStyles.body(
                                context,
                              ).copyWith(color: palette.textPrimary),
                            ),
                          ),
                        ],
                        const SizedBox(height: reservationDialogSectionGap),
                        Text(
                          'Quantity',
                          style: AppTextStyles.label(
                            context,
                          ).copyWith(color: palette.textSecondary),
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        _ReservationDialogQuantityStepper(
                          controller: _quantityController,
                          unit: material.unit,
                          enabled: !_isSubmitting,
                          onDecrement:
                              _isSubmitting ||
                                  (_parsedQuantity() ?? 1) <=
                                      (_usesCountSteps ? 1.0 : 0.1)
                              ? null
                              : _decrementQuantity,
                          onIncrement:
                              _isSubmitting ||
                                  (_parsedQuantity() ?? 0) >= _availableQuantity
                              ? null
                              : _incrementQuantity,
                          validator: (value) {
                            final parsed = double.tryParse(value?.trim() ?? '');
                            if (parsed == null || parsed <= 0) {
                              return 'Enter a quantity greater than 0';
                            }
                            if (parsed > material.availableQuantity) {
                              return 'Cannot exceed available quantity';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: reservationDialogSectionGap),
                        Text(
                          'Fulfillment',
                          style: AppTextStyles.label(
                            context,
                          ).copyWith(color: palette.textSecondary),
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        SegmentedButton<String>(
                          segments: [
                            ButtonSegment(
                              value: 'PICKUP',
                              enabled: _canChoosePickup,
                              label: const Text('Pickup'),
                              icon: const Icon(
                                Icons.storefront_outlined,
                                size: 18,
                              ),
                            ),
                            ButtonSegment(
                              value: 'DELIVERY',
                              enabled: _canChooseDelivery,
                              label: const Text('Delivery'),
                              icon: const Icon(
                                Icons.local_shipping_outlined,
                                size: 18,
                              ),
                            ),
                          ],
                          emptySelectionAllowed: true,
                          selected: _fulfillmentMethod == null
                              ? const <String>{}
                              : {_fulfillmentMethod!},
                          onSelectionChanged: _isSubmitting
                              ? null
                              : (selection) {
                                  setState(() {
                                    _fulfillmentMethod = selection.isEmpty
                                        ? null
                                        : selection.first;
                                    _errorMessage = null;
                                  });
                                  _scheduleQuoteRefresh();
                                },
                        ),
                        if (!_canChoosePickup || !_canChooseDelivery) ...[
                          const SizedBox(height: AppSpacing.xs),
                          Text(
                            !_canChooseDelivery
                                ? 'This material is pickup only.'
                                : !_canChoosePickup
                                ? 'This material is delivery only.'
                                : '',
                            style: AppTextStyles.label(
                              context,
                            ).copyWith(color: palette.textMuted),
                          ),
                        ],
                        const SizedBox(height: reservationDialogSectionGap),
                        if (_isPickup)
                          PreferredWindowInput(
                            windows: _pickupWindows,
                            enabled: !_isSubmitting,
                            label: 'Preferred pickup windows (optional)',
                            onChanged: (windows) {
                              setState(
                                () => _pickupWindows
                                  ..clear()
                                  ..addAll(windows),
                              );
                              _scheduleQuoteRefresh();
                            },
                          )
                        else if (_isDelivery) ...[
                          PreferredWindowInput(
                            windows: _deliveryWindows,
                            enabled: !_isSubmitting,
                            label: 'Preferred delivery windows (optional)',
                            onChanged: (windows) {
                              setState(
                                () => _deliveryWindows
                                  ..clear()
                                  ..addAll(windows),
                              );
                              _scheduleQuoteRefresh();
                            },
                          ),
                          const SizedBox(height: reservationDialogSectionGap),
                          Text(
                            'Drop-off city',
                            style: AppTextStyles.label(
                              context,
                            ).copyWith(color: palette.textSecondary),
                          ),
                          const SizedBox(height: AppSpacing.xs),
                          TextFormField(
                            controller: _dropoffCityController,
                            enabled: !_isSubmitting,
                            decoration: InputDecoration(
                              hintText: 'e.g. Nablus, Jerusalem, Tel Aviv',
                              filled: true,
                              fillColor: palette.inputSurface,
                              contentPadding: const EdgeInsetsDirectional.all(
                                AppSpacing.sm,
                              ),
                              border: OutlineInputBorder(
                                borderRadius: AppRadius.mdAll,
                                borderSide: BorderSide(
                                  color: palette.borderSubtle,
                                ),
                              ),
                              enabledBorder: OutlineInputBorder(
                                borderRadius: AppRadius.mdAll,
                                borderSide: BorderSide(
                                  color: palette.borderSubtle,
                                ),
                              ),
                              focusedBorder: OutlineInputBorder(
                                borderRadius: AppRadius.mdAll,
                                borderSide: BorderSide(color: palette.mint),
                              ),
                            ),
                          ),
                          const SizedBox(height: reservationDialogSectionGap),
                          Text(
                            'Delivery address',
                            style: AppTextStyles.label(
                              context,
                            ).copyWith(color: palette.textSecondary),
                          ),
                          const SizedBox(height: AppSpacing.xs),
                          TextFormField(
                            controller: _deliveryAddressController,
                            enabled: !_isSubmitting,
                            minLines: 2,
                            maxLines: 3,
                            decoration: InputDecoration(
                              hintText: 'Street, building, city…',
                              filled: true,
                              fillColor: palette.inputSurface,
                              contentPadding: const EdgeInsetsDirectional.all(
                                AppSpacing.sm,
                              ),
                              border: OutlineInputBorder(
                                borderRadius: AppRadius.mdAll,
                                borderSide: BorderSide(
                                  color: palette.borderSubtle,
                                ),
                              ),
                              enabledBorder: OutlineInputBorder(
                                borderRadius: AppRadius.mdAll,
                                borderSide: BorderSide(
                                  color: palette.borderSubtle,
                                ),
                              ),
                              focusedBorder: OutlineInputBorder(
                                borderRadius: AppRadius.mdAll,
                                borderSide: BorderSide(color: palette.mint),
                              ),
                            ),
                          ),
                          const SizedBox(height: reservationDialogSectionGap),
                          Text(
                            'Safe drop-off allowed?',
                            style: AppTextStyles.label(
                              context,
                            ).copyWith(color: palette.textSecondary),
                          ),
                          const SizedBox(height: AppSpacing.xs),
                          SegmentedButton<bool>(
                            emptySelectionAllowed: true,
                            segments: const [
                              ButtonSegment(value: true, label: Text('Yes')),
                              ButtonSegment(value: false, label: Text('No')),
                            ],
                            selected: _safeDropoffAllowed == null
                                ? const <bool>{}
                                : {_safeDropoffAllowed!},
                            onSelectionChanged: _isSubmitting
                                ? null
                                : (selection) {
                                    setState(() {
                                      _safeDropoffAllowed = selection.isEmpty
                                          ? null
                                          : selection.first;
                                    });
                                  },
                          ),
                          const SizedBox(height: reservationDialogSectionGap),
                          Text(
                            'Delivery note',
                            style: AppTextStyles.label(
                              context,
                            ).copyWith(color: palette.textSecondary),
                          ),
                          const SizedBox(height: AppSpacing.xs),
                          TextFormField(
                            controller: _deliveryNoteController,
                            enabled: !_isSubmitting,
                            minLines: 2,
                            maxLines: 3,
                            maxLength: reservationMessageMaxLength,
                            decoration: InputDecoration(
                              hintText:
                                  'Gate code, landmarks, or instructions…',
                              helperText: 'Optional',
                              filled: true,
                              fillColor: palette.inputSurface,
                              contentPadding: const EdgeInsetsDirectional.all(
                                AppSpacing.sm,
                              ),
                              border: OutlineInputBorder(
                                borderRadius: AppRadius.mdAll,
                                borderSide: BorderSide(
                                  color: palette.borderSubtle,
                                ),
                              ),
                              enabledBorder: OutlineInputBorder(
                                borderRadius: AppRadius.mdAll,
                                borderSide: BorderSide(
                                  color: palette.borderSubtle,
                                ),
                              ),
                              focusedBorder: OutlineInputBorder(
                                borderRadius: AppRadius.mdAll,
                                borderSide: BorderSide(color: palette.mint),
                              ),
                            ),
                          ),
                        ] else
                          Text(
                            'Choose how you want to receive this material to continue.',
                            style: AppTextStyles.body(
                              context,
                            ).copyWith(color: palette.textMuted),
                          ),
                        const SizedBox(height: reservationDialogSectionGap),
                        ReservationPriceBreakdown(
                          quote: _quote,
                          isLoading: _quoteLoading,
                          errorMessage: _quoteError,
                          waitingForInputMessage: _quoteWaitingMessage,
                          combineWithGroup: _combineWithGroup,
                          onCombineWithGroupChanged: _isSubmitting
                              ? null
                              : (value) {
                                  setState(() => _combineWithGroup = value);
                                  _scheduleQuoteRefresh();
                                },
                        ),
                        const SizedBox(height: reservationDialogSectionGap),
                        Text(
                          'Message to supplier',
                          style: AppTextStyles.label(
                            context,
                          ).copyWith(color: palette.textSecondary),
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        TextFormField(
                          controller: _messageController,
                          enabled: !_isSubmitting,
                          minLines: 3,
                          maxLines: 5,
                          maxLength: reservationMessageMaxLength,
                          decoration: InputDecoration(
                            hintText: _isPickup
                                ? 'Add pickup notes or questions…'
                                : 'Add reservation notes or questions…',
                            helperText: 'Optional',
                            filled: true,
                            fillColor: palette.inputSurface,
                            contentPadding: const EdgeInsetsDirectional.all(
                              AppSpacing.sm,
                            ),
                            border: OutlineInputBorder(
                              borderRadius: AppRadius.mdAll,
                              borderSide: BorderSide(
                                color: palette.borderSubtle,
                              ),
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: AppRadius.mdAll,
                              borderSide: BorderSide(
                                color: palette.borderSubtle,
                              ),
                            ),
                            focusedBorder: OutlineInputBorder(
                              borderRadius: AppRadius.mdAll,
                              borderSide: BorderSide(color: palette.mint),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              Divider(height: 1, color: palette.borderSubtle),
              Padding(
                padding: const EdgeInsetsDirectional.fromSTEB(
                  AppSpacing.md,
                  AppSpacing.sm,
                  AppSpacing.md,
                  AppSpacing.md,
                ),
                child: _ReservationDialogSubmitButton(
                  isSubmitting: _isSubmitting,
                  onPressed: _canSubmitReservation ? _submit : null,
                  fullWidth: true,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ReservationDialogMaterialSummary extends StatelessWidget {
  const _ReservationDialogMaterialSummary({
    required this.material,
    required this.availabilityLabel,
  });

  final DiscoveryMaterial material;
  final String availabilityLabel;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          material.title.resolve(context),
          style: AppTextStyles.body(
            context,
          ).copyWith(color: palette.textPrimary, fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          material.category.resolve(context),
          style: AppTextStyles.label(
            context,
          ).copyWith(color: palette.textMuted),
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          availabilityLabel,
          style: AppTextStyles.label(
            context,
          ).copyWith(color: palette.textSecondary),
        ),
      ],
    );
  }
}

class _ReservationDialogQuantityStepper extends StatelessWidget {
  const _ReservationDialogQuantityStepper({
    required this.controller,
    required this.unit,
    required this.enabled,
    required this.onDecrement,
    required this.onIncrement,
    required this.validator,
  });

  final TextEditingController controller;
  final String unit;
  final bool enabled;
  final VoidCallback? onDecrement;
  final VoidCallback? onIncrement;
  final FormFieldValidator<String> validator;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Row(
      children: [
        _QuantityStepButton(
          icon: Icons.remove_rounded,
          onPressed: onDecrement,
          compact: true,
        ),
        const SizedBox(width: AppSpacing.sm),
        SizedBox(
          width: 156,
          child: TextFormField(
            controller: controller,
            enabled: enabled,
            textAlign: TextAlign.center,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            style: AppTextStyles.body(
              context,
            ).copyWith(color: palette.textPrimary, fontWeight: FontWeight.w600),
            decoration: InputDecoration(
              isDense: true,
              suffixText: unit,
              suffixStyle: AppTextStyles.label(
                context,
              ).copyWith(color: palette.textMuted),
              contentPadding: const EdgeInsetsDirectional.symmetric(
                horizontal: AppSpacing.sm,
                vertical: AppSpacing.sm,
              ),
              filled: true,
              fillColor: palette.inputSurface,
              border: OutlineInputBorder(
                borderRadius: AppRadius.mdAll,
                borderSide: BorderSide(color: palette.borderSubtle),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: AppRadius.mdAll,
                borderSide: BorderSide(color: palette.borderSubtle),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: AppRadius.mdAll,
                borderSide: BorderSide(color: palette.mint),
              ),
            ),
            validator: validator,
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        _QuantityStepButton(
          icon: Icons.add_rounded,
          onPressed: onIncrement,
          compact: true,
        ),
      ],
    );
  }
}

class _ReservationDialogSubmitButton extends StatelessWidget {
  const _ReservationDialogSubmitButton({
    required this.isSubmitting,
    required this.onPressed,
    this.fullWidth = false,
  });

  final bool isSubmitting;
  final VoidCallback? onPressed;
  final bool fullWidth;

  @override
  Widget build(BuildContext context) {
    final button = FilledButton(
      onPressed: isSubmitting ? null : onPressed,
      style: _reservationDialogSubmitButtonStyle(context),
      child: isSubmitting
          ? SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: AppThemeColors.of(context).textOnPrimary,
              ),
            )
          : const Text('Send request'),
    );

    if (fullWidth) {
      return Row(children: [Expanded(child: button)]);
    }

    return IntrinsicWidth(child: button);
  }
}

class _QuantityStepButton extends StatelessWidget {
  const _QuantityStepButton({
    required this.icon,
    required this.onPressed,
    this.compact = false,
  });

  final IconData icon;
  final VoidCallback? onPressed;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final size = compact ? 36.0 : 44.0;

    return IconButton.outlined(
      onPressed: onPressed,
      visualDensity: VisualDensity.compact,
      style: IconButton.styleFrom(
        minimumSize: Size(size, size),
        maximumSize: Size(size, size),
        padding: EdgeInsets.zero,
        side: BorderSide(color: palette.borderStrong),
        foregroundColor: palette.textPrimary,
      ),
      icon: Icon(icon, size: compact ? 18 : 20),
    );
  }
}

class MaterialBuildChecklistContextBanner extends StatelessWidget {
  const MaterialBuildChecklistContextBanner({super.key, this.componentName});

  final String? componentName;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final componentLabel = componentName?.trim();

    return Container(
      width: double.infinity,
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: palette.mint.withValues(alpha: 0.12),
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: palette.mint.withValues(alpha: 0.45)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.playlist_add_check_rounded, color: palette.mint, size: 20),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Reserving for your build checklist',
                  style: AppTextStyles.label(context).copyWith(
                    color: palette.textPrimary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                if (componentLabel != null && componentLabel.isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    componentLabel,
                    style: AppTextStyles.body(
                      context,
                    ).copyWith(color: palette.textSecondary),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
