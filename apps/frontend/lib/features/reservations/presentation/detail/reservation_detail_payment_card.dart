import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../core/format/localized_formatters.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../deliveries/data/models/learner_delivery.dart';
import '../../data/models/learner_reservation.dart';
import '../learner_reservation_payment_presentation.dart';
import 'reservation_detail_semantic.dart';

ReservationDetailSemantic paymentSemanticForSummary(
  LearnerReservation reservation,
) {
  final summary = reservation.paymentSummary;
  if (summary == null || summary.isPaymentsDisabled) {
    return ReservationDetailSemantic.neutral;
  }

  final tone = paymentSummaryTone(summary);
  return switch (tone) {
    AppStatusTone.success => ReservationDetailSemantic.success,
    AppStatusTone.warning => ReservationDetailSemantic.waiting,
    AppStatusTone.danger => ReservationDetailSemantic.payment,
    AppStatusTone.info => ReservationDetailSemantic.delivery,
    AppStatusTone.neutral => ReservationDetailSemantic.neutral,
    _ => ReservationDetailSemantic.neutral,
  };
}

class ReservationDetailPaymentCard extends StatelessWidget {
  const ReservationDetailPaymentCard({
    super.key,
    required this.reservation,
    required this.delivery,
    this.sectionKey,
    this.onCheckoutOrder,
  });

  final LearnerReservation reservation;
  final LearnerDelivery? delivery;
  final Key? sectionKey;
  final ValueChanged<String>? onCheckoutOrder;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final palette = MaterialsUiPalette.of(context);
    final summary = reservation.paymentSummary;

    if (summary == null || summary.isPaymentsDisabled) {
      if (_mightNeedPayment(reservation)) {
        return ReservationDetailSurfaceCard(
          key: sectionKey,
          semantic: ReservationDetailSemantic.neutral,
          title: l10n.reservationDetailPaymentTitle,
          titleIcon: Icons.payments_outlined,
          child: Text(
            l10n.paymentSummaryUnavailable,
            style: AppTextStyles.label(context).copyWith(
              color: palette.textSecondary,
            ),
          ),
        );
      }
      return SizedBox(key: sectionKey, width: 0, height: 0);
    }

    final semantic = paymentSemanticForSummary(reservation);
    final label = paymentStatusLabel(summary, l10n: l10n);
    final tone = paymentSummaryTone(summary);
    final nextStep = reservationNextStepMessage(
      reservation,
      l10n: l10n,
      delivery: delivery,
    );
    final primaryAction = resolvePrimaryAction(reservation, delivery: delivery);
    final canCheckout = summary.canStartCheckout;
    final orderId = summary.checkoutableOrderId;
    final requiresAction = summary.isPaymentActionRequired || canCheckout;
    final title = requiresAction
        ? l10n.reservationDetailPaymentRequiredTitle
        : l10n.reservationDetailPaymentTitle;

    final outstanding = summary.outstandingAmount;
    final currency = summary.currency ?? reservation.currency ?? '';

    return ReservationDetailSurfaceCard(
      key: sectionKey,
      semantic: semantic,
      title: title,
      titleIcon: Icons.credit_card_rounded,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (label != null)
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: AppStatusBadge(label: label, tone: tone),
            ),
          const SizedBox(height: AppSpacing.md),
          LayoutBuilder(
            builder: (context, constraints) {
              final stacked = constraints.maxWidth < 420;
              final totalBlock = Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    requiresAction
                        ? l10n.reservationDetailTotalRequired
                        : (summary.isPaid
                            ? l10n.reservationMoneyPaidInFull
                            : l10n.reservationDetailPaymentTitle),
                    style: AppTextStyles.label(context).copyWith(
                      color: palette.textMuted,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  if (outstanding != null && outstanding.isNotEmpty)
                    Text(
                      l10n.reservationMoneyAmountWithCurrency(outstanding),
                      style: AppTextStyles.display(context).copyWith(
                        color: palette.textPrimary,
                        fontSize: stacked ? 26 : 30,
                        fontWeight: FontWeight.w800,
                        height: 1.1,
                      ),
                    )
                  else if (summary.isPaid)
                    Icon(
                      Icons.check_circle_rounded,
                      color: semantic.foreground(context),
                      size: 28,
                    ),
                  if (currency.isNotEmpty &&
                      outstanding != null &&
                      outstanding.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      currency,
                      style: AppTextStyles.label(context).copyWith(
                        color: palette.textMuted,
                      ),
                    ),
                  ],
                ],
              );

