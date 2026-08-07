import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../core/format/localized_formatters.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../application/notification_display.dart';
import '../../application/payment_notification_presentation.dart';
import '../../data/models/app_notification.dart';
import '../notification_visuals.dart';

Future<void> showPaymentNotificationDetailSheet({
  required BuildContext context,
  required AppNotification notification,
  required VoidCallback onPrimaryAction,
  VoidCallback? onSecondaryAction,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.transparent,
    builder: (context) {
      return PaymentNotificationDetailSheet(
        notification: notification,
        onPrimaryAction: onPrimaryAction,
        onSecondaryAction: onSecondaryAction,
      );
    },
  );
}

class PaymentNotificationDetailSheet extends StatelessWidget {
  const PaymentNotificationDetailSheet({
    super.key,
    required this.notification,
    required this.onPrimaryAction,
    this.onSecondaryAction,
  });

  final AppNotification notification;
  final VoidCallback onPrimaryAction;
  final VoidCallback? onSecondaryAction;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final palette = MaterialsUiPalette.of(context);
    final copy = localizedNotificationCopy(notification, l10n);
    final style = paymentNotificationVisualStyle(notification);
    final amount = formatPaymentNotificationAmount(notification, l10n);
    final status = paymentNotificationStatusCaption(notification, l10n);
    final nextStep = paymentNotificationNextStepCopy(notification, l10n);
    final actionLabel = paymentNotificationActionLabel(notification, l10n);
    final reservationLabel = paymentNotificationReservationLabel(notification);
    final materialTitle = paymentNotificationMaterialTitle(notification);
    final relativeTime = LocalizedFormatters(
      l10n,
    ).relativeTime(notification.createdAt);
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;

