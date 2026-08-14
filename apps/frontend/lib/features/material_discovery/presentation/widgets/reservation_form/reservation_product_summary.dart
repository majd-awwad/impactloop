import 'package:flutter/material.dart';

import '../../../../../app/theme/app_radius.dart';
import '../../../../../app/theme/app_spacing.dart';
import '../../../../../app/theme/app_text_styles.dart';
import '../../../../../l10n/l10n.dart';
import '../../../../../shared/models/localized_text.dart';
import '../../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../../reservations/data/models/reservation_quote.dart';
import '../../../../reservations/presentation/widgets/reservation_price_breakdown.dart';
import '../../../domain/discovery_material.dart';
import '../../reservation_dialog_copy.dart';
import 'reservation_form_theme.dart';

class ReservationProductSummary extends StatelessWidget {
  const ReservationProductSummary({
    super.key,
    required this.material,
    required this.quote,
    required this.isLoading,
    required this.errorMessage,
    required this.waitingForInputMessage,
    required this.combineWithGroup,
    required this.fulfillmentMethod,
    required this.quantity,
    this.onCombineWithGroupChanged,
    this.compact = false,
    this.showContainer = true,
  });

  final DiscoveryMaterial material;
  final ReservationQuote? quote;
  final bool isLoading;
  final String? errorMessage;
  final String? waitingForInputMessage;
  final bool combineWithGroup;
  final String? fulfillmentMethod;
  final double? quantity;
  final ValueChanged<bool>? onCombineWithGroupChanged;
  final bool compact;
  final bool showContainer;

  String _formatAmount(double amount, AppLocalizations l10n) {
    return l10n.reservationMoneyAmountWithCurrency(
      amount == amount.roundToDouble()
          ? amount.toStringAsFixed(0)
          : amount.toStringAsFixed(2),
    );
  }

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final l10n = context.l10n;
    final availableLabel = formatReservationAvailableQuantityLabel(
      availableQuantity: material.availableQuantity,
      unit: material.unit,
      l10n: l10n,
    );

    return Container(
      padding: EdgeInsetsDirectional.all(
        compact ? AppSpacing.md : AppSpacing.lg,
      ),
      decoration: showContainer
          ? ReservationFormTheme.surfaceCard(palette)
          : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(
                Icons.shopping_bag_outlined,
                color: palette.textSecondary,
                size: ReservationFormTheme.sectionIconSize,
              ),
              const SizedBox(width: AppSpacing.xs),
              Expanded(
                child: Text(
                  l10n.reservationOrderSummary,
                  style: AppTextStyles.body(context).copyWith(
                    color: palette.textPrimary,
                    fontWeight: FontWeight.w600,
                    fontSize: 15,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _MaterialThumbnail(material: material),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      material.title.resolve(context),
                      style: AppTextStyles.body(context).copyWith(
                        color: palette.textPrimary,
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      material.category.resolve(context),
                      style: ReservationFormTheme.helperStyle(
                        context,
                        palette,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      availableLabel,
                      style: ReservationFormTheme.helperStyle(
                        context,
                        palette,
                      ).copyWith(color: palette.textSecondary),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (quote != null) ...[
            const SizedBox(height: AppSpacing.md),
            Divider(height: 1, color: palette.borderSubtle),
            const SizedBox(height: AppSpacing.sm),
            _SummaryRow(
              label: l10n.reservationUnitPriceLabel,
              value: _formatAmount(quote!.unitPrice, l10n),
            ),
            _SummaryRow(
              label: l10n.quantityLabelShort,
              value: formatReservationQuantity(quote!.quantity),
            ),
            _SummaryRow(
              label: l10n.reservationMaterialSubtotalLabel,
              value: _formatAmount(quote!.materialSubtotal, l10n),
            ),
            _SummaryRow(
              label: l10n.fulfillmentMethod,
              value: quote!.fulfillmentMethod == 'PICKUP'
                  ? l10n.fulfillmentPickup
                  : l10n.fulfillmentDelivery,
            ),
            _SummaryRow(
              label: l10n.reservationDeliveryFeeLabel,
              value: _formatAmount(quote!.deliveryFee, l10n),
            ),
          ] else if (quantity != null) ...[
            const SizedBox(height: AppSpacing.md),
            _SummaryRow(
              label: l10n.quantityLabelShort,
              value: formatReservationQuantity(quantity!),
            ),
            if (fulfillmentMethod != null)
              _SummaryRow(
                label: l10n.fulfillmentMethod,
                value: fulfillmentMethod == 'PICKUP'
                    ? l10n.fulfillmentPickup
                    : l10n.fulfillmentDelivery,
              ),
          ],
          const SizedBox(height: AppSpacing.sm),
          ReservationPriceBreakdown(
            quote: quote,
            isLoading: isLoading,
            errorMessage: errorMessage,
            waitingForInputMessage: waitingForInputMessage,
            combineWithGroup: combineWithGroup,
            onCombineWithGroupChanged: onCombineWithGroupChanged,
            embedded: true,
            showHeader: false,
          ),
        ],
      ),
    );
  }
}

class _MaterialThumbnail extends StatelessWidget {
  const _MaterialThumbnail({required this.material});

  final DiscoveryMaterial material;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final imageUrl = material.imageUrl;

    return Container(
      width: 68,
      height: 68,
      decoration: BoxDecoration(
        color: palette.mutedSurface.withValues(alpha: 0.35),
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      clipBehavior: Clip.antiAlias,
      child: imageUrl != null && imageUrl.isNotEmpty
          ? Image.network(
              imageUrl,
              fit: BoxFit.cover,
              errorBuilder: (_, _, _) => _placeholder(context),
            )
          : _placeholder(context),
    );
  }

  Widget _placeholder(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Center(
      child: Icon(
        material.heroIconData,
        color: palette.textMuted,
        size: 28,
      ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  const _SummaryRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: ReservationFormTheme.helperStyle(context, palette),
            ),
          ),
          Text(
            value,
            style: AppTextStyles.label(context).copyWith(
              color: palette.textPrimary,
              fontWeight: FontWeight.w500,
              fontSize: 13,
            ),
          ),
        ],
      ),
    );
  }
}

