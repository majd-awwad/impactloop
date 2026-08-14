import 'package:flutter/material.dart';

import '../../../../../app/theme/app_spacing.dart';
import '../../../../../l10n/l10n.dart';
import '../../../../../shared/widgets/materials/materials_ui_palette.dart';
import 'reservation_form_theme.dart';

class ReservationFulfillmentSelector extends StatelessWidget {
  const ReservationFulfillmentSelector({
    super.key,
    required this.selectedMethod,
    required this.canChoosePickup,
    required this.canChooseDelivery,
    required this.enabled,
    required this.onChanged,
    this.helperText,
  });

  final String? selectedMethod;
  final bool canChoosePickup;
  final bool canChooseDelivery;
  final bool enabled;
  final ValueChanged<String> onChanged;
  final String? helperText;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final l10n = context.l10n;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        LayoutBuilder(
          builder: (context, constraints) {
            final stackVertically = constraints.maxWidth < 420;

            final pickupCard = ReservationOptionCard(
              key: const ValueKey('reservation-fulfillment-pickup'),
              title: l10n.fulfillmentPickup,
              subtitle: l10n.reservationFulfillmentPickupHint,
              icon: Icons.storefront_outlined,
              selected: selectedMethod == 'PICKUP',
              enabled: enabled && canChoosePickup,
              onTap: canChoosePickup ? () => onChanged('PICKUP') : null,
            );

            final deliveryCard = ReservationOptionCard(
              key: const ValueKey('reservation-fulfillment-delivery'),
              title: l10n.fulfillmentDelivery,
              subtitle: l10n.reservationFulfillmentDeliveryHint,
              icon: Icons.local_shipping_outlined,
              selected: selectedMethod == 'DELIVERY',
              enabled: enabled && canChooseDelivery,
              onTap: canChooseDelivery ? () => onChanged('DELIVERY') : null,
            );

            if (stackVertically) {
              return Column(
                children: [
                  pickupCard,
                  const SizedBox(height: AppSpacing.sm),
                  deliveryCard,
                ],
              );
            }

            return Row(
              children: [
                Expanded(child: pickupCard),
                const SizedBox(width: AppSpacing.sm),
                Expanded(child: deliveryCard),
              ],
            );
          },
        ),
        if (helperText != null && helperText!.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.xs),
          Text(
            helperText!,
            style: ReservationFormTheme.helperStyle(context, palette),
          ),
        ],
      ],
    );
  }
}
