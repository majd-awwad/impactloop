import 'package:flutter/material.dart';

import '../../../../../app/theme/app_spacing.dart';
import '../../../../../l10n/l10n.dart';
import '../../../../../shared/widgets/materials/materials_ui_palette.dart';
import 'reservation_form_theme.dart';

/// Current MVP: cash settlement at handover. Card/electronic checkout is not
/// offered in the reservation form — infrastructure remains dormant server-side.
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
        ReservationOptionCard(
          key: const ValueKey('reservation-payment-cash'),
          title: l10n.reservationPaymentCash,
          subtitle: l10n.reservationPaymentCashAtHandover,
          icon: Icons.payments_outlined,
          selected: true,
          enabled: false,
          onTap: null,
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
                l10n.reservationPaymentCashAtHandover,
                style: ReservationFormTheme.helperStyle(context, palette),
              ),
            ),
          ],
        ),
      ],
    );
  }
}
