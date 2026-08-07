import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../l10n/l10n.dart';
import '../../../reservations/data/models/learner_reservation.dart';
import '../../data/models/payment_order.dart';
import '../../data/models/reservation_checkout_session.dart';
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
  PaymentOrder? order,
  LearnerReservation? reservation,
  ReservationPaymentRequirement? requirement,
  ReservationCheckoutSession? session,
}) {
  // Prefer authoritative CheckoutSession total (multi-reservation safe).
  final sessionTotal = session?.totalAmount;
  if (sessionTotal != null && sessionTotal.trim().isNotEmpty) {
    return sessionTotal.trim();
  }

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
    return order?.amount;
  }
  if (unpaid.length == 1) {
    return unpaid.first;
  }

  // No Dart double money math — show discrete obligations until a session exists.
  return unpaid.join(' + ');
}

/// True when this reservation checkout settles more than one outstanding order.
bool checkoutHasCombinedSiblingOrders({
  PaymentOrder? order,
  ReservationPaymentRequirement? requirement,
}) {
  if (requirement == null) return false;
  final unpaid = requirement.orders
      .where(
        (row) =>
            row.isCurrent &&
            (row.status == 'REQUIRES_PAYMENT' ||
                row.status == 'CHECKOUT_PENDING'),
      )
      .length;
  if (unpaid >= 2) return true;
  if (order == null) return unpaid >= 1 && requirement.orders.length > 1;
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
    this.order,
    this.reservation,
    this.requirement,
    this.session,
  });

  final PaymentOrder? order;
  final LearnerReservation? reservation;
  final ReservationPaymentRequirement? requirement;
  final ReservationCheckoutSession? session;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = AppThemeColors.of(context);

    final materialAmount = requirement?.material.amount ??
        _asMoneyString(reservation?.materialSubtotal) ??
        (order?.isMaterial == true ? order?.amount : null);
    final deliveryAmount = requirement?.deliveryFee?.amount ??
        _asMoneyString(reservation?.deliveryFee);
    final materialPaid = requirement?.material.isPaid == true;
    final deliveryPaid = requirement?.deliveryFee?.isPaid == true;
    final deliveryOutstanding = requirement?.deliveryFee?.isOutstanding == true;
    final onlyFeeRemaining = materialPaid && deliveryOutstanding;

    final previouslyPaidParts = <String>[];
    if (materialPaid && requirement?.material.amount != null) {
      previouslyPaidParts.add(requirement!.material.amount!);
    }
    if (deliveryPaid && requirement?.deliveryFee?.amount != null) {
      previouslyPaidParts.add(requirement!.deliveryFee!.amount!);
    }
    final previouslyPaidDisplay = previouslyPaidParts.isEmpty
        ? '0.00'
        : previouslyPaidParts.length == 1
            ? previouslyPaidParts.first
            : previouslyPaidParts.join(' + ');

    final remainingAmount = checkoutCombinedRemainingAmount(
      order: order,
      reservation: reservation,
      requirement: requirement,
      session: session,
    ) ??
        '0.00';

    final totalRequired = _asMoneyString(reservation?.totalAmount) ??
        session?.totalAmount ??
        remainingAmount;

    return CheckoutSurfaceCard(
      title: l10n.checkoutAmountSummaryTitle,
      titleIcon: Icons.receipt_long_outlined,
      child: Column(
        children: [
          if (materialAmount != null)
            _AmountRow(
              label: l10n.checkoutItemPrice,
              value: onlyFeeRemaining || materialPaid
                  ? l10n.paymentStatusPaid
                  : checkoutMoney(l10n, materialAmount),
              valueMuted: materialPaid,
            ),
          if (deliveryAmount != null &&
              deliveryAmount != '0' &&
              deliveryAmount != '0.00') ...[
            const SizedBox(height: AppSpacing.sm),
            _AmountRow(
              label: l10n.checkoutDeliveryFees,
              value: deliveryPaid
                  ? l10n.paymentStatusPaid
                  : checkoutMoney(l10n, deliveryAmount),
              valueMuted: deliveryPaid,
            ),
          ],
          const SizedBox(height: AppSpacing.sm),
          _AmountRow(
            label: l10n.checkoutTotalRequired,
            value: checkoutMoney(l10n, totalRequired),
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
    this.order,
    this.requirement,
    this.session,
  });

  final PaymentOrder? order;
  final ReservationPaymentRequirement? requirement;
  final ReservationCheckoutSession? session;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = AppThemeColors.of(context);
    final combined = checkoutHasCombinedSiblingOrders(
      order: order,
      requirement: requirement,
    );
    final materialPaid = requirement?.material.isPaid == true;
    final onlyFee = materialPaid &&
        requirement?.deliveryFee?.isOutstanding == true;

    final title = onlyFee
        ? l10n.checkoutPurposeDeliveryTitle
        : (combined
            ? l10n.checkoutCombinedPaymentTitle
            : (order?.isDeliveryFee == true
                ? l10n.checkoutPurposeDeliveryTitle
                : l10n.checkoutPurposeMaterialTitle));
    final hint = onlyFee
        ? l10n.checkoutPurposeDeliveryHint
        : (combined
            ? l10n.checkoutCombinedPaymentHint
            : (order?.isDeliveryFee == true
                ? l10n.checkoutPurposeDeliveryHint
                : l10n.checkoutPurposeMaterialHint));

    return CheckoutSurfaceCard(
      title: title,
      titleIcon: Icons.payments_outlined,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            hint,
            style: AppTextStyles.label(context).copyWith(
              color: colors.textSecondary,
              height: 1.35,
            ),
          ),
          if (combined || session != null) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              checkoutMoney(
                l10n,
                checkoutCombinedRemainingAmount(
                      order: order,
                      requirement: requirement,
                      session: session,
                    ) ??
                    order?.amount ??
                    '0.00',
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
    this.order,
    this.reservation,
    this.requirement,
  });

  final PaymentOrder? order;
  final LearnerReservation? reservation;
  final ReservationPaymentRequirement? requirement;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = AppThemeColors.of(context);
    final fulfillment = requirement?.fulfillmentMethod ??
        reservation?.fulfillmentMethod ??
        'PICKUP';
    final isPickup = fulfillment == 'PICKUP';
    final isDelivery = fulfillment == 'DELIVERY';
    final combined = checkoutHasCombinedSiblingOrders(
      order: order,
      requirement: requirement,
    );
    final materialPaid = requirement?.material.isPaid == true;
    final includesMaterial =
        !materialPaid || order?.isMaterial == true || combined;
    // Never show pickup-code messaging for DELIVERY fulfillment.
    final showPickupCode =
        isPickup && !isDelivery && (includesMaterial || combined);

    final items = <String>[
      l10n.checkoutIncludesConfirmReservation,
      if (showPickupCode) l10n.checkoutIncludesPickupCode,
      if (isDelivery ||
          order?.isDeliveryFee == true ||
          requirement?.deliveryFee?.required == true)
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
    this.valueMuted = false,
  });

  final String label;
  final String value;
  final bool emphasized;
  final bool valueMuted;

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
              .copyWith(
            fontWeight: FontWeight.w700,
            color: valueMuted ? colors.success : null,
          ),
        ),
      ],
    );
  }
}
