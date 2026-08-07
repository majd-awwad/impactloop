import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../application/learner_checkout_controller.dart';

class CheckoutResultView extends StatelessWidget {
  const CheckoutResultView({
    super.key,
    required this.phase,
    this.reservationId,
    this.sessionId,
    this.failureMessage,
    this.onBackToReservation,
    this.onViewReservations,
    this.onRetry,
    this.onChangeMethod,
    this.onRetryLoad,
  });

  final CheckoutPhase phase;
  final String? reservationId;
  final String? sessionId;
  final String? failureMessage;
  final VoidCallback? onBackToReservation;
  final VoidCallback? onViewReservations;
  final VoidCallback? onRetry;
  final VoidCallback? onChangeMethod;
  final VoidCallback? onRetryLoad;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = AppThemeColors.of(context);
    final referenceId = sessionId ?? reservationId;

    return switch (phase) {
      CheckoutPhase.processing => _ProcessingBody(l10n: l10n, colors: colors),
      CheckoutPhase.succeeded || CheckoutPhase.alreadyPaid => _ResultBody(
          icon: Icons.check_rounded,
          iconColor: colors.success,
          iconBg: colors.successSoft,
          title: phase == CheckoutPhase.alreadyPaid
              ? l10n.checkoutAlreadyPaidTitle
              : l10n.checkoutSuccessTitle,
          body: phase == CheckoutPhase.alreadyPaid
              ? l10n.checkoutAlreadyPaidBody
              : l10n.checkoutSuccessBody,
          referenceId: referenceId,
          primaryLabel: l10n.checkoutBackToReservation,
          onPrimary: onBackToReservation,
          secondaryLabel: l10n.checkoutViewAllReservations,
          onSecondary: onViewReservations,
        ),
      CheckoutPhase.declined => _ResultBody(
          icon: Icons.close_rounded,
          iconColor: colors.danger,
          iconBg: colors.dangerSoft,
          title: l10n.checkoutFailureTitle,
          body: failureMessage ?? l10n.checkoutFailureBody,
          primaryLabel: l10n.checkoutRetry,
          onPrimary: onRetry,
          secondaryLabel: l10n.checkoutChangeMethod,
          onSecondary: onChangeMethod,
          secondaryOutlined: true,
        ),
      CheckoutPhase.cancelled => _ResultBody(
          icon: Icons.cancel_outlined,
          iconColor: colors.warningText,
          iconBg: colors.warningSoft,
          title: l10n.checkoutCancelledTitle,
          body: l10n.checkoutCancelledBody,
          primaryLabel: l10n.checkoutRetry,
          onPrimary: onRetry,
        ),
      CheckoutPhase.expired => _ResultBody(
          icon: Icons.timer_off_outlined,
          iconColor: colors.warningText,
          iconBg: colors.warningSoft,
          title: l10n.checkoutExpiredTitle,
          body: l10n.checkoutExpiredBody,
          primaryLabel: l10n.checkoutRetry,
          onPrimary: onRetry,
        ),
      CheckoutPhase.partiallyRefunded => _ResultBody(
          icon: Icons.hourglass_top_rounded,
          iconColor: colors.warningText,
          iconBg: colors.warningSoft,
          title: l10n.checkoutPartiallyRefundedTitle,
          body: l10n.checkoutPartiallyRefundedBody,
          referenceId: referenceId,
          primaryLabel: l10n.checkoutBackToReservation,
          onPrimary: onBackToReservation,
          secondaryLabel: l10n.checkoutViewAllReservations,
          onSecondary: onViewReservations,
        ),
      CheckoutPhase.refunded => _ResultBody(
          icon: Icons.replay_circle_filled_outlined,
          iconColor: colors.textSecondary,
          iconBg: colors.surfaceMuted,
          title: l10n.checkoutRefundedTitle,
          body: l10n.checkoutRefundedBody,
          referenceId: referenceId,
          primaryLabel: l10n.checkoutBackToReservation,
          onPrimary: onBackToReservation,
        ),
      CheckoutPhase.orderCancelled => _ResultBody(
          icon: Icons.block,
          iconColor: colors.danger,
          iconBg: colors.dangerSoft,
          title: l10n.checkoutOrderCancelledTitle,
          body: l10n.checkoutOrderCancelledBody,
          referenceId: referenceId,
          primaryLabel: l10n.checkoutBackToReservation,
          onPrimary: onBackToReservation,
        ),
      CheckoutPhase.invariantBlocked => _ResultBody(
          icon: Icons.report_gmailerrorred_outlined,
          iconColor: colors.danger,
          iconBg: colors.dangerSoft,
          title: l10n.checkoutInvariantBlockedTitle,
          body: l10n.checkoutInvariantBlockedBody,
          referenceId: referenceId,
          primaryLabel: l10n.checkoutBackToReservation,
          onPrimary: onBackToReservation,
          secondaryLabel: l10n.checkoutViewAllReservations,
          onSecondary: onViewReservations,
          secondaryOutlined: true,
        ),
      CheckoutPhase.missing => _ResultBody(
          icon: Icons.search_off_rounded,
          iconColor: colors.textSecondary,
          iconBg: colors.surfaceMuted,
          title: l10n.checkoutMissingTitle,
          body: l10n.checkoutMissingBody,
          primaryLabel: l10n.checkoutViewAllReservations,
          onPrimary: onViewReservations,
        ),
      CheckoutPhase.error => _ResultBody(
          icon: Icons.error_outline_rounded,
          iconColor: colors.danger,
          iconBg: colors.dangerSoft,
          title: l10n.checkoutLoadErrorTitle,
          body: l10n.checkoutLoadErrorBody,
          primaryLabel: l10n.checkoutRetryLoad,
          onPrimary: onRetryLoad,
          secondaryLabel: l10n.checkoutViewAllReservations,
          onSecondary: onViewReservations,
          secondaryOutlined: true,
        ),
      _ => const SizedBox.shrink(),
    };
  }
}

