import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/l10n/driver_status_labels.dart';
import '../../../../shared/l10n/driver_ui_labels.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/bidi_text.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../deliveries/presentation/delivery_status_presentation.dart';
import '../../../deliveries/presentation/pickup_window_presentation.dart';
import '../../data/models/driver_delivery.dart';
import '../driver_delivery_timing_presentation.dart';
import 'driver_route_block.dart';

class DriverActiveDeliveryCard extends StatelessWidget {
  const DriverActiveDeliveryCard({super.key, required this.delivery});

  final DriverDelivery delivery;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final palette = MaterialsUiPalette.of(context);
    final guidance = buildDriverNextActionGuidance(delivery, l10n: l10n);
    final labels = DriverUiLabels(l10n);
    final pickupSummary = _locationLabel(
      city: delivery.pickupCity ?? delivery.pickupLocation.city,
      area: delivery.pickupArea ?? delivery.pickupLocation.area,
      fallback: labels.locationSummary(delivery.pickupLocation.safeSummary),
    );
    final dropoffSummary = _locationLabel(
      city: delivery.dropoffCity ?? delivery.dropoffLocation.city,
      area: delivery.dropoffArea ?? delivery.dropoffLocation.area,
      fallback: labels.locationSummary(delivery.dropoffLocation.safeSummary),
    );

    return Semantics(
      container: true,
      label:
          '${driverDeliveryStatusLabel(delivery.status, l10n)}. ${guidance.actionLabel}',
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
                    labels.materialTitle(delivery.material.title),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: AppTextStyles.title(context),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Flexible(
                  child: AppStatusBadge(
                    label: driverDeliveryStatusLabel(delivery.status, l10n),
                    tone: deliveryStatusAppTone(delivery.status),
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            Row(
              children: [
                Icon(
                  Directionality.of(context) == TextDirection.rtl
                      ? Icons.arrow_back_rounded
                      : Icons.arrow_forward_rounded,
                  size: 16,
                  color: palette.mint,
                  semanticLabel: l10n.driverRouteArrowSemantic,
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
            ),
            if (guidance.timingGate != null) ...[
              const SizedBox(height: AppSpacing.xs),
              Row(
                children: [
                  Icon(
                    guidance.isBlockedByTiming
                        ? Icons.schedule_outlined
                        : Icons.info_outline,
                    size: 14,
                    color: palette.textMuted,
                  ),
                  const SizedBox(width: AppSpacing.xs),
                  Expanded(
                    child: Text(
                      guidance.timingGate!.title ?? '',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.body(
                        context,
                      ).copyWith(color: palette.textMuted, fontSize: 12),
                    ),
                  ),
                ],
              ),
            ],
            const SizedBox(height: AppSpacing.sm),
            BidiText(
              driverPickupWindowSummary(delivery, l10n: l10n),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTextStyles.body(
                context,
              ).copyWith(color: palette.textSecondary, fontSize: 13),
            ),
            const SizedBox(height: AppSpacing.sm),
            DriverRouteBlock(
              pickupSummary: pickupSummary,
              dropoffSummary: dropoffSummary,
              compact: true,
            ),
            const SizedBox(height: AppSpacing.md),
            FilledButton(
              onPressed: () =>
                  context.push('/driver/deliveries/${delivery.id}'),
              child: Text(l10n.driverOpenDelivery),
            ),
          ],
        ),
      ),
    );
  }
}

String _locationLabel({String? city, String? area, required String fallback}) {
  final parts = [area, city]
      .where((item) => item != null && item.trim().isNotEmpty)
      .cast<String>()
      .toList(growable: false);
  return parts.isEmpty ? fallback : parts.join(', ');
}