              final breakdown = Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  ..._buildBreakdownRows(context, reservation),
                  if (outstanding != null && outstanding.isNotEmpty)
                    _AmountRow(
                      label: l10n.reservationDetailRemainingAmount,
                      value: l10n.reservationMoneyAmountWithCurrency(outstanding),
                      emphasize: true,
                    ),
                  if (summary.hasMaterialPaymentOutstanding &&
                      summary.hasDeliveryFeeOutstanding)
                    Padding(
                      padding: const EdgeInsets.only(top: AppSpacing.xs),
                      child: Text(
                        l10n.reservationMoneyBothOutstanding,
                        style: AppTextStyles.label(context).copyWith(
                          color: palette.textMuted,
                          fontSize: 12,
                        ),
                      ),
                    )
                  else if (summary.outstandingOrderCount > 0)
                    Padding(
                      padding: const EdgeInsets.only(top: AppSpacing.xs),
                      child: Text(
                        l10n.reservationMoneyOrdersRemaining(
                          summary.outstandingOrderCount,
                        ),
                        style: AppTextStyles.label(context).copyWith(
                          color: palette.textMuted,
                          fontSize: 12,
                        ),
                      ),
                    ),
                ],
              );

              if (stacked) {
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    totalBlock,
                    const SizedBox(height: AppSpacing.md),
                    breakdown,
                  ],
                );
              }

              return Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(flex: 5, child: totalBlock),
                  const SizedBox(width: AppSpacing.lg),
                  Expanded(flex: 6, child: breakdown),
                ],
              );
            },
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            nextStep,
            style: AppTextStyles.label(context).copyWith(
              color: palette.textSecondary,
            ),
          ),
          if (summary.overallStatus == 'CANCELLED')
            Padding(
              padding: const EdgeInsets.only(top: AppSpacing.sm),
              child: Text(
                l10n.previousPaymentCycleCancelled,
                style: AppTextStyles.label(context).copyWith(
                  color: palette.textMuted,
                ),
              ),
            ),
          if (summary.isRefunded)
            Padding(
              padding: const EdgeInsets.only(top: AppSpacing.sm),
              child: Text(
                l10n.previousPaymentCycleRefunded,
                style: AppTextStyles.label(context).copyWith(
                  color: palette.textMuted,
                ),
              ),
            ),
          if (summary.isRefundPending)
            Padding(
              padding: const EdgeInsets.only(top: AppSpacing.sm),
              child: Text(
                l10n.reservationNextStepRefundProcessing,
                style: AppTextStyles.label(context).copyWith(
                  color: palette.textSecondary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          if (canCheckout &&
              orderId != null &&
              (primaryAction == LearnerReservationPrimaryAction.payNow ||
                  primaryAction ==
                      LearnerReservationPrimaryAction.completePayment)) ...[
            const SizedBox(height: AppSpacing.md),
            SizedBox(
              width: double.infinity,
              height: 48,
              child: FilledButton.icon(
                onPressed: onCheckoutOrder != null
                    ? () => onCheckoutOrder!(orderId)
                    : null,
                icon: const Icon(Icons.account_balance_wallet_outlined, size: 18),
                label: Text(
                  primaryActionLabel(primaryAction, l10n: l10n),
                ),
                style: AppStatusButtonStyle.filled(
                  context,
                  AppStatusTone.primary,
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            Row(
              children: [
                Icon(Icons.lock_outline, size: 14, color: palette.textMuted),
                const SizedBox(width: AppSpacing.xs),
                Expanded(
                  child: Text(
                    l10n.reservationNextStepPaySupporting,
                    style: AppTextStyles.label(context).copyWith(
                      color: palette.textMuted,
                      fontSize: 12,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  List<Widget> _buildBreakdownRows(
    BuildContext context,
    LearnerReservation reservation,
  ) {
    final formatters = LocalizedFormatters(context.l10n);
    final currency =
        reservation.currency ?? reservation.paymentSummary?.currency ?? '';
    final rows = <Widget>[];

    void addRow(String label, double? amount) {
      if (amount == null) return;
      final formatted = formatters.number(amount, decimalDigits: 2);
      rows.add(
        _AmountRow(
          label: label,
          value: currency.isEmpty ? formatted : '$formatted $currency',
        ),
      );
    }

    addRow(
      context.l10n.reservationDetailMaterialAmount,
      reservation.materialSubtotal,
    );
    if (reservation.deliveryFee != null && reservation.deliveryFee! > 0) {
      addRow(
        context.l10n.reservationDetailDeliveryFeeAmount,
        reservation.deliveryFee,
      );
    } else if (reservation.fulfillmentMethod == 'DELIVERY' &&
        (reservation.deliveryFee == null || reservation.deliveryFee == 0)) {
      rows.add(
        _AmountRow(
          label: context.l10n.reservationDetailDeliveryFeeAmount,
          value: context.l10n.freeDeliveryLabel,
        ),
      );
    }

    return rows;
  }
}

class _AmountRow extends StatelessWidget {
  const _AmountRow({
    required this.label,
    required this.value,
    this.emphasize = false,
  });

  final String label;
  final String value;
  final bool emphasize;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.xs),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: AppTextStyles.label(context).copyWith(
                color: palette.textMuted,
                fontWeight: emphasize ? FontWeight.w700 : FontWeight.w500,
              ),
            ),
          ),
          Text(
            value,
            style: AppTextStyles.label(context).copyWith(
              color: palette.textPrimary,
              fontWeight: emphasize ? FontWeight.w800 : FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

bool _mightNeedPayment(LearnerReservation reservation) {
  return reservation.isAccepted &&
      ((reservation.materialSubtotal ?? 0) > 0 ||
          (reservation.deliveryFee ?? 0) > 0 ||
          (reservation.totalAmount ?? 0) > 0);
}
