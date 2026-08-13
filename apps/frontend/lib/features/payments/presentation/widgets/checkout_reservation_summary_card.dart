import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../core/format/localized_formatters.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../reservations/data/models/learner_reservation.dart';
import '../../../reservations/presentation/learner_reservation_payment_presentation.dart';
import '../../../reservations/presentation/learner_reservation_ui_helpers.dart';
import '../../data/models/payment_order.dart';

class CheckoutSurfaceCard extends StatelessWidget {
  const CheckoutSurfaceCard({
    super.key,
    required this.child,
    this.title,
    this.titleIcon,
    this.padding = const EdgeInsets.all(AppSpacing.md),
    this.highlighted = false,
  });

  final Widget child;
  final String? title;
  final IconData? titleIcon;
  final EdgeInsets padding;
  final bool highlighted;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return Container(
      width: double.infinity,
      padding: padding,
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(
          color: highlighted
              ? colors.primary.withValues(alpha: 0.45)
              : colors.borderSubtle,
        ),
        boxShadow: [
          BoxShadow(
            color: colors.shadow.withValues(alpha: 0.04),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (title != null) ...[
            Row(
              children: [
                if (titleIcon != null) ...[
                  Icon(titleIcon, size: 18, color: colors.primary),
                  const SizedBox(width: AppSpacing.sm),
                ],
                Expanded(
                  child: Text(
                    title!,
                    style: AppTextStyles.subtitle(context).copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
          ],
          child,
        ],
      ),
    );
  }
}

class CheckoutReservationSummaryCard extends StatelessWidget {
  const CheckoutReservationSummaryCard({
    super.key,
    this.order,
    this.reservation,
    this.onViewDetails,
  });

  final PaymentOrder? order;
  final LearnerReservation? reservation;
  final VoidCallback? onViewDetails;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = AppThemeColors.of(context);
    final material = reservation?.material;
    final supplier = reservation?.supplier;
    final isPickup = (reservation?.fulfillmentMethod ?? 'PICKUP') == 'PICKUP';

    return CheckoutSurfaceCard(
      title: l10n.checkoutReservationInfo,
      titleIcon: Icons.inventory_2_outlined,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (material != null) ...[
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _MaterialThumb(imageUrl: material.imageUrl),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        material.title,
                        style: AppTextStyles.subtitle(context).copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      if (supplier != null) ...[
                        const SizedBox(height: AppSpacing.xs),
                        Row(
                          children: [
                            Flexible(
                              child: Text(
                                supplier.displayName,
                                style: AppTextStyles.label(context).copyWith(
                                  color: colors.textSecondary,
                                ),
                              ),
                            ),
                            const SizedBox(width: AppSpacing.xs),
                            Icon(
                              Icons.verified_rounded,
                              size: 16,
                              color: colors.success,
                            ),
                          ],
                        ),
                      ],
                      const SizedBox(height: AppSpacing.sm),
                      Wrap(
                        spacing: AppSpacing.sm,
                        runSpacing: AppSpacing.xs,
                        children: [
                          Text(
                            l10n.checkoutQuantityLabel(
                              reservation?.quantityRequested.toInt() ?? 1,
                            ),
                            style: AppTextStyles.label(context).copyWith(
                              color: colors.textMuted,
                            ),
                          ),
                          Text(
                            '·',
                            style: TextStyle(color: colors.textMuted),
                          ),
                          Text(
                            isPickup
                                ? l10n.checkoutFulfillmentPickup
                                : l10n.checkoutFulfillmentDelivery,
                            style: AppTextStyles.label(context).copyWith(
                              color: colors.textMuted,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            Divider(color: colors.borderSubtle),
            const SizedBox(height: AppSpacing.md),
          ],
          if (reservation != null) ...[
            _InfoRow(
              label: l10n.checkoutReservationDateLabel,
              value: LocalizedFormatters(l10n).date(reservation!.createdAt),
            ),
            const SizedBox(height: AppSpacing.sm),
            Row(
              children: [
                Expanded(
                  child: Text(
                    l10n.checkoutReservationStatusLabel,
                    style: AppTextStyles.label(context).copyWith(
                      color: colors.textMuted,
                    ),
                  ),
                ),
                AppStatusBadge(
                  label: learnerReservationListStatusLabel(
                    reservation!,
                    l10n: l10n,
                  ),
                  tone: reservation!.isAccepted
                      ? AppStatusTone.success
                      : AppStatusTone.neutral,
                ),
              ],
            ),
            if (formatPickupWindow(reservation!, l10n: l10n) case final window?) ...[
              const SizedBox(height: AppSpacing.sm),
              _InfoRow(
                label: l10n.checkoutPickupWindowLabel,
                value: window,
              ),
            ],
          ],
          if (onViewDetails != null) ...[
            const SizedBox(height: AppSpacing.md),
            OutlinedButton(
              onPressed: onViewDetails,
              style: OutlinedButton.styleFrom(
                minimumSize: const Size.fromHeight(44),
                side: BorderSide(color: colors.borderSubtle),
                foregroundColor: colors.textPrimary,
              ),
              child: Text(l10n.checkoutViewReservationDetails),
            ),
          ],
        ],
      ),
    );
  }

}

class _MaterialThumb extends StatelessWidget {
  const _MaterialThumb({this.imageUrl});

  final String? imageUrl;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return ClipRRect(
      borderRadius: AppRadius.mdAll,
      child: Container(
        width: 72,
        height: 72,
        color: colors.surfaceMuted,
        child: imageUrl == null || imageUrl!.isEmpty
            ? Icon(Icons.image_outlined, color: colors.textMuted)
            : Image.network(
                imageUrl!,
                fit: BoxFit.cover,
                errorBuilder: (context, error, stackTrace) =>
                    Icon(Icons.image_outlined, color: colors.textMuted),
              ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          flex: 2,
          child: Text(
            label,
            style: AppTextStyles.label(context).copyWith(
              color: colors.textMuted,
            ),
          ),
        ),
        Expanded(
          flex: 3,
          child: Text(
            value,
            textAlign: TextAlign.end,
            style: AppTextStyles.label(context).copyWith(
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    );
  }
}
