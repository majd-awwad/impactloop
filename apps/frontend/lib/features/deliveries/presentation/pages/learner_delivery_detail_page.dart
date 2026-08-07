import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../l10n/l10n.dart';
import '../../../../core/format/localized_formatters.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../app/widgets/entry_nav_bar.dart';
import '../../../auth/application/auth_route_helpers.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../application/learner_deliveries_provider.dart';
import '../../../../shared/widgets/handover_confirmation_code_panel.dart';
import '../../data/models/learner_delivery.dart';
import '../delivery_status_presentation.dart';
import '../pickup_window_presentation.dart';

class LearnerDeliveryDetailPage extends ConsumerWidget {
  const LearnerDeliveryDetailPage({super.key, required this.deliveryId});

  final String deliveryId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = MaterialsUiPalette.of(context);
    final deliveryAsync = ref.watch(learnerDeliveryProvider(deliveryId));

    return Scaffold(
      backgroundColor: palette.pageBackground,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const EntryNavBar(
              showSignIn: false,
              showCreateAccount: false,
              homeRoute: '/home',
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsetsDirectional.fromSTEB(
                  AppSpacing.md,
                  AppSpacing.lg,
                  AppSpacing.md,
                  AppSpacing.xl,
                ),
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 1040),
                    child: deliveryAsync.when(
                      loading: () => _StatePanel(
                        icon: Icons.hourglass_empty_rounded,
                        title: context.l10n.loadingDelivery,
                        subtitle: context.l10n.checkingDeliveryStatus,
                      ),
                      error: (_, _) => _StatePanel(
                        icon: Icons.cloud_off_outlined,
                        title: context.l10n.deliveryLoadFailed,
                        subtitle: context.l10n.tryAgain,
                        actionLabel: context.l10n.tryAgainAction,
                        onAction: () =>
                            ref.invalidate(learnerDeliveryProvider(deliveryId)),
                      ),
                      data: (delivery) => _DeliveryDetailContent(
                        delivery: delivery,
                        onRefresh: () =>
                            ref.invalidate(learnerDeliveryProvider(deliveryId)),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DeliveryDetailContent extends StatelessWidget {
  const _DeliveryDetailContent({
    required this.delivery,
    required this.onRefresh,
  });

  final LearnerDelivery delivery;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    final wide = MediaQuery.sizeOf(context).width >= 860;

    final summary = _DeliverySummaryPanel(
      delivery: delivery,
      onRefresh: onRefresh,
    );
    final timeline = _DeliveryTimelinePanel(delivery: delivery);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _Header(delivery: delivery),
        const SizedBox(height: AppSpacing.lg),
        if (wide)
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(flex: 4, child: summary),
              const SizedBox(width: AppSpacing.lg),
              Expanded(flex: 5, child: timeline),
            ],
          )
        else ...[
          summary,
          const SizedBox(height: AppSpacing.lg),
          timeline,
        ],
      ],
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.delivery});

  final LearnerDelivery delivery;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final colors = AppThemeColors.of(context);

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.xl),
      decoration: BoxDecoration(
        color: palette.panelSurface,
        borderRadius: AppRadius.xlAll,
        border: Border.all(color: palette.borderStrong),
        boxShadow: [
          BoxShadow(
            color: palette.cardShadow,
            blurRadius: 24,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          TextButton.icon(
            onPressed: () => _goBackFromDelivery(context, delivery),
            style: AppStatusButtonStyle.text(context, AppStatusTone.neutral),
            icon: const Icon(Icons.arrow_back_rounded, size: 18),
            label: Text(
              delivery.reservationId.trim().isNotEmpty
                  ? context.l10n.viewReservation
                  : context.l10n.backToReservations,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            context.l10n.deliveryStatusTitle,
            style: AppTextStyles.display(
              context,
            ).copyWith(color: palette.textPrimary),
          ),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              AppStatusBadge(
                label: deliveryStatusLabel(delivery.status, l10n: context.l10n),
                tone: deliveryStatusAppTone(delivery.status),
              ),
              Text(
                context.l10n.requestedAt(
                  LocalizedFormatters(
                    context.l10n,
                  ).dateTime(delivery.requestedAt),
                ),
                style: AppTextStyles.label(
                  context,
                ).copyWith(color: palette.textMuted),
              ),
            ],
          ),
          if (delivery.assignedDriverPickupOverdue) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              delivery.status.toUpperCase() == 'ARRIVED_PICKUP'
                  ? context.l10n.pickupIncompleteAdminReview
                  : context.l10n.driverPickupIncompleteAdminReview,
              style: AppTextStyles.label(context).copyWith(
                color: colors.warningText,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _DeliverySummaryPanel extends StatelessWidget {
  const _DeliverySummaryPanel({
    required this.delivery,
    required this.onRefresh,
  });

  final LearnerDelivery delivery;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    return _Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _PanelTitle(
            icon: Icons.inventory_2_outlined,
            title: context.l10n.material,
            body: delivery.reservation.material.title,
          ),
          const SizedBox(height: AppSpacing.lg),
          _InfoRow(
            label: context.l10n.supplier,
            value: delivery.reservation.supplier.displayName,
          ),
          _InfoRow(
            label: context.l10n.pickupWindow,
            value: learnerReservationPickupWindowDetail(
              delivery.reservation,
              context.l10n,
            ),
          ),
          _InfoRow(
            label: context.l10n.pickupArea,
            value: delivery.pickupLocation.summary,
          ),
          _InfoRow(
            label: context.l10n.dropoff,
            value: delivery.dropoffLocation.summary,
          ),
          if (delivery.driver != null) ...[
            const SizedBox(height: AppSpacing.md),
            _PanelTitle(
              icon: Icons.badge_outlined,
              title: context.l10n.assignedDriver,
              body: _driverSummary(delivery.driver!),
            ),
          ],
          const SizedBox(height: AppSpacing.md),
          _TrackingStatusCard(delivery: delivery, onRefresh: onRefresh),
          if (delivery.driverNote?.trim().isNotEmpty == true)
            _InfoRow(
              label: context.l10n.driverNote,
              value: delivery.driverNote!,
            ),
          if (delivery.shouldShowLearnerDeliveryCode) ...[
            const SizedBox(height: AppSpacing.md),
            HandoverConfirmationCodePanel(
              code: delivery.learnerDeliveryCode!,
              instructions: context.l10n.deliveryCodeInstructions,
            ),
          ],
          if (delivery.failureReason?.trim().isNotEmpty == true)
            _InfoRow(
              label: context.l10n.failureReason,
              value: delivery.failureReason!,
            ),
          const SizedBox(height: AppSpacing.md),
          TextButton.icon(
            onPressed: () => context.go(learnerReservationsRoute),
            style: AppStatusButtonStyle.text(context, AppStatusTone.neutral),
            icon: const Icon(Icons.arrow_back_rounded, size: 18),
            label: Text(context.l10n.backToReservations),
          ),
        ],
      ),
    );
  }
}

