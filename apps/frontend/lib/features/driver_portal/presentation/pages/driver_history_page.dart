import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../core/format/localized_formatters.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/l10n/driver_quantity_labels.dart';
import '../../../../shared/l10n/driver_status_labels.dart';
import '../../../../shared/l10n/driver_ui_labels.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/bidi_text.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../deliveries/presentation/delivery_status_presentation.dart';
import '../../application/driver_archive_provider.dart';
import '../../data/models/driver_archive.dart';
import '../widgets/driver_page_header.dart';
import '../widgets/driver_route_block.dart';

class DriverHistoryPage extends ConsumerWidget {
  const DriverHistoryPage({super.key, this.initialTab = 0});
  final int initialTab;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final history = ref.watch(driverHistoryProvider);
    final incidents = ref.watch(driverIncidentsProvider);
    final selected = initialTab.clamp(0, 1);

    return RefreshIndicator(
      onRefresh: () async {
        if (selected == 0) {
          ref.invalidate(driverHistoryProvider);
          await ref.read(driverHistoryProvider.future);
        } else {
          ref.invalidate(driverIncidentsProvider);
          await ref.read(driverIncidentsProvider.future);
        }
      },
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsetsDirectional.fromSTEB(
          AppSpacing.md,
          AppSpacing.lg,
          AppSpacing.md,
          AppSpacing.xl,
        ),
        children: [
          Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 1040),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  DriverPageHeader(
                    title: l10n.driverHistoryTitle,
                    subtitle: l10n.driverHistorySubtitle,
                    maxWidth: 1040,
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  SegmentedButton<int>(
                    segments: [
                      ButtonSegment(
                        value: 0,
                        icon: const Icon(Icons.history_rounded),
                        label: Text(l10n.driverDeliveriesTab),
                      ),
                      ButtonSegment(
                        value: 1,
                        icon: const Icon(Icons.report_outlined),
                        label: Text(l10n.driverReportsTab),
                      ),
                    ],
                    selected: {selected},
                    onSelectionChanged: (value) => context.go(
                      value.first == 0
                          ? '/driver/history'
                          : '/driver/incidents',
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  if (selected == 0)
                    _ArchiveAsync<DriverHistoricalDelivery>(
                      value: history,
                      emptyText: l10n.driverHistoryEmpty,
                      onRetry: () => ref.invalidate(driverHistoryProvider),
                      onLoadMore: () =>
                          ref.read(driverHistoryProvider.notifier).loadMore(),
                      onRestart: () => ref
                          .read(driverHistoryProvider.notifier)
                          .restartFromFirstPage(),
                      itemBuilder: (item) => _HistoryCard(delivery: item),
                    )
                  else
                    _ArchiveAsync<DriverIncident>(
                      value: incidents,
                      emptyText: l10n.driverReportsEmpty,
                      onRetry: () => ref.invalidate(driverIncidentsProvider),
                      onLoadMore: () =>
                          ref.read(driverIncidentsProvider.notifier).loadMore(),
                      onRestart: () => ref
                          .read(driverIncidentsProvider.notifier)
                          .restartFromFirstPage(),
                      itemBuilder: (item) => _IncidentCard(incident: item),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ArchiveAsync<T> extends StatelessWidget {
  const _ArchiveAsync({
    required this.value,
    required this.emptyText,
    required this.onRetry,
    required this.onLoadMore,
    required this.onRestart,
    required this.itemBuilder,
  });
  final AsyncValue<DriverArchivePage<T>> value;
  final String emptyText;
  final VoidCallback onRetry;
  final VoidCallback onLoadMore;
  final VoidCallback onRestart;
  final Widget Function(T) itemBuilder;

  @override
  Widget build(BuildContext context) => value.when(
    skipLoadingOnReload: true,
    loading: () => Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Semantics(
          label: context.l10n.driverLoadingActive,
          child: const CircularProgressIndicator(),
        ),
      ),
    ),
    error: (_, _) => _ArchiveNotice(
      text: context.l10n.driverArchiveLoadFailed,
      action: onRetry,
    ),
    data: (page) {
      if (page.items.isEmpty) return _ArchiveNotice(text: emptyText);
      return Column(
        children: [
          for (final item in page.items) ...[
            itemBuilder(item),
            const SizedBox(height: AppSpacing.md),
          ],
          if (page.loadMoreError != null)
            _ArchiveNotice(
              text: page.invalidCursor
                  ? context.l10n.driverArchiveCursorExpired
                  : context.l10n.driverArchiveMoreFailed,
              action: page.invalidCursor ? onRestart : onLoadMore,
              actionLabel: page.invalidCursor
                  ? context.l10n.driverRestartArchive
                  : context.l10n.retry,
            ),
          if (page.pagination.hasMore && !page.invalidCursor)
            OutlinedButton.icon(
              onPressed: onLoadMore,
              icon: const Icon(Icons.expand_more_rounded),
              label: Text(context.l10n.loadMore),
            ),
        ],
      );
    },
  );
}

class _HistoryCard extends StatelessWidget {
  const _HistoryCard({required this.delivery});
  final DriverHistoricalDelivery delivery;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final palette = MaterialsUiPalette.of(context);
    final labels = DriverUiLabels(l10n);
    final date = LocalizedFormatters(l10n).dateTime(delivery.historicalAt);
    final pickupSummary = labels.locationSummary(
      delivery.pickupLocation.safeSummary,
    );
    final dropoffSummary = labels.locationSummary(
      delivery.dropoffLocation.safeSummary,
    );

    return Semantics(
      button: true,
      label: l10n.driverOpenHistoricalDelivery,
      child: InkWell(
        onTap: () => context.go('/driver/history/${delivery.id}'),
        borderRadius: AppRadius.lgAll,
        child: Container(
          padding: const EdgeInsetsDirectional.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: palette.cardSurface,
            borderRadius: AppRadius.lgAll,
            border: Border.all(color: palette.borderStrong),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  AppStatusBadge(
                    label: driverDeliveryStatusLabel(delivery.status, l10n),
                    tone: deliveryStatusAppTone(delivery.status),
                  ),
                  const Spacer(),
                  Flexible(
                    child: Text(
                      date,
                      textAlign: TextAlign.end,
                      style: AppTextStyles.body(
                        context,
                      ).copyWith(color: palette.textMuted, fontSize: 12),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.sm),
              DriverRouteBlock(
                pickupSummary: pickupSummary,
                dropoffSummary: dropoffSummary,
                compact: true,
              ),
              const SizedBox(height: AppSpacing.sm),
              for (final item in delivery.carriedItems.take(3))
                Padding(
                  padding: const EdgeInsets.only(bottom: 2),
                  child: Text(
                    '${bidiIsolate(labels.materialTitle(item.materialTitle))} × ${bidiIsolate(driverQuantityLabel(l10n, item.quantity, item.unit))}',
                    style: AppTextStyles.body(
                      context,
                    ).copyWith(color: palette.textSecondary, fontSize: 13),
                  ),
                ),
              const SizedBox(height: AppSpacing.sm),
              Wrap(
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.xs,
                children: [
                  Text(
                    labels.assignmentOutcome(delivery.assignmentOutcome),
                    style: AppTextStyles.label(context).copyWith(fontSize: 12),
                  ),
                  if (delivery.partialPickupOccurred)
                    Text(
                      '• ${l10n.driverPartialPickupHistory}',
                      style: AppTextStyles.label(
                        context,
                      ).copyWith(fontSize: 12),
                    ),
                  if (delivery.incidentReviewStatus != null)
                    AppStatusBadge(
                      label: labels.incidentReviewStatus(
                        delivery.incidentReviewStatus!,
                      ),
                      tone: driverIncidentReviewTone(
                        delivery.incidentReviewStatus!,
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _IncidentCard extends StatelessWidget {
  const _IncidentCard({required this.incident});
  final DriverIncident incident;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final labels = DriverUiLabels(l10n);
    final palette = MaterialsUiPalette.of(context);
    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: palette.cardSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderStrong),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              AppStatusBadge(
                label: labels.incidentReviewStatus(incident.reviewStatus),
                tone: driverIncidentReviewTone(incident.reviewStatus),
              ),
              Text(
                LocalizedFormatters(l10n).dateTime(incident.createdAt),
                style: AppTextStyles.body(
                  context,
                ).copyWith(color: palette.textMuted, fontSize: 12),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            labels.incidentType(incident.type),
            style: AppTextStyles.title(context),
          ),
          if (incident.materialTitle.trim().isNotEmpty)
            Text(labels.materialTitle(incident.materialTitle)),
          if (incident.reasonDetail != null)
            Text(labels.incidentReason(incident.reasonDetail!)),
          if (incident.reporterNote?.trim().isNotEmpty == true) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(l10n.driverSubmittedNote, style: AppTextStyles.label(context)),
            Text(incident.reporterNote!),
          ],
          const Divider(height: AppSpacing.xl),
          Text(
            '${l10n.driverResolutionOutcome}: ${labels.incidentOutcome(incident.resolutionOutcome)}',
          ),
          if (incident.relatedDeliveryId != null) ...[
            const SizedBox(height: AppSpacing.sm),
            TextButton.icon(
              onPressed: () => context.go(
                incident.relatedDeliveryIsHistorical
                    ? '/driver/history/${incident.relatedDeliveryId}'
                    : '/driver/deliveries/${incident.relatedDeliveryId}',
              ),
              icon: const Icon(Icons.open_in_new_rounded),
              label: Text(l10n.driverOpenRelatedDelivery),
            ),
          ],
          if (incident.recoveryDeliveryId != null) ...[
            const SizedBox(height: AppSpacing.sm),
            TextButton.icon(
              onPressed: () => context.go(
                incident.recoveryDeliveryIsHistorical
                    ? '/driver/history/${incident.recoveryDeliveryId}'
                    : '/driver/deliveries/${incident.recoveryDeliveryId}',
              ),
              icon: const Icon(Icons.replay_circle_filled_outlined),
              label: Text(l10n.driverOpenRecoveryDelivery),
            ),
          ],
        ],
      ),
    );
  }
}

class _ArchiveNotice extends StatelessWidget {
  const _ArchiveNotice({required this.text, this.action, this.actionLabel});
  final String text;
  final VoidCallback? action;
  final String? actionLabel;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
    child: Column(
      children: [
        Text(text, textAlign: TextAlign.center),
        if (action != null)
          TextButton(
            onPressed: action,
            child: Text(actionLabel ?? context.l10n.retry),
          ),
      ],
    ),
  );
}