    return Padding(
      padding: EdgeInsetsDirectional.only(bottom: bottomInset),
      child: Align(
        alignment: Alignment.bottomCenter,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 560),
          child: Material(
            color: palette.cardSurface,
            borderRadius: const BorderRadius.vertical(
              top: Radius.circular(20),
            ),
            child: Padding(
              padding: const EdgeInsetsDirectional.fromSTEB(
                AppSpacing.lg,
                AppSpacing.md,
                AppSpacing.lg,
                AppSpacing.lg,
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Center(
                      child: Container(
                        width: 40,
                        height: 4,
                        decoration: BoxDecoration(
                          color: palette.borderStrong,
                          borderRadius: AppRadius.pillAll,
                        ),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    Center(
                      child: Container(
                        key: Key(
                          'payment-notification-detail-icon-${notification.id}',
                        ),
                        width: 72,
                        height: 72,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: style.accent.withValues(alpha: 0.12),
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: style.accent.withValues(alpha: 0.35),
                          ),
                        ),
                        child: Icon(
                          style.icon,
                          size: 34,
                          color: style.accent,
                        ),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    Text(
                      copy.title,
                      textAlign: TextAlign.center,
                      style: AppTextStyles.title(context).copyWith(
                        color: palette.textPrimary,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    if (reservationLabel.isNotEmpty) ...[
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        reservationLabel,
                        textAlign: TextAlign.center,
                        style: AppTextStyles.label(context).copyWith(
                          color: palette.textMuted,
                        ),
                      ),
                    ],
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      copy.body,
                      textAlign: TextAlign.center,
                      style: AppTextStyles.body(context).copyWith(
                        color: palette.textSecondary,
                        height: 1.4,
                      ),
                    ),
                    if (amount != null) ...[
                      const SizedBox(height: AppSpacing.md),
                      Container(
                        key: Key(
                          'payment-notification-detail-amount-${notification.id}',
                        ),
                        padding: const EdgeInsetsDirectional.all(AppSpacing.md),
                        decoration: BoxDecoration(
                          color: palette.inputSurface,
                          borderRadius: AppRadius.mdAll,
                          border: Border.all(color: palette.borderSubtle),
                        ),
                        child: Column(
                          children: [
                            Text(
                              l10n.notificationPaymentAmountLabel,
                              style: AppTextStyles.label(context).copyWith(
                                color: palette.textMuted,
                              ),
                            ),
                            const SizedBox(height: AppSpacing.xs),
                            Text(
                              amount,
                              style: AppTextStyles.title(context).copyWith(
                                color: palette.textPrimary,
                                fontWeight: FontWeight.w800,
                                fontSize: 28,
                              ),
                            ),
                            if (status != null) ...[
                              const SizedBox(height: AppSpacing.xs),
                              Text(
                                status,
                                style: AppTextStyles.label(context).copyWith(
                                  color: style.accent,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ],
                    if (materialTitle != null) ...[
                      const SizedBox(height: AppSpacing.md),
                      Container(
                        padding: const EdgeInsetsDirectional.all(AppSpacing.md),
                        decoration: BoxDecoration(
                          color: palette.panelSurface,
                          borderRadius: AppRadius.mdAll,
                          border: Border.all(color: palette.borderSubtle),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              materialTitle,
                              style: AppTextStyles.body(context).copyWith(
                                color: palette.textPrimary,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const SizedBox(height: AppSpacing.xs),
                            Text(
                              nextStep,
                              style: AppTextStyles.body(context).copyWith(
                                color: palette.textSecondary,
                                height: 1.35,
                              ),
                            ),
                            const SizedBox(height: AppSpacing.sm),
                            Wrap(
                              spacing: AppSpacing.sm,
                              runSpacing: AppSpacing.xs,
                              crossAxisAlignment: WrapCrossAlignment.center,
                              children: [
                                AppStatusBadge(
                                  label: notificationTypeChipLabel(
                                    categoryForNotification(notification),
                                    l10n: l10n,
                                  ),
                                  tone: style.tone,
                                ),
                                Text(
                                  relativeTime,
                                  style: AppTextStyles.label(context).copyWith(
                                    color: palette.textMuted,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ] else ...[
                      const SizedBox(height: AppSpacing.md),
                      Text(
                        nextStep,
                        textAlign: TextAlign.center,
                        style: AppTextStyles.body(context).copyWith(
                          color: palette.textSecondary,
                          height: 1.35,
                        ),
                      ),
                    ],
                    const SizedBox(height: AppSpacing.lg),
                    SizedBox(
                      height: 48,
                      child: FilledButton(
                        key: Key(
                          'payment-notification-detail-primary-${notification.id}',
                        ),
                        onPressed: () {
                          Navigator.of(context).pop();
                          onPrimaryAction();
                        },
                        style: AppStatusButtonStyle.filled(
                          context,
                          AppStatusTone.success,
                        ),
                        child: Text(actionLabel),
                      ),
                    ),
                    if (onSecondaryAction != null) ...[
                      const SizedBox(height: AppSpacing.sm),
                      SizedBox(
                        height: 44,
                        child: OutlinedButton(
                          key: Key(
                            'payment-notification-detail-secondary-${notification.id}',
                          ),
                          onPressed: () {
                            Navigator.of(context).pop();
                            onSecondaryAction!();
                          },
                          style: AppStatusButtonStyle.outlined(
                            context,
                            AppStatusTone.neutral,
                          ),
                          child: Text(l10n.notificationPaymentDetailSecondary),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Compact icon badge reused by list tiles and detail sheets.
class PaymentNotificationIconBadge extends StatelessWidget {
  const PaymentNotificationIconBadge({
    super.key,
    required this.notification,
    this.size = 40,
    this.iconSize = 20,
  });

  final AppNotification notification;
  final double size;
  final double iconSize;

  @override
  Widget build(BuildContext context) {
    final style = paymentNotificationVisualStyle(notification);
    return ExcludeSemantics(
      child: Container(
        key: Key('notification-type-icon-${notification.id}'),
        width: size,
        height: size,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: style.accent.withValues(alpha: 0.12),
          borderRadius: AppRadius.mdAll,
          border: Border.all(color: style.accent.withValues(alpha: 0.35)),
        ),
        child: Icon(
          iconForNotification(notification),
          size: iconSize,
          color: style.accent,
        ),
      ),
    );
  }
}
