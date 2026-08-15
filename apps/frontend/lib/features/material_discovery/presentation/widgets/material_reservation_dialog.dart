import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../l10n/l10n.dart';
import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../deliveries/data/models/saved_dropoff_address.dart';
import '../../../deliveries/data/saved_dropoff_addresses_repository.dart';
import '../../../reservations/application/reservation_timing_policy.dart';
import '../../../reservations/data/models/create_reservation_request.dart';
import '../../../reservations/data/models/reservation_preferred_window.dart';
import '../../../reservations/data/models/reservation_quote.dart';
import '../../../reservations/data/reservations_repository.dart';
import '../../../auth/application/email_verification_actions.dart';
import '../../../reservations/presentation/reservation_create_error_message.dart';
import '../../domain/discovery_material.dart';
import '../reservation_dialog_copy.dart';
import '../widgets/preferred_window_input.dart';
import 'reservation_form/reservation_delivery_details_section.dart';
import 'reservation_form/reservation_form_logic.dart';
import 'reservation_form/reservation_fulfillment_selector.dart';
import 'reservation_form/reservation_payment_selector.dart';
import 'reservation_form/reservation_preferred_windows_section.dart';
import 'reservation_form/reservation_product_summary.dart';
import 'reservation_form/reservation_quantity_selector.dart';
import 'reservation_form/reservation_section_header.dart';
import 'reservation_form/reservation_form_theme.dart';
import 'reservation_form/reservation_submit_bar.dart';

const reservationMessageMaxLength = 500;

class MaterialReservationDialog extends ConsumerStatefulWidget {
  const MaterialReservationDialog({
    super.key,
    required this.material,
    required this.onSubmit,
    this.initialQuantity,
  });

  final DiscoveryMaterial material;
  final Future<void> Function(CreateReservationRequest request) onSubmit;
  final double? initialQuantity;

  @override
  ConsumerState<MaterialReservationDialog> createState() =>
      MaterialReservationDialogState();
}

