import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
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
  });

  final ReservationQuote? quote;
  final bool isLoading;
  final String? errorMessage;
  final String? waitingForInputMessage;
  final bool combineWithGroup;
  final ValueChanged<bool>? onCombineWithGroupChanged;

  String _formatAmount(double amount, String currency) {
    final formatted = amount == amount.roundToDouble()
        ? amount.toStringAsFixed(0)
        : amount.toStringAsFixed(2);
    return '$formatted $currency';
  }

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

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
                color: palette.mint,
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Text(
              'Calculating estimated total…',
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

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: palette.inputSurface,
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Estimated total',
            style: AppTextStyles.label(
              context,
            ).copyWith(fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: AppSpacing.sm),
          _PriceRow(
            label: 'Unit price',
            value: _formatAmount(currentQuote.unitPrice, currentQuote.currency),
          ),
          _PriceRow(
            label: 'Quantity',
            value:
                currentQuote.quantity == currentQuote.quantity.roundToDouble()
                ? currentQuote.quantity.toStringAsFixed(0)
                : currentQuote.quantity.toString(),
          ),
          _PriceRow(
            label: 'Material subtotal',
            value: _formatAmount(
              currentQuote.materialSubtotal,
              currentQuote.currency,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          _PriceRow(
            label: 'Delivery method',
            value: currentQuote.fulfillmentMethod == 'PICKUP'
                ? 'Self pickup'
                : 'Delivery',
          ),
          _PriceRow(
            label: 'Delivery fee',
            value: _formatAmount(
              currentQuote.deliveryFee,
              currentQuote.currency,
            ),
          ),
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
                'Combine with existing delivery',
                style: AppTextStyles.label(context),
              ),
              subtitle: Text(
                'You already have another delivery from this supplier that can be combined. Pay one delivery fee.',
                style: AppTextStyles.label(
                  context,
                ).copyWith(color: palette.textMuted, fontSize: 12),
              ),
            ),
          ],
          if (currentQuote.groupingApplied ||
              (combineWithGroup && currentQuote.groupingAvailable)) ...[
            Text(
              'Combined delivery fee charged once for this group.',
              style: AppTextStyles.label(
                context,
              ).copyWith(color: palette.textMuted, fontSize: 12),
            ),
          ],
          const Divider(height: AppSpacing.lg),
          _PriceRow(
            label: 'Total to pay',
            value: _formatAmount(
              currentQuote.totalAmount,
              currentQuote.currency,
            ),
            emphasized: true,
          ),
        ],
      ),
    );
  }
}

class _PriceRow extends StatelessWidget {
  const _PriceRow({
    required this.label,
    required this.value,
    this.emphasized = false,
  });

  final String label;
  final String value;
  final bool emphasized;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final style = emphasized
        ? AppTextStyles.body(context).copyWith(fontWeight: FontWeight.w700)
        : AppTextStyles.label(context).copyWith(color: palette.textSecondary);
    final valueStyle = emphasized
        ? AppTextStyles.body(context).copyWith(fontWeight: FontWeight.w700)
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
