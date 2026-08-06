import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../l10n/l10n.dart';
import '../../../reservations/data/models/learner_reservation.dart';
import '../../data/models/payment_order.dart';
import '../../data/models/reservation_payment_requirement.dart';
import 'checkout_reservation_summary_card.dart';

String checkoutMoney(AppLocalizations l10n, String amount) {
  return l10n.reservationMoneyAmountWithCurrency(amount);
}

String? _asMoneyString(double? value) {
  if (value == null) return null;
  return value.toStringAsFixed(2);
}

String? checkoutCombinedRemainingAmount({
  required PaymentOrder order,
  LearnerReservation? reservation,
  ReservationPaymentRequirement? requirement,
}) {
  final fromSummary = reservation?.paymentSummary?.outstandingAmount;
  if (fromSummary != null && fromSummary.trim().isNotEmpty) {
    return fromSummary.trim();
  }

  final unpaid = requirement?.orders
          .where(
            (row) =>
                row.isCurrent &&
                (row.status == 'REQUIRES_PAYMENT' ||
                    row.status == 'CHECKOUT_PENDING'),
          )
          .map((row) => row.amount)
          .where((amount) => amount.trim().isNotEmpty)
          .toList(growable: false) ??
      const <String>[];

  if (unpaid.isEmpty) {
    return order.amount;
  }
  if (unpaid.length == 1) {
    return unpaid.first;
  }

  try {
    final total = unpaid.fold<double>(
      0,
      (sum, amount) => sum + double.parse(amount),
    );
    return total.toStringAsFixed(2);
  } catch (_) {
    return unpaid.join(' + ');
  }
}

bool checkoutHasCombinedSiblingOrders({
  required PaymentOrder order,
  ReservationPaymentRequirement? requirement,
}) {
  if (requirement == null) return false;
  return requirement.orders.any(
    (row) =>
        row.id != order.id &&
        row.isCurrent &&
        row.canStartCheckout,
  );
}

class CheckoutAmountSummaryCard extends StatelessWidget {
  const CheckoutAmountSummaryCard({
    super.key,
    required this.order,
    this.reservation,
    this.requirement,
  });

  final PaymentOrder order;
  final LearnerReservation? reservation;
  final ReservationPaymentRequirement? requirement;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = AppThemeColors.of(context);

    final materialAmount = requirement?.material.amount ??
        _asMoneyString(reservation?.materialSubtotal) ??
        (order.isMaterial ? order.amount : null);
    final deliveryAmount = requirement?.deliveryFee?.amount ??
        _asMoneyString(reservation?.deliveryFee);
    final materialPaid = requirement?.material.isPaid == true;
    final deliveryPaid = requirement?.deliveryFee?.isPaid == true;

    final previouslyPaidParts = <String>[];
    if (materialPaid && requirement?.material.amount != null) {
      previouslyPaidParts.add(requirement!.material.amount!);
    }
    if (deliveryPaid && requirement?.deliveryFee?.amount != null) {
      previouslyPaidParts.add(requirement!.deliveryFee!.amount!);
    }
    // Display previously paid as server strings when available; otherwise 0.00
    // for this single-order checkout context.
    final previouslyPaidDisplay = previouslyPaidParts.isEmpty
        ? '0.00'
        : previouslyPaidParts.length == 1
            ? previouslyPaidParts.first
            : previouslyPaidParts.join(' + ');

    final remainingAmount = checkoutCombinedRemainingAmount(
      order: order,
      reservation: reservation,
      requirement: requirement,
    )!;

