import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../data/models/reservation_quote.dart';

class ReservationPriceBreakdown extends StatelessWidget {
  const ReservationPriceBreakdown({
    super.key,
    required this.quote,
    this.isLoading = false,
    this.errorMessage,
    this.waitingForInputMessage,
    this.combineWithGroup = true,
    this.onCombineWithGroupChanged,
    this.embedded = false,
    this.showHeader = true,
  });

  final ReservationQuote? quote;
  final bool isLoading;
  final String? errorMessage;
  final String? waitingForInputMessage;
  final bool combineWithGroup;
  final ValueChanged<bool>? onCombineWithGroupChanged;
  final bool embedded;
  final bool showHeader;

  String _formatAmount(double amount, String currency, AppLocalizations l10n) {
    final formatted = amount == amount.roundToDouble()
        ? amount.toStringAsFixed(0)
        : amount.toStringAsFixed(2);
    return l10n.reservationMoneyAmountWithCurrency(formatted);
  }

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final l10n = context.l10n;

    if (isLoading) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
        child: Row(
          children: [
            SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: palette.textMuted,
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Text(
              l10n.reservationCalculatingTotal,
              style: AppTextStyles.label(
                context,
              ).copyWith(color: palette.textSecondary),
            ),
          ],
        ),
      );
    }

    if (errorMessage != null) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(AppSpacing.sm),
        decoration: BoxDecoration(
          color: palette.hintSurface,
          borderRadius: AppRadius.mdAll,
          border: Border.all(color: materialDanger.withValues(alpha: 0.4)),
        ),
        child: Text(
          errorMessage!,
          style: AppTextStyles.label(context).copyWith(color: materialDanger),
        ),
      );
    }

    if (quote == null) {
      if (waitingForInputMessage != null &&
          waitingForInputMessage!.trim().isNotEmpty) {
        return Text(
          waitingForInputMessage!,
          style: AppTextStyles.label(
            context,
          ).copyWith(color: palette.textSecondary),
        );
      }

      return const SizedBox.shrink();
    }

    final currentQuote = quote!;

    final content = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (showHeader && !embedded) ...[
          Text(
            l10n.reservationEstimatedTotalLabel,
            style: AppTextStyles.label(
              context,
            ).copyWith(fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: AppSpacing.sm),
        ],
        if (!embedded) ...[
          _PriceRow(
            label: l10n.reservationUnitPriceLabel,
            value: _formatAmount(
              currentQuote.unitPrice,
              currentQuote.currency,
              l10n,
            ),
          ),
          _PriceRow(
            label: l10n.quantityLabelShort,
            value: currentQuote.quantity == currentQuote.quantity.roundToDouble()
                ? currentQuote.quantity.toStringAsFixed(0)
                : currentQuote.quantity.toString(),
          ),
          _PriceRow(
            label: l10n.reservationMaterialSubtotalLabel,
            value: _formatAmount(
              currentQuote.materialSubtotal,
              currentQuote.currency,
              l10n,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          _PriceRow(
            label: l10n.fulfillmentMethod,
            value: currentQuote.fulfillmentMethod == 'PICKUP'
                ? l10n.fulfillmentPickup
                : l10n.fulfillmentDelivery,
          ),
          _PriceRow(
            label: l10n.reservationDeliveryFeeLabel,
            value: _formatAmount(
              currentQuote.deliveryFee,
              currentQuote.currency,
              l10n,
            ),
          ),
        ],
        if (currentQuote.groupingAvailable &&
            currentQuote.deliveryGroupCandidate != null) ...[
          const SizedBox(height: AppSpacing.sm),
          CheckboxListTile(
            contentPadding: EdgeInsets.zero,
            dense: true,
            controlAffinity: ListTileControlAffinity.leading,
            value: combineWithGroup,
            onChanged: onCombineWithGroupChanged == null
                ? null
                : (value) => onCombineWithGroupChanged!(value ?? false),
            title: Text(
              l10n.reservationCombineDeliveryGroup,
              style: AppTextStyles.label(context),
            ),
            subtitle: Text(
              l10n.reservationCombineDeliveryGroupHint,
              style: AppTextStyles.label(
                context,
              ).copyWith(color: palette.textMuted, fontSize: 12),
            ),
          ),
        ],
        if (currentQuote.groupingApplied ||
            (combineWithGroup && currentQuote.groupingAvailable)) ...[
          Text(
            l10n.reservationCombinedDeliveryFeeNote,
            style: AppTextStyles.label(
              context,
            ).copyWith(color: palette.textMuted, fontSize: 12),
          ),
        ],
        const Divider(height: AppSpacing.lg),
        _PriceRow(
          label: l10n.reservationTotalToPayLabel,
          value: _formatAmount(
            currentQuote.totalAmount,
            currentQuote.currency,
            l10n,
          ),
          emphasized: true,
          emphasizedColor: palette.mint,
        ),
      ],
    );

    if (embedded) {
      return content;
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: palette.panelSurface,
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: content,
    );
  }
}

class _PriceRow extends StatelessWidget {
  const _PriceRow({
    required this.label,
    required this.value,
    this.emphasized = false,
    this.emphasizedColor,
  });

  final String label;
  final String value;
  final bool emphasized;
  final Color? emphasizedColor;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final style = emphasized
        ? AppTextStyles.body(context).copyWith(fontWeight: FontWeight.w700)
        : AppTextStyles.label(context).copyWith(color: palette.textSecondary);
    final valueStyle = emphasized
        ? AppTextStyles.body(context).copyWith(
            fontWeight: FontWeight.w700,
            color: emphasizedColor ?? palette.textPrimary,
            fontSize: 18,
          )
        : AppTextStyles.label(context);

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.xs),
      child: Row(
        children: [
          Expanded(child: Text(label, style: style)),
          Text(value, style: valueStyle),
        ],
      ),
    );
  }
}
