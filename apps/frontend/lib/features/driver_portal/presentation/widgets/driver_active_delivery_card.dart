import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/l10n/driver_ui_labels.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/bidi_text.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../deliveries/presentation/delivery_status_presentation.dart';
import '../../../deliveries/presentation/pickup_window_presentation.dart';
import '../../data/models/driver_delivery.dart';
import '../driver_delivery_timing_presentation.dart';

class DriverActiveDeliveryCard extends StatelessWidget {
  const DriverActiveDeliveryCard({super.key, required this.delivery});

  final DriverDelivery delivery;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final palette = MaterialsUiPalette.of(context);
    final guidance = buildDriverNextActionGuidance(delivery, l10n: l10n);

    return Semantics(
      container: true,
      label:
          '${deliveryStatusLabel(delivery.status, l10n: l10n)}. ${guidance.actionLabel}',
      child: Container(
        padding: const EdgeInsetsDirectional.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: palette.cardSurface,
          borderRadius: AppRadius.lgAll,
          border: Border.all(color: palette.borderStrong),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: BidiText(
                    DriverUiLabels(l10n).materialTitle(delivery.material.title),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: AppTextStyles.title(context),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                AppStatusBadge(
                  label: deliveryStatusLabel(delivery.status, l10n: l10n),
                  tone: deliveryStatusAppTone(delivery.status),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            BidiText(
              driverPickupWindowSummary(delivery, l10n: l10n),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: AppTextStyles.body(
                context,
              ).copyWith(color: palette.textSecondary),
            ),
            const SizedBox(height: AppSpacing.sm),
            LayoutBuilder(
              builder: (context, constraints) {
                final nextAction = Row(
                  children: [
                    Icon(
                      Icons.arrow_forward_rounded,
                      size: 18,
                      color: palette.mint,
                    ),
                    const SizedBox(width: AppSpacing.xs),
                    Expanded(
                      child: Text(
                        l10n.driverNextAction(guidance.actionLabel),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: AppTextStyles.label(context),
                      ),
                    ),
                  ],
                );
                final openButton = FilledButton(
                  onPressed: () =>
                      context.push('/driver/deliveries/${delivery.id}'),
                  child: Text(l10n.driverOpenDelivery),
                );

                if (constraints.maxWidth < 460) {
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      nextAction,
                      const SizedBox(height: AppSpacing.sm),
                      openButton,
                    ],
                  );
                }

                return Row(
                  children: [
                    Expanded(child: nextAction),
                    const SizedBox(width: AppSpacing.sm),
                    openButton,
                  ],
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}