    return CheckoutSurfaceCard(
      title: l10n.checkoutAmountSummaryTitle,
      titleIcon: Icons.receipt_long_outlined,
      child: Column(
        children: [
          if (materialAmount != null)
            _AmountRow(
              label: l10n.checkoutItemPrice,
              value: checkoutMoney(l10n, materialAmount),
            ),
          if (deliveryAmount != null &&
              deliveryAmount != '0' &&
              deliveryAmount != '0.00') ...[
            const SizedBox(height: AppSpacing.sm),
            _AmountRow(
              label: l10n.checkoutDeliveryFees,
              value: checkoutMoney(l10n, deliveryAmount),
            ),
          ],
          const SizedBox(height: AppSpacing.sm),
          _AmountRow(
            label: l10n.checkoutTotalRequired,
            value: checkoutMoney(
              l10n,
              _asMoneyString(reservation?.totalAmount) ??
                  requirement?.material.amount ??
                  order.amount,
            ),
            emphasized: true,
          ),
          const SizedBox(height: AppSpacing.sm),
          _AmountRow(
            label: l10n.checkoutPreviouslyPaid,
            value: checkoutMoney(l10n, previouslyPaidDisplay),
          ),
          const SizedBox(height: AppSpacing.md),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: colors.dangerSoft,
              borderRadius: AppRadius.mdAll,
              border: Border.all(color: colors.danger.withValues(alpha: 0.28)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    l10n.checkoutRemainingAmount,
                    style: AppTextStyles.subtitle(context).copyWith(
                      color: colors.danger,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                Text(
                  checkoutMoney(l10n, remainingAmount),
                  style: AppTextStyles.title(context).copyWith(
                    color: colors.danger,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class CheckoutPurposeCard extends StatelessWidget {
  const CheckoutPurposeCard({
    super.key,
    required this.order,
    this.requirement,
  });

  final PaymentOrder order;
  final ReservationPaymentRequirement? requirement;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = AppThemeColors.of(context);
    final combined = checkoutHasCombinedSiblingOrders(
      order: order,
      requirement: requirement,
    );

    return CheckoutSurfaceCard(
      title: combined
          ? l10n.checkoutCombinedPaymentTitle
          : (order.isDeliveryFee
              ? l10n.checkoutPurposeDeliveryTitle
              : l10n.checkoutPurposeMaterialTitle),
      titleIcon: Icons.payments_outlined,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            combined
                ? l10n.checkoutCombinedPaymentHint
                : (order.isDeliveryFee
                    ? l10n.checkoutPurposeDeliveryHint
                    : l10n.checkoutPurposeMaterialHint),
            style: AppTextStyles.label(context).copyWith(
              color: colors.textSecondary,
              height: 1.35,
            ),
          ),
          if (combined) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              checkoutMoney(
                l10n,
                checkoutCombinedRemainingAmount(
                      order: order,
                      requirement: requirement,
                    ) ??
                    order.amount,
              ),
              style: AppTextStyles.subtitle(context).copyWith(
                color: colors.primary,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class CheckoutIncludesSection extends StatelessWidget {
  const CheckoutIncludesSection({
    super.key,
    required this.order,
    this.reservation,
    this.requirement,
  });

  final PaymentOrder order;
  final LearnerReservation? reservation;
  final ReservationPaymentRequirement? requirement;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = AppThemeColors.of(context);
    final isPickup = (reservation?.fulfillmentMethod ?? 'PICKUP') == 'PICKUP';
    final combined = checkoutHasCombinedSiblingOrders(
      order: order,
      requirement: requirement,
    );

    final items = <String>[
      l10n.checkoutIncludesConfirmReservation,
      if ((order.isMaterial || combined) && isPickup)
        l10n.checkoutIncludesPickupCode,
      if (!isPickup || order.isDeliveryFee || combined)
        l10n.checkoutIncludesDeliveryDispatch,
    ];

    return CheckoutSurfaceCard(
      title: l10n.checkoutPaymentIncludesTitle,
      titleIcon: Icons.checklist_rtl_rounded,
      child: Column(
        children: [
          for (final item in items) ...[
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.check_circle_rounded, size: 18, color: colors.success),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Text(
                    item,
                    style: AppTextStyles.body(context).copyWith(height: 1.35),
                  ),
                ),
              ],
            ),
            if (item != items.last) const SizedBox(height: AppSpacing.sm),
          ],
        ],
      ),
    );
  }
}

class CheckoutSecureFooter extends StatelessWidget {
  const CheckoutSecureFooter({super.key, this.onLearnMore});

  final VoidCallback? onLearnMore;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = AppThemeColors.of(context);

    return InkWell(
      onTap: onLearnMore,
      borderRadius: AppRadius.mdAll,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: colors.primarySoft.withValues(alpha: 0.55),
          borderRadius: AppRadius.mdAll,
          border: Border.all(color: colors.primary.withValues(alpha: 0.18)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(Icons.shield_outlined, color: colors.primary, size: 22),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    l10n.checkoutSecurePaymentTitle,
                    style: AppTextStyles.subtitle(context).copyWith(
                      fontWeight: FontWeight.w700,
                      color: colors.primary,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    l10n.checkoutSecurePaymentBody,
                    style: AppTextStyles.label(context).copyWith(
                      color: colors.textSecondary,
                      height: 1.4,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AmountRow extends StatelessWidget {
  const _AmountRow({
    required this.label,
    required this.value,
    this.emphasized = false,
  });

  final String label;
  final String value;
  final bool emphasized;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return Row(
      children: [
        Expanded(
          child: Text(
            label,
            style: AppTextStyles.label(context).copyWith(
              color: colors.textSecondary,
              fontWeight: emphasized ? FontWeight.w700 : FontWeight.w500,
            ),
          ),
        ),
        Text(
          value,
          style: (emphasized
                  ? AppTextStyles.subtitle(context)
                  : AppTextStyles.label(context))
              .copyWith(fontWeight: FontWeight.w700),
        ),
      ],
    );
  }
}
