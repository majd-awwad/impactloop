import 'package:flutter/material.dart';

import '../../../../../app/theme/app_spacing.dart';
import '../../../../../app/theme/app_text_styles.dart';
import '../../../../../l10n/l10n.dart';
import '../../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../../deliveries/data/models/saved_dropoff_address.dart';
import 'reservation_form_theme.dart';
import 'reservation_saved_address_selector.dart';
import 'reservation_section_header.dart';

class ReservationDeliveryDetailsSection extends StatelessWidget {
  const ReservationDeliveryDetailsSection({
    super.key,
    required this.cityController,
    required this.addressController,
    required this.deliveryNoteController,
    required this.cityFieldKey,
    required this.addressFieldKey,
    required this.enabled,
    required this.safeDropoffAllowed,
    required this.paymentMethod,
    required this.onSafeDropoffChanged,
    this.savedAddresses = const [],
    this.selectedSavedAddressId,
    this.onSavedAddressSelected,
    this.deliveryNoteMaxLength = 250,
  });

  final TextEditingController cityController;
  final TextEditingController addressController;
  final TextEditingController deliveryNoteController;
  final GlobalKey cityFieldKey;
  final GlobalKey addressFieldKey;
  final bool enabled;
  final bool safeDropoffAllowed;
  final String paymentMethod;
  final ValueChanged<bool> onSafeDropoffChanged;
  final List<SavedDropoffAddress> savedAddresses;
  final String? selectedSavedAddressId;
  final ValueChanged<SavedDropoffAddress>? onSavedAddressSelected;
  final int deliveryNoteMaxLength;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final l10n = context.l10n;
    final cashSelected = paymentMethod == 'CASH';
    final safeDropoffEnabled = !cashSelected;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (savedAddresses.isNotEmpty) ...[
          ReservationFieldLabel(label: l10n.savedDropoffAddress),
          const SizedBox(height: AppSpacing.xs),
          ReservationSavedAddressSelector(
            addresses: savedAddresses,
            selectedAddressId: selectedSavedAddressId,
            enabled: enabled,
            onAddressSelected: (address) {
              onSavedAddressSelected?.call(address);
            },
          ),
          const SizedBox(height: ReservationFormTheme.fieldGap),
        ],
        ReservationFieldLabel(label: l10n.city, required: true),
        const SizedBox(height: AppSpacing.xs),
        TextFormField(
          key: cityFieldKey,
          controller: cityController,
          enabled: enabled,
          textInputAction: TextInputAction.next,
          decoration: ReservationFormTheme.inputDecoration(
            context,
            hintText: l10n.reservationChooseCityHint,
          ),
          validator: (value) {
            if (value == null || value.trim().isEmpty) {
              return l10n.countryAndCityRequired;
            }
            return null;
          },
        ),
        const SizedBox(height: ReservationFormTheme.fieldGap),
        ReservationFieldLabel(
          label: l10n.reservationDeliveryAddressLabel,
          required: true,
        ),
        const SizedBox(height: AppSpacing.xs),
        TextFormField(
          key: addressFieldKey,
          controller: addressController,
          enabled: enabled,
          minLines: 2,
          maxLines: 3,
          textInputAction: TextInputAction.next,
          decoration: ReservationFormTheme.inputDecoration(
            context,
            hintText: l10n.reservationDeliveryAddressHint,
          ),
          validator: (value) {
            if (value == null || value.trim().isEmpty) {
              return l10n.reservationDeliveryAddressRequired;
            }
            return null;
          },
        ),
        const SizedBox(height: ReservationFormTheme.fieldGap),
        SwitchListTile(
          key: const ValueKey('reservation-safe-dropoff-switch'),
          contentPadding: EdgeInsets.zero,
          value: safeDropoffAllowed,
          onChanged: enabled && safeDropoffEnabled
              ? onSafeDropoffChanged
              : null,
          title: Text(
            l10n.reservationSafeDropoffLabel,
            style: AppTextStyles.body(context).copyWith(
              color: palette.textPrimary,
              fontWeight: FontWeight.w500,
              fontSize: 14,
            ),
          ),
          subtitle: Text(
            cashSelected
                ? l10n.reservationPaymentCashInPerson
                : l10n.reservationSafeDropoffHint,
            style: ReservationFormTheme.helperStyle(context, palette),
          ),
          activeThumbColor: palette.mint,
          activeTrackColor: palette.mint.withValues(alpha: 0.35),
        ),
        const SizedBox(height: ReservationFormTheme.fieldGap),
        ReservationFieldLabel(label: l10n.reservationDeliveryNoteLabel),
        const SizedBox(height: AppSpacing.xs),
        TextFormField(
          controller: deliveryNoteController,
          enabled: enabled,
          minLines: 2,
          maxLines: 3,
          maxLength: deliveryNoteMaxLength,
          decoration: ReservationFormTheme.inputDecoration(
            context,
            hintText: l10n.reservationDeliveryNoteHint,
            helperText: l10n.fieldOptional,
          ),
        ),
      ],
    );
  }
}