void _goBackFromDelivery(BuildContext context, LearnerDelivery delivery) {
  final reservationId = delivery.reservationId.trim();
  if (reservationId.isNotEmpty) {
    context.go(learnerReservationDetailRoute(reservationId));
    return;
  }
  context.go(learnerReservationsRoute);
}

class _TrackingStatusCard extends StatelessWidget {
  const _TrackingStatusCard({required this.delivery, required this.onRefresh});

  final LearnerDelivery delivery;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    final ping = delivery.latestDriverPing;
    final body = _trackingStatusBody(delivery, context.l10n);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _PanelTitle(
          icon: Icons.my_location_outlined,
          title: delivery.canTrack
              ? (ping?.hasCoordinates == true
                    ? context.l10n.driverLocationUpdated
                    : context.l10n.liveTracking)
              : context.l10n.deliveryStatusTitle,
          body: body,
        ),
        const SizedBox(height: AppSpacing.sm),
        if (delivery.canTrack)
          FilledButton.icon(
            onPressed: () =>
                context.push('/learner/deliveries/${delivery.id}/track'),
            style: AppStatusButtonStyle.filled(context, AppStatusTone.info),
            icon: const Icon(Icons.map_outlined),
            label: Text(context.l10n.trackDelivery),
          ),
        if (delivery.canTrack) const SizedBox(height: AppSpacing.sm),
        if (delivery.canTrack)
          TextButton.icon(
            onPressed: onRefresh,
            style: AppStatusButtonStyle.text(context, AppStatusTone.info),
            icon: const Icon(Icons.refresh_outlined, size: 18),
            label: Text(context.l10n.refreshStatus),
          )
        else
          TextButton.icon(
            onPressed: onRefresh,
            style: AppStatusButtonStyle.text(context, AppStatusTone.info),
            icon: const Icon(Icons.refresh_outlined, size: 18),
            label: Text(context.l10n.refreshStatus),
          ),
      ],
    );
  }
}

class _DeliveryTimelinePanel extends StatelessWidget {
  const _DeliveryTimelinePanel({required this.delivery});

  final LearnerDelivery delivery;

