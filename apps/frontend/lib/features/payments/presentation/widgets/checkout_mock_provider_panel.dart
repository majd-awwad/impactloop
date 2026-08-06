import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../application/learner_checkout_controller.dart';
import '../../data/models/payment_order.dart';
import 'checkout_amount_summary.dart';
import 'checkout_reservation_summary_card.dart';

class CheckoutMockProviderPanel extends StatelessWidget {
  const CheckoutMockProviderPanel({
    super.key,
    required this.order,
    required this.state,
    required this.onReview,
    required this.onSimulateDecline,
    required this.onCancelAttempt,
  });

  final PaymentOrder order;
  final LearnerCheckoutState state;
  final VoidCallback onReview;
  final VoidCallback onSimulateDecline;
  final VoidCallback onCancelAttempt;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = AppThemeColors.of(context);
    final blocked = state.blocksDuplicateSubmission;

    return CheckoutSurfaceCard(
      highlighted: true,
      title: l10n.checkoutMockProviderTitle,
      titleIcon: Icons.lock_outline_rounded,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            l10n.checkoutMockProviderBody,
            style: AppTextStyles.body(context).copyWith(
              color: colors.textSecondary,
              height: 1.4,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          Container(
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: colors.surfaceMuted,
              borderRadius: AppRadius.mdAll,
              border: Border.all(color: colors.borderSubtle),
            ),
            child: Row(
              children: [
                Icon(Icons.account_balance_wallet_outlined,
                    color: colors.primary),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        l10n.checkoutReviewMethodValue,
                        style: AppTextStyles.subtitle(context).copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        checkoutMoney(l10n, order.amount),
                        style: AppTextStyles.label(context).copyWith(
                          color: colors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
                AppStatusBadge(
                  label: l10n.checkoutSecurePaymentTitle,
                  tone: AppStatusTone.primary,
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          FilledButton.icon(
            key: const Key('checkout_mock_review'),
            onPressed: blocked ? null : onReview,
            icon: const Icon(Icons.lock_rounded, size: 18),
            style: AppStatusButtonStyle.filled(context, AppStatusTone.primary)
                .copyWith(
              minimumSize: const WidgetStatePropertyAll(Size.fromHeight(48)),
            ),
            label: Text(l10n.checkoutReviewOrder),
          ),
          const SizedBox(height: AppSpacing.sm),
          OutlinedButton(
            key: const Key('checkout_mock_decline'),
            onPressed: blocked ? null : onSimulateDecline,
            style: AppStatusButtonStyle.outlined(context, AppStatusTone.danger)
                .copyWith(
              minimumSize: const WidgetStatePropertyAll(Size.fromHeight(44)),
            ),
            child: Text(l10n.checkoutMockSimulateDecline),
          ),
          const SizedBox(height: AppSpacing.xs),
          TextButton(
            key: const Key('checkout_mock_cancel'),
            onPressed: blocked ? null : onCancelAttempt,
            child: Text(l10n.checkoutMockCancelAttempt),
          ),
        ],
      ),
    );
  }
}

class CheckoutReviewSheet extends StatelessWidget {
  const CheckoutReviewSheet({
    super.key,
    required this.order,
    required this.submitting,
    required this.onConfirm,
    required this.onClose,
  });

  final PaymentOrder order;
  final bool submitting;
  final VoidCallback onConfirm;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = AppThemeColors.of(context);

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.lg,
          AppSpacing.md,
          AppSpacing.lg,
          AppSpacing.lg,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    l10n.checkoutReviewTitle,
                    style: AppTextStyles.title(context),
                  ),
                ),
                IconButton(
                  onPressed: submitting ? null : onClose,
                  icon: const Icon(Icons.close_rounded),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            _ReviewRow(
              label: l10n.checkoutReviewMethodLabel,
              value: l10n.checkoutReviewMethodValue,
            ),
            const SizedBox(height: AppSpacing.sm),
            _ReviewRow(
              label: l10n.checkoutReviewAmountLabel,
              value: checkoutMoney(l10n, order.amount),
              emphasize: true,
            ),
            const SizedBox(height: AppSpacing.lg),
            FilledButton.icon(
              key: const Key('checkout_confirm_payment'),
              onPressed: submitting ? null : onConfirm,
              icon: submitting
                  ? SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: colors.textOnPrimary,
                      ),
                    )
                  : const Icon(Icons.lock_rounded, size: 18),
              style: AppStatusButtonStyle.filled(context, AppStatusTone.primary)
                  .copyWith(
                minimumSize:
                    const WidgetStatePropertyAll(Size.fromHeight(48)),
              ),
              label: Text(l10n.checkoutConfirmPayment),
            ),
          ],
        ),
      ),
    );
  }
}

class _ReviewRow extends StatelessWidget {
  const _ReviewRow({
    required this.label,
    required this.value,
    this.emphasize = false,
  });

  final String label;
  final String value;
  final bool emphasize;

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
            ),
          ),
        ),
        Text(
          value,
          style: (emphasize
                  ? AppTextStyles.subtitle(context)
                  : AppTextStyles.label(context))
              .copyWith(fontWeight: FontWeight.w700),
        ),
      ],
    );
  }
}