class ReservationMobileSummaryCollapsible extends StatelessWidget {
  const ReservationMobileSummaryCollapsible({
    super.key,
    required this.material,
    required this.quote,
    required this.isLoading,
    required this.errorMessage,
    required this.waitingForInputMessage,
    required this.combineWithGroup,
    required this.fulfillmentMethod,
    required this.quantity,
    this.onCombineWithGroupChanged,
  });

  final DiscoveryMaterial material;
  final ReservationQuote? quote;
  final bool isLoading;
  final String? errorMessage;
  final String? waitingForInputMessage;
  final bool combineWithGroup;
  final String? fulfillmentMethod;
  final double? quantity;
  final ValueChanged<bool>? onCombineWithGroupChanged;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final l10n = context.l10n;
    final totalLabel = quote != null
        ? l10n.reservationMoneyAmountWithCurrency(
            quote!.totalAmount == quote!.totalAmount.roundToDouble()
                ? quote!.totalAmount.toStringAsFixed(0)
                : quote!.totalAmount.toStringAsFixed(2),
          )
        : l10n.reservationEstimatedTotalPending;

    return Container(
      decoration: ReservationFormTheme.surfaceCard(palette),
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          key: const ValueKey('reservation-mobile-summary'),
          tilePadding: const EdgeInsetsDirectional.symmetric(
            horizontal: AppSpacing.md,
            vertical: 2,
          ),
          childrenPadding: const EdgeInsetsDirectional.fromSTEB(
            AppSpacing.md,
            0,
            AppSpacing.md,
            AppSpacing.md,
          ),
          leading: Icon(
            Icons.shopping_bag_outlined,
            size: ReservationFormTheme.metaIconSize,
            color: palette.textSecondary,
          ),
          title: Text(
            l10n.reservationOrderSummary,
            style: AppTextStyles.body(context).copyWith(
              fontWeight: FontWeight.w600,
              fontSize: 14,
            ),
          ),
          subtitle: Text(
            totalLabel,
            style: AppTextStyles.label(context).copyWith(
              color: palette.mint,
              fontWeight: FontWeight.w700,
            ),
          ),
          children: [
            ReservationProductSummary(
              material: material,
              quote: quote,
              isLoading: isLoading,
              errorMessage: errorMessage,
              waitingForInputMessage: waitingForInputMessage,
              combineWithGroup: combineWithGroup,
              fulfillmentMethod: fulfillmentMethod,
              quantity: quantity,
              onCombineWithGroupChanged: onCombineWithGroupChanged,
              compact: true,
              showContainer: false,
            ),
          ],
        ),
      ),
    );
  }
}