  @override
  Widget build(BuildContext context) {
    final history = delivery.history.isEmpty
        ? [
            LearnerDeliveryHistoryItem(
              id: delivery.id,
              newStatus: delivery.status,
              createdAt: delivery.requestedAt,
            ),
          ]
        : delivery.history;

    return _Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _PanelTitle(
            icon: Icons.timeline_outlined,
            title: context.l10n.statusTimeline,
            body: context.l10n.statusTimelineDescription,
          ),
          const SizedBox(height: AppSpacing.lg),
          ...history.map(
            (item) => _TimelineItem(
              title: deliveryStatusLabel(item.newStatus, l10n: context.l10n),
              time: LocalizedFormatters(context.l10n).dateTime(item.createdAt),
              note: item.note,
            ),
          ),
        ],
      ),
    );
  }
}

class _TimelineItem extends StatelessWidget {
  const _TimelineItem({required this.title, required this.time, this.note});

  final String title;
  final String time;
  final String? note;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.md),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 12,
            height: 12,
            margin: const EdgeInsets.only(top: 5),
            decoration: BoxDecoration(
              color: palette.mint,
              borderRadius: AppRadius.pillAll,
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: AppTextStyles.label(
                    context,
                  ).copyWith(color: palette.textPrimary),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  time,
                  style: AppTextStyles.body(
                    context,
                  ).copyWith(color: palette.textMuted),
                ),
                if (note?.trim().isNotEmpty == true) ...[
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    note!,
                    style: AppTextStyles.body(
                      context,
                    ).copyWith(color: palette.textSecondary),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Panel extends StatelessWidget {
  const _Panel({required this.child});

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

class _PanelTitle extends StatelessWidget {
  const _PanelTitle({
    required this.icon,
    required this.title,
    required this.body,
  });

  final IconData icon;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, color: palette.mint),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: AppTextStyles.label(
                  context,
                ).copyWith(color: palette.textPrimary),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                body,
                style: AppTextStyles.body(
                  context,
                ).copyWith(color: palette.textSecondary),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: AppTextStyles.label(
              context,
            ).copyWith(color: palette.textMuted, fontSize: 13),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            value,
            style: AppTextStyles.body(
              context,
            ).copyWith(color: palette.textPrimary),
          ),
        ],
      ),
    );
  }
}

class _StatePanel extends StatelessWidget {
  const _StatePanel({
    required this.icon,
    required this.title,
    required this.subtitle,
    this.actionLabel,
    this.onAction,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Container(
      width: double.infinity,
      padding: const EdgeInsetsDirectional.all(AppSpacing.xl),
      decoration: BoxDecoration(
        color: palette.panelSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderStrong),
      ),
      child: Column(
        children: [
          Icon(icon, color: palette.mint, size: 34),
          const SizedBox(height: AppSpacing.md),
          Text(
            title,
            style: AppTextStyles.title(
              context,
            ).copyWith(color: palette.textPrimary),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            subtitle,
            style: AppTextStyles.body(
              context,
            ).copyWith(color: palette.textSecondary),
            textAlign: TextAlign.center,
          ),
          if (actionLabel != null && onAction != null) ...[
            const SizedBox(height: AppSpacing.lg),
            FilledButton(
              onPressed: onAction,
              style: AppStatusButtonStyle.filled(
                context,
                AppStatusTone.primary,
              ),
              child: Text(actionLabel!),
            ),
          ],
        ],
      ),
    );
  }
}

String _driverSummary(LearnerDeliveryDriver driver) {
  final details = [
    driver.vehicleLabel,
    driver.vehiclePlate,
    driver.phone,
  ].where((item) => item != null && item.trim().isNotEmpty).join(' • ');

  return details.isEmpty
      ? driver.displayName
      : '${driver.displayName} • $details';
}

String _trackingStatusBody(LearnerDelivery delivery, AppLocalizations l10n) {
  if (!delivery.canTrack) {
    return switch (delivery.status) {
      'WAITING_FOR_DRIVER' => l10n.waitingForDriver,
      'DRIVER_ASSIGNED' => l10n.driverAssigned,
      'ARRIVED_PICKUP' => l10n.driverHeadingToPickup,
      _ when delivery.isTerminal => l10n.trackingComplete,
      _ => l10n.trackingAvailableAfterPickup,
    };
  }

  final ping = delivery.latestDriverPing;
  if (ping == null) {
    return l10n.driverLocationNotShared;
  }

  final secondsAgo = DateTime.now().difference(ping.capturedAt).inSeconds;
  final formatters = LocalizedFormatters(l10n);
  final freshness = l10n.lastUpdatedAt(
    secondsAgo < 60
        ? formatters.relativeTime(ping.capturedAt)
        : formatters.dateTime(ping.capturedAt),
  );

  return [
    deliveryStatusLabel(delivery.status, l10n: l10n),
    freshness,
    if (ping.accuracyMeters != null)
      l10n.accuracyMeters(formatters.number(ping.accuracyMeters!.round())),
  ].join('\n');
}