class _ProcessingBody extends StatelessWidget {
  const _ProcessingBody({required this.l10n, required this.colors});

  final AppLocalizations l10n;
  final AppThemeColors colors;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 420),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              width: 64,
              height: 64,
              child: CircularProgressIndicator(
                strokeWidth: 4,
                color: colors.primary,
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            Text(
              l10n.checkoutProcessingTitle,
              textAlign: TextAlign.center,
              style: AppTextStyles.title(context).copyWith(
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              l10n.checkoutProcessingBody,
              textAlign: TextAlign.center,
              style: AppTextStyles.body(context).copyWith(
                color: colors.textSecondary,
                height: 1.45,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ResultBody extends StatelessWidget {
  const _ResultBody({
    required this.icon,
    required this.iconColor,
    required this.iconBg,
    required this.title,
    required this.body,
    this.referenceId,
    this.primaryLabel,
    this.onPrimary,
    this.secondaryLabel,
    this.onSecondary,
    this.secondaryOutlined = false,
  });

  final IconData icon;
  final Color iconColor;
  final Color iconBg;
  final String title;
  final String body;
  final String? referenceId;
  final String? primaryLabel;
  final VoidCallback? onPrimary;
  final String? secondaryLabel;
  final VoidCallback? onSecondary;
  final bool secondaryOutlined;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = AppThemeColors.of(context);

    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 480),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 88,
              height: 88,
              decoration: BoxDecoration(color: iconBg, shape: BoxShape.circle),
              child: Icon(icon, size: 44, color: iconColor),
            ),
            const SizedBox(height: AppSpacing.lg),
            Text(
              title,
              textAlign: TextAlign.center,
              style: AppTextStyles.title(context).copyWith(
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              body,
              textAlign: TextAlign.center,
              style: AppTextStyles.body(context).copyWith(
                color: colors.textSecondary,
                height: 1.45,
              ),
            ),
            if (referenceId != null && referenceId!.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.md),
              Text(
                '${l10n.checkoutSuccessTransactionLabel}: $referenceId',
                textAlign: TextAlign.center,
                style: AppTextStyles.label(context).copyWith(
                  color: colors.textMuted,
                ),
              ),
            ],
            if (primaryLabel != null && onPrimary != null) ...[
              const SizedBox(height: AppSpacing.lg),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  key: const Key('checkout_result_primary'),
                  onPressed: onPrimary,
                  style: AppStatusButtonStyle.filled(
                    context,
                    AppStatusTone.primary,
                  ).copyWith(
                    minimumSize:
                        const WidgetStatePropertyAll(Size.fromHeight(48)),
                  ),
                  child: Text(primaryLabel!),
                ),
              ),
            ],
            if (secondaryLabel != null && onSecondary != null) ...[
              const SizedBox(height: AppSpacing.sm),
              if (secondaryOutlined)
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton(
                    key: const Key('checkout_result_secondary'),
                    onPressed: onSecondary,
                    style: AppStatusButtonStyle.outlined(
                      context,
                      AppStatusTone.neutral,
                    ).copyWith(
                      minimumSize:
                          const WidgetStatePropertyAll(Size.fromHeight(44)),
                    ),
                    child: Text(secondaryLabel!),
                  ),
                )
              else
                TextButton(
                  key: const Key('checkout_result_secondary'),
                  onPressed: onSecondary,
                  child: Text(secondaryLabel!),
                ),
            ],
          ],
        ),
      ),
    );
  }
}
