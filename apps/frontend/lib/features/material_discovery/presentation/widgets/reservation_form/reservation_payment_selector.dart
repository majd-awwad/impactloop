import 'package:flutter/material.dart';

import '../../../../../app/theme/app_spacing.dart';
import '../../../../../l10n/l10n.dart';
import '../../../../../shared/widgets/materials/materials_ui_palette.dart';
import 'reservation_form_theme.dart';

class ReservationPaymentSelector extends StatelessWidget {
  const ReservationPaymentSelector({
    super.key,
    required this.selectedMethod,
    required this.enabled,
    required this.onChanged,
  });

  final String selectedMethod;
  final bool enabled;
  final ValueChanged<String> onChanged;

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

            final cardOption = ReservationOptionCard(
              key: const ValueKey('reservation-payment-card'),
              title: l10n.reservationPaymentCard,
              subtitle: l10n.reservationPaymentCardBeforeFulfillment,
              icon: Icons.credit_card_outlined,
              selected: selectedMethod == 'CARD',
              enabled: enabled,
              onTap: enabled ? () => onChanged('CARD') : null,
            );

            final cashOption = ReservationOptionCard(
              key: const ValueKey('reservation-payment-cash'),
              title: l10n.reservationPaymentCash,
              subtitle: l10n.reservationPaymentCashAtHandover,
              icon: Icons.payments_outlined,
              selected: selectedMethod == 'CASH',
              enabled: enabled,
              onTap: enabled ? () => onChanged('CASH') : null,
            );

            if (stackVertically) {
              return Column(
                children: [
                  cardOption,
                  const SizedBox(height: AppSpacing.sm),
                  cashOption,
                ],
              );
            }

            return Row(
              children: [
                Expanded(child: cardOption),
                const SizedBox(width: AppSpacing.sm),
                Expanded(child: cashOption),
              ],
            );
          },
        ),
        const SizedBox(height: AppSpacing.sm),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(
              Icons.info_outline_rounded,
              size: ReservationFormTheme.metaIconSize,
              color: palette.textMuted,
            ),
            const SizedBox(width: AppSpacing.xs),
            Expanded(
              child: Text(
                l10n.reservationPaymentCardFasterHint,
                style: ReservationFormTheme.helperStyle(context, palette),
              ),
            ),
          ],
        ),
      ],
    );
  }
}