class MaterialReservationDialogState
    extends ConsumerState<MaterialReservationDialog> {
  final _formKey = GlobalKey<FormState>();
  final _scrollController = ScrollController();
  final _cityFieldKey = GlobalKey<FormFieldState<String>>();
  final _addressFieldKey = GlobalKey<FormFieldState<String>>();
  final _paymentSectionKey = GlobalKey();

  late final TextEditingController _quantityController;
  final _messageController = TextEditingController();
  final _deliveryAddressController = TextEditingController();
  final _dropoffCityController = TextEditingController();
  final _deliveryNoteController = TextEditingController();

  String? _fulfillmentMethod;
  String _paymentMethod = 'CARD';
  final _pickupWindows = <PreferredWindowDraft>[PreferredWindowDraft()];
  final _deliveryWindows = <PreferredWindowDraft>[PreferredWindowDraft()];

  var _safeDropoffAllowed = true;
  bool? _safeDropoffBeforeCash;

  String _cachedDeliveryCity = '';
  String _cachedDeliveryAddress = '';
  String _cachedDeliveryNote = '';

  var _isSubmitting = false;
  String? _errorMessage;
  ReservationQuote? _quote;
  var _quoteLoading = false;
  String? _quoteError;
  var _combineWithGroup = true;
  Timer? _quoteDebounce;
  var _savedAddressesPrefilled = false;
  String? _selectedSavedAddressId;

  @override
  void initState() {
    super.initState();
    final defaultQuantity = resolveInitialReservationQuantity(
      availableQuantity: widget.material.availableQuantity,
      unit: widget.material.unit,
      requestedQuantity: widget.initialQuantity,
    );
    _quantityController = TextEditingController(
      text: formatReservationQuantity(defaultQuantity),
    );
    _fulfillmentMethod = initialFulfillmentMethod(widget.material);
    _quantityController.addListener(_scheduleQuoteRefresh);
    _deliveryAddressController.addListener(_scheduleQuoteRefresh);
    _dropoffCityController.addListener(_scheduleQuoteRefresh);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _refreshQuote();
      _prefillSavedAddressIfAvailable();
    });
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
    _scrollController.dispose();
    super.dispose();
  }

  void _prefillSavedAddressIfAvailable() {
    if (_savedAddressesPrefilled) {
      return;
    }

    final addressesAsync = ref.read(savedDropoffAddressesProvider);
    final addresses = addressesAsync.maybeWhen(
      data: (value) => value,
      orElse: () => null,
    );
    if (addresses == null || addresses.isEmpty) {
      return;
    }

    final defaultAddress = addresses.firstWhere(
      (address) => address.isDefault,
      orElse: () => addresses.first,
    );

    _applySavedAddress(defaultAddress);
    _savedAddressesPrefilled = true;
  }

  void _applySavedAddress(SavedDropoffAddress address) {
    setState(() {
      _selectedSavedAddressId = address.id;
      _dropoffCityController.text = address.location.city;
      _deliveryAddressController.text = address.location.addressLine ?? '';
      if (address.location.area?.trim().isNotEmpty == true &&
          (_deliveryAddressController.text.trim().isEmpty)) {
        _deliveryAddressController.text = address.location.area!.trim();
      }
    });
    _scheduleQuoteRefresh();
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
        paymentMethod: _paymentMethod,
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
            paymentMethod: _paymentMethod,
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

  bool get _isPickup => _fulfillmentMethod == 'PICKUP';

  bool get _isDelivery => _fulfillmentMethod == 'DELIVERY';

  bool get _canChoosePickup => widget.material.pickupAllowed;

  bool get _canChooseDelivery => widget.material.deliveryAvailable;

  bool get _paymentRequired => shouldShowReservationPaymentMethod(
    material: widget.material,
    fulfillmentMethod: _fulfillmentMethod,
    quantity: _parsedQuantity(),
    quote: _quote,
  );

  double get _availableQuantity => widget.material.availableQuantity;

  double? _parsedQuantity() => double.tryParse(_quantityController.text.trim());

  void _setQuantity(double value) {
    final min = reservationQuantityMinimum(widget.material.unit);
    final clamped = value.clamp(min, _availableQuantity).toDouble();
    _quantityController.text = formatReservationQuantity(clamped);
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

    setState(
      () => _setQuantity(current + reservationQuantityStep(widget.material.unit)),
    );
    _scheduleQuoteRefresh();
  }

  void _decrementQuantity() {
    final current = _parsedQuantity();
    if (current == null) {
      setState(() => _setQuantity(1));
      return;
    }

    final step = reservationQuantityStep(widget.material.unit);
    final minValue = reservationQuantityMinimum(widget.material.unit);
    if (current <= minValue) {
      return;
    }

    setState(() => _setQuantity(current - step));
    _scheduleQuoteRefresh();
  }

  void _onFulfillmentChanged(String method) {
    if (method == 'DELIVERY' && _fulfillmentMethod == 'PICKUP') {
      _cachedDeliveryCity = _dropoffCityController.text;
      _cachedDeliveryAddress = _deliveryAddressController.text;
      _cachedDeliveryNote = _deliveryNoteController.text;
    }

    setState(() {
      _fulfillmentMethod = method;
      _errorMessage = null;

      if (method == 'DELIVERY') {
        _dropoffCityController.text = _cachedDeliveryCity;
        _deliveryAddressController.text = _cachedDeliveryAddress;
        _deliveryNoteController.text = _cachedDeliveryNote;
      }
    });
    _scheduleQuoteRefresh();
  }

  void _onPaymentChanged(String method) {
    setState(() {
      if (method == 'CASH' && _paymentMethod != 'CASH') {
        _safeDropoffBeforeCash = _safeDropoffAllowed;
        _safeDropoffAllowed = false;
      } else if (method == 'CARD' && _paymentMethod == 'CASH') {
        _safeDropoffAllowed = _safeDropoffBeforeCash ?? true;
        _safeDropoffBeforeCash = null;
      }
      _paymentMethod = method;
      _combineWithGroup = true;
      _errorMessage = null;
    });
    _scheduleQuoteRefresh();
  }

  String? get _fulfillmentHelperText {
    if (!_canChoosePickup || !_canChooseDelivery) {
      if (!_canChooseDelivery) {
        return context.l10n.reservationPickupOnlyHint;
      }
      if (!_canChoosePickup) {
        return context.l10n.reservationDeliveryOnlyHint;
      }
    }
    return null;
  }

  String? get _quoteWaitingMessage {
    if (_fulfillmentMethod == null) {
      return context.l10n.reservationChooseFulfillmentHint;
    }

    if (_isDelivery && _dropoffCityController.text.trim().isEmpty) {
      return context.l10n.reservationEnterCityForQuote;
    }

    if (!_quoteLoading && _quote == null && _quoteError == null) {
      return context.l10n.reservationQuoteWaitingHint;
    }

    return null;
  }

  bool get _canSubmitReservation => canSubmitReservationForm(
    isSubmitting: _isSubmitting,
    fulfillmentMethod: _fulfillmentMethod,
    quantity: _parsedQuantity(),
    availableQuantity: _availableQuantity,
    isPickup: _isPickup,
    isDelivery: _isDelivery,
    dropoffCity: _dropoffCityController.text,
    deliveryAddress: _deliveryAddressController.text,
    quote: _quote,
    quoteLoading: _quoteLoading,
    quoteError: _quoteError,
    paymentRequired: _paymentRequired,
    paymentMethod: _paymentMethod,
  );

  String? get _submitDisabledReason {
    if (_canSubmitReservation || _isSubmitting) {
      return null;
    }

    if (_fulfillmentMethod == null) {
      return context.l10n.reservationSubmitMissingFulfillment;
    }

    if (_paymentRequired && _paymentMethod.trim().isEmpty) {
      return context.l10n.reservationSubmitMissingPayment;
    }

    if (_isDelivery) {
      if (_dropoffCityController.text.trim().isEmpty) {
        return context.l10n.reservationSubmitMissingCity;
      }
      if (_deliveryAddressController.text.trim().isEmpty) {
        return context.l10n.reservationSubmitMissingAddress;
      }
    }

    if (_quoteLoading) {
      return context.l10n.reservationCalculatingTotal;
    }

    return context.l10n.reservationSubmitMissingQuote;
  }

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

  Future<void> _focusFirstInvalidField() async {
    if (_isDelivery) {
      final cityState = _cityFieldKey.currentState;
      if (cityState != null && !cityState.validate()) {
        await _scrollToKey(_cityFieldKey);
        return;
      }

      final addressState = _addressFieldKey.currentState;
      if (addressState != null && !addressState.validate()) {
        await _scrollToKey(_addressFieldKey);
        return;
      }
    }

    if (_paymentRequired) {
      await _scrollToKey(_paymentSectionKey);
    }
  }

  Future<void> _scrollToKey(GlobalKey key) async {
    final context = key.currentContext;
    if (context == null) {
      return;
    }

    await Scrollable.ensureVisible(
      context,
      duration: const Duration(milliseconds: 250),
      curve: Curves.easeInOut,
      alignment: 0.2,
    );
  }

  Future<void> _submit() async {
    if (_isSubmitting) {
      return;
    }

    final formValid = _formKey.currentState?.validate() ?? false;
    if (!formValid) {
      await _focusFirstInvalidField();
      return;
    }

    if (_paymentRequired && _paymentMethod.trim().isEmpty) {
      setState(() => _errorMessage = context.l10n.reservationSubmitMissingPayment);
      await _scrollToKey(_paymentSectionKey);
      return;
    }

    final quantity = double.parse(_quantityController.text.trim());
    final message = _messageController.text.trim();

    if (_fulfillmentMethod == null) {
      setState(
        () => _errorMessage = context.l10n.reservationSubmitMissingFulfillment,
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
            paymentMethod: _quote?.totalAmount == 0 ? 'CARD' : _paymentMethod,
            message: message.isEmpty ? null : message,
            learnerPreferredPickupWindows: windows,
          ),
        );
      } on ApiException catch (error) {
        await _handleReservationSubmitError(error);
        return;
      } catch (_) {
        if (!mounted) return;
        setState(() {
          _isSubmitting = false;
          _errorMessage = context.l10n.deliveryRequestFailed;
        });
        return;
      }
    } else if (_isDelivery) {
      final windows = _validatedPreferredWindows(_deliveryWindows);
      if (windows == null) {
        return;
      }

      if (_paymentMethod == 'CASH' && _safeDropoffAllowed) {
        setState(
          () => _errorMessage = context.l10n.reservationPaymentCashInPerson,
        );
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
            fulfillmentMethod: 'DELIVERY',
            paymentMethod: _quote?.totalAmount == 0 ? 'CARD' : _paymentMethod,
            message: message.isEmpty ? null : message,
            learnerPreferredDeliveryWindows: windows,
            deliveryAddressText: _deliveryAddressController.text.trim(),
            dropoffCity: _dropoffCityController.text.trim(),
            safeDropoffAllowed: _safeDropoffAllowed,
            deliveryNote: _deliveryNoteController.text.trim().isEmpty
                ? null
                : _deliveryNoteController.text.trim(),
            combineWithDeliveryGroupId:
                _combineWithGroup && _quote?.deliveryGroupCandidate != null
                ? _quote!.deliveryGroupCandidate!.id
                : null,
          ),
        );
      } on ApiException catch (error) {
        await _handleReservationSubmitError(error);
        return;
      } catch (_) {
        if (!mounted) return;
        setState(() {
          _isSubmitting = false;
          _errorMessage = context.l10n.deliveryRequestFailed;
        });
        return;
      }
    } else {
      setState(
        () => _errorMessage = context.l10n.reservationChooseFulfillmentHint,
      );
      return;
    }

    if (!mounted) {
      return;
    }

    Navigator.of(context).pop();
  }

  Future<void> _handleReservationSubmitError(ApiException error) async {
    if (!mounted) {
      return;
    }

    setState(() => _isSubmitting = false);

    if (isEmailVerificationRequiredError(error)) {
      await showEmailVerificationRequiredDialog(
        context,
        ref,
        message: reservationCreateErrorMessage(error, l10n: context.l10n),
      );
      return;
    }

    setState(() {
      _errorMessage = reservationCreateErrorMessage(
        error,
        l10n: context.l10n,
      );
    });
  }

  Widget _buildFormSections({
    required bool isWide,
    required List<SavedDropoffAddress> savedAddresses,
  }) {
    final l10n = context.l10n;
    final material = widget.material;
    final palette = MaterialsUiPalette.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (_errorMessage != null) ...[
          Container(
            padding: const EdgeInsetsDirectional.all(AppSpacing.sm),
            decoration: BoxDecoration(
              color: palette.panelSurface,
              borderRadius: AppRadius.mdAll,
              border: Border.all(color: palette.borderStrong),
            ),
            child: Text(
              _errorMessage!,
              style: AppTextStyles.body(context).copyWith(
                color: palette.textPrimary,
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.md),
        ],
        ReservationSectionHeader(
          title: l10n.quantityLabelShort,
          icon: Icons.inventory_2_outlined,
        ),
        const SizedBox(height: ReservationFormTheme.titleToContentGap),
        ReservationQuantitySelector(
          controller: _quantityController,
          unit: material.unit,
          enabled: !_isSubmitting,
          availableLabel: formatReservationAvailableQuantityLabel(
            availableQuantity: material.availableQuantity,
            unit: material.unit,
            l10n: l10n,
          ),
          onDecrement: _isSubmitting ||
                  (_parsedQuantity() ?? 1) <=
                      reservationQuantityMinimum(material.unit)
              ? null
              : _decrementQuantity,
          onIncrement: _isSubmitting ||
                  (_parsedQuantity() ?? 0) >= _availableQuantity
              ? null
              : _incrementQuantity,
          validator: (value) {
            final parsed = double.tryParse(value?.trim() ?? '');
            if (parsed == null || parsed <= 0) {
              return l10n.invalidReservationQuantity;
            }
            if (parsed > material.availableQuantity) {
              return l10n.reservationQuantityUpTo(
                formatReservationQuantity(material.availableQuantity),
              );
            }
            return null;
          },
        ),
        const SizedBox(height: ReservationFormTheme.sectionGap),
        ReservationSectionHeader(
          title: l10n.fulfillmentMethod,
          icon: Icons.local_shipping_outlined,
        ),
        const SizedBox(height: ReservationFormTheme.titleToContentGap),
        ReservationFulfillmentSelector(
          selectedMethod: _fulfillmentMethod,
          canChoosePickup: _canChoosePickup,
          canChooseDelivery: _canChooseDelivery,
          enabled: !_isSubmitting,
          helperText: _fulfillmentHelperText,
          onChanged: _onFulfillmentChanged,
        ),
        if (_paymentRequired) ...[
          const SizedBox(height: ReservationFormTheme.sectionGap),
          KeyedSubtree(
            key: _paymentSectionKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                ReservationSectionHeader(
                  title: l10n.checkoutStepMethod,
                  icon: Icons.credit_card_outlined,
                  required: true,
                ),
                const SizedBox(height: ReservationFormTheme.titleToContentGap),
                ReservationPaymentSelector(
                  selectedMethod: _paymentMethod,
                  enabled: !_isSubmitting,
                  onChanged: _onPaymentChanged,
                ),
              ],
            ),
          ),
        ],
        if (_isDelivery) ...[
          const SizedBox(height: ReservationFormTheme.sectionGap),
          ReservationSectionHeader(
            title: l10n.reservationDeliveryDetails,
            icon: Icons.place_outlined,
          ),
          const SizedBox(height: ReservationFormTheme.titleToContentGap),
          ReservationDeliveryDetailsSection(
            cityController: _dropoffCityController,
            addressController: _deliveryAddressController,
            deliveryNoteController: _deliveryNoteController,
            cityFieldKey: _cityFieldKey,
            addressFieldKey: _addressFieldKey,
            enabled: !_isSubmitting,
            safeDropoffAllowed: _safeDropoffAllowed,
            paymentMethod: _paymentMethod,
            savedAddresses: savedAddresses,
            selectedSavedAddressId: _selectedSavedAddressId,
            onSavedAddressSelected: _applySavedAddress,
            onSafeDropoffChanged: (value) {
              setState(() => _safeDropoffAllowed = value);
            },
          ),
        ] else if (_fulfillmentMethod == null) ...[
          const SizedBox(height: AppSpacing.md),
          Text(
            l10n.reservationChooseFulfillmentHint,
            style: ReservationFormTheme.helperStyle(context, palette),
          ),
        ],
        if (_fulfillmentMethod != null) ...[
          const SizedBox(height: ReservationFormTheme.sectionGap),
          ReservationPreferredWindowsSection(
            windows: _isPickup ? _pickupWindows : _deliveryWindows,
            enabled: !_isSubmitting,
            isPickup: _isPickup,
            initiallyExpanded: false,
            onChanged: (windows) {
              setState(() {
                if (_isPickup) {
                  _pickupWindows
                    ..clear()
                    ..addAll(windows);
                } else {
                  _deliveryWindows
                    ..clear()
                    ..addAll(windows);
                }
              });
              _scheduleQuoteRefresh();
            },
          ),
        ],
        const SizedBox(height: ReservationFormTheme.sectionGap),
        ReservationSectionHeader(
          title: l10n.reservationMessageToSupplierLabel,
          icon: Icons.chat_bubble_outline_rounded,
          optionalLabel: l10n.fieldOptional,
        ),
        const SizedBox(height: ReservationFormTheme.titleToContentGap),
        TextFormField(
          controller: _messageController,
          enabled: !_isSubmitting,
          minLines: 3,
          maxLines: 5,
          maxLength: reservationMessageMaxLength,
          decoration: ReservationFormTheme.inputDecoration(
            context,
            hintText: _isPickup
                ? l10n.reservationMessageToSupplierPickupHint
                : l10n.reservationMessageToSupplierHint,
            helperText: l10n.fieldOptional,
          ),
        ),
        if (!isWide) ...[
          const SizedBox(height: ReservationFormTheme.sectionGap),
          ReservationMobileSummaryCollapsible(
            material: material,
            quote: _quote,
            isLoading: _quoteLoading,
            errorMessage: _quoteError,
            waitingForInputMessage: _quoteWaitingMessage,
            combineWithGroup: _combineWithGroup,
            fulfillmentMethod: _fulfillmentMethod,
            quantity: _parsedQuantity(),
            onCombineWithGroupChanged: _isSubmitting
                ? null
                : (value) {
                    setState(() => _combineWithGroup = value);
                    _scheduleQuoteRefresh();
                  },
          ),
          const SizedBox(height: AppSpacing.md),
          _TrustBadge(),
        ],
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final material = widget.material;
    final palette = MaterialsUiPalette.of(context);
    final screenSize = MediaQuery.sizeOf(context);
    final isWide = screenSize.width >= reservationFormDesktopBreakpoint;
    final dialogWidth = isWide
        ? reservationFormMaxWidth
        : screenSize.width * 0.96;
    final maxDialogHeight = screenSize.height * 0.92;
    final savedAddresses =
        ref.watch(savedDropoffAddressesProvider).maybeWhen(
              data: (value) => value,
              orElse: () => const <SavedDropoffAddress>[],
            );

    ref.listen(savedDropoffAddressesProvider, (previous, next) {
      next.whenData((addresses) {
        if (!_savedAddressesPrefilled && addresses.isNotEmpty) {
          _prefillSavedAddressIfAvailable();
        }
      });
    });

    return Dialog(
      insetPadding: EdgeInsets.symmetric(
        horizontal: isWide ? AppSpacing.lg : screenSize.width * 0.02,
        vertical: AppSpacing.md,
      ),
      backgroundColor: palette.panelSurface,
      shape: RoundedRectangleBorder(borderRadius: AppRadius.lgAll),
      child: SizedBox(
        width: dialogWidth,
        child: ConstrainedBox(
          constraints: BoxConstraints(maxHeight: maxDialogHeight),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsetsDirectional.fromSTEB(
                  AppSpacing.lg,
                  AppSpacing.md,
                  AppSpacing.sm,
                  AppSpacing.xs,
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            context.l10n.reservationRequest,
                            style: AppTextStyles.body(context).copyWith(
                              color: palette.textPrimary,
                              fontWeight: FontWeight.w700,
                              fontSize: 18,
                              height: 1.25,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            context.l10n.reservationRequestSubtitle,
                            style: ReservationFormTheme.helperStyle(
                              context,
                              palette,
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      onPressed: _isSubmitting
                          ? null
                          : () => Navigator.of(context).pop(),
                      tooltip: context.l10n.close,
                      visualDensity: VisualDensity.compact,
                      icon: Icon(
                        Icons.close_rounded,
                        color: palette.textMuted,
                      ),
                    ),
                  ],
                ),
              ),
              Divider(height: 1, color: palette.borderSubtle),
              Expanded(
                child: isWide
                    ? Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            flex: 62,
                            child: SingleChildScrollView(
                              controller: _scrollController,
                              padding: const EdgeInsetsDirectional.all(
                                AppSpacing.lg,
                              ),
                              child: Form(
                                key: _formKey,
                                child: _buildFormSections(
                                  isWide: true,
                                  savedAddresses: savedAddresses,
                                ),
                              ),
                            ),
                          ),
                          VerticalDivider(width: 1, color: palette.borderSubtle),
                          Expanded(
                            flex: 38,
                            child: SingleChildScrollView(
                              padding: const EdgeInsetsDirectional.all(
                                AppSpacing.lg,
                              ),
                              child: ReservationProductSummary(
                                material: material,
                                quote: _quote,
                                isLoading: _quoteLoading,
                                errorMessage: _quoteError,
                                waitingForInputMessage: _quoteWaitingMessage,
                                combineWithGroup: _combineWithGroup,
                                fulfillmentMethod: _fulfillmentMethod,
                                quantity: _parsedQuantity(),
                                onCombineWithGroupChanged: _isSubmitting
                                    ? null
                                    : (value) {
                                        setState(
                                          () => _combineWithGroup = value,
                                        );
                                        _scheduleQuoteRefresh();
                                      },
                              ),
                            ),
                          ),
                        ],
                      )
                    : SingleChildScrollView(
                        controller: _scrollController,
                        padding: const EdgeInsetsDirectional.all(AppSpacing.md),
                        child: Form(
                          key: _formKey,
                          child: _buildFormSections(
                            isWide: false,
                            savedAddresses: savedAddresses,
                          ),
                        ),
                      ),
              ),
              if (isWide)
                Padding(
                  padding: const EdgeInsetsDirectional.fromSTEB(
                    AppSpacing.lg,
                    0,
                    AppSpacing.lg,
                    AppSpacing.sm,
                  ),
                  child: _TrustBadge(),
                ),
              ReservationSubmitBar(
                isSubmitting: _isSubmitting,
                canSubmit: _canSubmitReservation,
                onSubmit: _submit,
                onCancel: () => Navigator.of(context).pop(),
                quote: _quote,
                showTotal: true,
                disabledReason: _submitDisabledReason,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TrustBadge extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final l10n = context.l10n;

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: palette.mint.withValues(alpha: 0.05),
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            Icons.shield_outlined,
            color: palette.mint,
            size: ReservationFormTheme.metaIconSize,
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l10n.reservationTrustBadge,
                  style: AppTextStyles.label(context).copyWith(
                    color: palette.textPrimary,
                    fontWeight: FontWeight.w600,
                    fontSize: 13,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  l10n.reservationTrustBadgeDetail,
                  style: ReservationFormTheme.helperStyle(context, palette),
                ),
              ],
            ),
          ),
        ],
      ),
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
