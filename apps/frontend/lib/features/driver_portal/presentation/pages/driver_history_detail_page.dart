import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../core/format/localized_formatters.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/l10n/driver_quantity_labels.dart';
import '../../../../shared/l10n/driver_status_labels.dart';
import '../../../../shared/l10n/driver_ui_labels.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/app_back_action.dart';
import '../../../../shared/widgets/bidi_text.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../deliveries/presentation/delivery_status_presentation.dart';
import '../../application/driver_archive_provider.dart';
import '../../data/models/driver_archive.dart';
import '../widgets/driver_route_block.dart';

class DriverHistoryDetailPage extends ConsumerWidget {
  const DriverHistoryDetailPage({super.key, required this.deliveryId});
  final String deliveryId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final value = ref.watch(driverHistoricalDeliveryProvider(deliveryId));
    return SingleChildScrollView(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 900),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Align(
                alignment: AlignmentDirectional.centerStart,
                child: AppBackAction(fallbackLocation: '/driver/history'),
              ),
              const SizedBox(height: AppSpacing.sm),
              value.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (_, _) => _DetailNotice(
                  onRetry: () => ref.invalidate(
                    driverHistoricalDeliveryProvider(deliveryId),
                  ),
                ),
                data: (delivery) =>
                    DriverHistoricalDeliveryContent(delivery: delivery),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class DriverHistoricalDeliveryContent extends StatelessWidget {
  const DriverHistoricalDeliveryContent({super.key, required this.delivery});
  final DriverHistoricalDelivery delivery;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final labels = DriverUiLabels(l10n);
    final format = LocalizedFormatters(l10n);
    final pickupSummary = labels.locationSummary(
      delivery.pickupLocation.safeSummary,
    );
    final dropoffSummary = labels.locationSummary(
      delivery.dropoffLocation.safeSummary,
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _DetailPanel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                l10n.driverHistoricalDeliveryTitle,
                style: AppTextStyles.display(context),
              ),
              const SizedBox(height: AppSpacing.sm),
              Wrap(
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.sm,
                children: [
                  AppStatusBadge(
                    label: driverDeliveryStatusLabel(delivery.status, l10n),
                    tone: deliveryStatusAppTone(delivery.status),
                  ),
                  AppStatusBadge(
                    label: l10n.driverReadOnly,
                    tone: AppStatusTone.neutral,
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(labels.assignmentOutcome(delivery.assignmentOutcome)),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        _DetailPanel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                l10n.driverDeliverySummary,
                style: AppTextStyles.title(context),
              ),
              const SizedBox(height: AppSpacing.md),
              DriverRouteBlock(
                pickupSummary: pickupSummary,
                dropoffSummary: dropoffSummary,
              ),
              const SizedBox(height: AppSpacing.md),
              _ResponsiveLine(
                label: l10n.supplier,
                value: labels.partyDisplayName(delivery.supplier.displayName),
              ),
              _ResponsiveLine(
                label: l10n.materials,
                value: delivery.carriedItems
                    .map(
                      (item) =>
                          '${bidiIsolate(labels.materialTitle(item.materialTitle))} × ${bidiIsolate(driverQuantityLabel(l10n, item.quantity, item.unit))}',
                    )
                    .join('\n'),
              ),
              if (delivery.partialPickupOccurred)
                _ResponsiveLine(
                  label: l10n.driverPartialPickupHistory,
                  value: l10n.driverYes,
                ),
              if (!delivery.itemAuditComplete)
                _ResponsiveLine(
                  label: l10n.driverItemAudit,
                  value: l10n.driverLegacyItemAuditWarning,
                ),
              if (delivery.failureReasonCode != null)
                _ResponsiveLine(
                  label: l10n.driverFailureReason,
                  value: labels.incidentReason(delivery.failureReasonCode!),
                ),
            ],
          ),
        ),
        if (delivery.unpickedItems.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.md),
          _DetailPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l10n.driverNotPickedUpTitle,
                  style: AppTextStyles.title(context),
                ),
                const SizedBox(height: AppSpacing.sm),
                for (final item in delivery.unpickedItems)
                  Semantics(
                    label:
                        '${l10n.driverNotPickedUpTitle}: ${labels.materialTitle(item.materialTitle)}',
                    child: ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: const Icon(Icons.remove_circle_outline_rounded),
                      title: Text(
                        '${bidiIsolate(labels.materialTitle(item.materialTitle))} × ${bidiIsolate(driverQuantityLabel(l10n, item.quantity, item.unit))}',
                      ),
                      subtitle: Text(
                        [
                          labels.partialPickupUnpickedReason(
                            item.unpickedReason,
                          ),
                          if (item.driverNote?.trim().isNotEmpty == true)
                            '${l10n.driverSubmittedNote}: ${item.driverNote}',
                          format.dateTime(item.recordedAtRequired),
                        ].join('\n'),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
        const SizedBox(height: AppSpacing.md),
        _DetailPanel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                l10n.driverDeliveryTimeline,
                style: AppTextStyles.title(context),
              ),
              const SizedBox(height: AppSpacing.sm),
              if (delivery.timeline.isEmpty)
                Text(l10n.driverTimelineUnavailable)
              else
                for (final entry in delivery.timeline)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.check_circle_outline_rounded),
                    title: Text(driverDeliveryStatusLabel(entry.status, l10n)),
                    subtitle: Text(format.dateTime(entry.occurredAt)),
                  ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ResponsiveLine extends StatelessWidget {
  const _ResponsiveLine({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final narrow = MediaQuery.sizeOf(context).width < 400;

    if (narrow) {
      return Padding(
        padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.sm),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: AppTextStyles.label(
                context,
              ).copyWith(color: palette.textMuted),
            ),
            const SizedBox(height: 2),
            BidiText(
              value,
              style: AppTextStyles.body(
                context,
              ).copyWith(color: palette.textPrimary),
            ),
          ],
        ),
      );
    }

    return Padding(
      padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.sm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 132,
            child: Text(
              label,
              style: AppTextStyles.label(
                context,
              ).copyWith(color: palette.textMuted),
            ),
          ),
          Expanded(
            child: BidiText(
              value,
              style: AppTextStyles.body(
                context,
              ).copyWith(color: palette.textPrimary),
            ),
          ),
        ],
      ),
    );
  }
}

class _DetailPanel extends StatelessWidget {
  const _DetailPanel({required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: palette.cardSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderStrong),
      ),
      child: child,
    );
  }
}

class _DetailNotice extends StatelessWidget {
  const _DetailNotice({required this.onRetry});
  final VoidCallback onRetry;
  @override
  Widget build(BuildContext context) => Column(
    children: [
      Text(context.l10n.driverArchiveLoadFailed),
      TextButton(onPressed: onRetry, child: Text(context.l10n.retry)),
    ],
  );
}
