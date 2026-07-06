import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../../../../app/router/navigation_extensions.dart';
import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../app/widgets/entry_nav_bar.dart';
import '../../../../shared/widgets/materials/material_status_badge.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../application/learner_deliveries_provider.dart';
import '../../data/deliveries_repository.dart';
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
                      loading: () => const _StatePanel(
                        icon: Icons.hourglass_empty_rounded,
                        title: 'Loading delivery',
                        subtitle: 'Checking the latest delivery status.',
                      ),
                      error: (_, _) => _StatePanel(
                        icon: Icons.cloud_off_outlined,
                        title: 'Could not load delivery',
                        subtitle: 'Please try again.',
                        actionLabel: 'Try again',
                        onAction: () =>
                            ref.invalidate(learnerDeliveryProvider(deliveryId)),
                      ),
                      data: (delivery) => _DeliveryDetailWithPolling(
                        deliveryId: deliveryId,
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

class _DeliveryDetailWithPolling extends ConsumerStatefulWidget {
  const _DeliveryDetailWithPolling({
    required this.deliveryId,
    required this.delivery,
    required this.onRefresh,
  });

  final String deliveryId;
  final LearnerDelivery delivery;
  final VoidCallback onRefresh;

  @override
  ConsumerState<_DeliveryDetailWithPolling> createState() =>
      _DeliveryDetailWithPollingState();
}

class _DeliveryDetailWithPollingState
    extends ConsumerState<_DeliveryDetailWithPolling> {
  Timer? _trackingTimer;
  late LearnerDelivery _delivery;
  bool _refreshing = false;

  @override
  void initState() {
    super.initState();
    _delivery = widget.delivery;
    _syncTrackingTimer();
  }

  @override
  void didUpdateWidget(covariant _DeliveryDetailWithPolling oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.delivery.id != widget.delivery.id ||
        oldWidget.delivery.status != widget.delivery.status ||
        oldWidget.delivery.canTrack != widget.delivery.canTrack ||
        oldWidget.delivery.latestDriverPing?.capturedAt !=
            widget.delivery.latestDriverPing?.capturedAt) {
      _delivery = widget.delivery;
      _syncTrackingTimer();
    }
  }

  @override
  void dispose() {
    _trackingTimer?.cancel();
    super.dispose();
  }

  void _syncTrackingTimer() {
    _trackingTimer?.cancel();
    if (_delivery.canTrack && !_delivery.isTerminal) {
      _trackingTimer = Timer.periodic(const Duration(seconds: 10), (_) {
        unawaited(_refreshTrackingSilently());
      });
    }
  }

  Future<void> _refreshTrackingSilently() async {
    if (_refreshing || !mounted || !_delivery.canTrack) {
      return;
    }

    _refreshing = true;
    try {
      final tracking = await ref
          .read(deliveriesRepositoryProvider)
          .fetchDeliveryTracking(widget.deliveryId);
      if (!mounted) {
        return;
      }

      final location = tracking.latestDriverLocation;
      setState(() {
        _delivery = LearnerDelivery(
          id: _delivery.id,
          reservationId: _delivery.reservationId,
          status: tracking.status,
          requestedAt: _delivery.requestedAt,
          assignedAt: _delivery.assignedAt,
          arrivedPickupAt: _delivery.arrivedPickupAt,
          pickedUpAt: _delivery.pickedUpAt,
          onTheWayAt: _delivery.onTheWayAt,
          arrivedDropoffAt: _delivery.arrivedDropoffAt,
          deliveredAt: _delivery.deliveredAt,
          cancelledAt: _delivery.cancelledAt,
          failedAt: _delivery.failedAt,
          learnerNote: _delivery.learnerNote,
          driverNote: _delivery.driverNote,
          failureReason: _delivery.failureReason,
          reservation: _delivery.reservation,
          pickupLocation: _delivery.pickupLocation,
          dropoffLocation: _delivery.dropoffLocation,
          driver: _delivery.driver,
          latestDriverPing: location == null
              ? null
              : LearnerDeliveryDriverPing(
                  capturedAt: location.capturedAt,
                  latitude: location.latitude,
                  longitude: location.longitude,
                  accuracyMeters: location.accuracyMeters,
                  coordinatesVisible: true,
                ),
          history: _delivery.history,
          learnerDeliveryCode: _delivery.learnerDeliveryCode,
          canTrack: tracking.canTrack,
          trackingMessage: tracking.trackingMessage,
        );
      });
    } catch (_) {
      // Keep the last known delivery visible during background polling errors.
    } finally {
      _refreshing = false;
    }
  }

  Future<void> _handleManualRefresh() async {
    widget.onRefresh();
    await _refreshTrackingSilently();
  }

  @override
  Widget build(BuildContext context) {
    return _DeliveryDetailContent(
      delivery: _delivery,
      onRefresh: () => unawaited(_handleManualRefresh()),
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
          Text(
            'Delivery status',
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
              MaterialStatusBadge(
                label: deliveryStatusLabel(delivery.status),
                tone: deliveryStatusTone(delivery.status),
              ),
              Text(
                'Requested ${_formatDateTime(delivery.requestedAt)}',
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
                  ? 'Pickup was not completed before the supplier window ended. '
                      'An admin may review if no one reports the issue.'
                  : 'The assigned driver has not completed supplier pickup before '
                      'the window ended. An admin may review if no one reports the issue.',
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
            title: 'Material',
            body: delivery.reservation.material.title,
          ),
          const SizedBox(height: AppSpacing.lg),
          _InfoRow(
            label: 'Supplier',
            value: delivery.reservation.supplier.displayName,
          ),
          _InfoRow(
            label: 'Pickup window',
            value: learnerReservationPickupWindowDetail(delivery.reservation),
          ),
          _InfoRow(
            label: 'Pickup area',
            value: delivery.pickupLocation.summary,
          ),
          _InfoRow(label: 'Dropoff', value: delivery.dropoffLocation.summary),
          if (delivery.driver != null) ...[
            const SizedBox(height: AppSpacing.md),
            _PanelTitle(
              icon: Icons.badge_outlined,
              title: 'Assigned driver',
              body: _driverSummary(delivery.driver!),
            ),
          ],
          const SizedBox(height: AppSpacing.md),
          _TrackingStatusCard(delivery: delivery, onRefresh: onRefresh),
          if (delivery.latestDriverPing?.hasCoordinates == true &&
              delivery.canTrack) ...[
            const SizedBox(height: AppSpacing.md),
            _TrackingMapCard(ping: delivery.latestDriverPing!),
          ],
          if (delivery.driverNote?.trim().isNotEmpty == true)
            _InfoRow(label: 'Driver note', value: delivery.driverNote!),
          if (delivery.shouldShowLearnerDeliveryCode) ...[
            const SizedBox(height: AppSpacing.md),
            HandoverConfirmationCodePanel(
              code: delivery.learnerDeliveryCode!,
              instructions:
                  'Give this code to the driver when you receive the material.',
            ),
          ],
          if (delivery.failureReason?.trim().isNotEmpty == true)
            _InfoRow(label: 'Failure reason', value: delivery.failureReason!),
          const SizedBox(height: AppSpacing.md),
          TextButton.icon(
            onPressed: () => context.popOrGo('/learner/reservations'),
            icon: const Icon(Icons.assignment_turned_in_outlined),
            label: const Text('Back to reservations'),
          ),
        ],
      ),
    );
  }
}

class _TrackingStatusCard extends StatelessWidget {
  const _TrackingStatusCard({required this.delivery, required this.onRefresh});

  final LearnerDelivery delivery;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    final ping = delivery.latestDriverPing;
    final body = _trackingStatusBody(delivery);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _PanelTitle(
          icon: Icons.my_location_outlined,
          title: delivery.canTrack
              ? (ping?.hasCoordinates == true
                    ? 'Driver location updated recently'
                    : 'Live tracking')
              : 'Delivery status',
          body: body,
        ),
        const SizedBox(height: AppSpacing.sm),
        if (delivery.canTrack)
          TextButton.icon(
            onPressed: onRefresh,
            icon: const Icon(Icons.refresh_outlined, size: 18),
            label: const Text('Refresh tracking'),
          )
        else
          TextButton.icon(
            onPressed: onRefresh,
            icon: const Icon(Icons.refresh_outlined, size: 18),
            label: const Text('Refresh status'),
          ),
      ],
    );
  }
}

class _TrackingMapCard extends StatelessWidget {
  const _TrackingMapCard({required this.ping});

  final LearnerDeliveryDriverPing ping;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final point = LatLng(ping.latitude!, ping.longitude!);

    return ClipRRect(
      borderRadius: AppRadius.lgAll,
      child: SizedBox(
        height: MediaQuery.sizeOf(context).width >= 700 ? 280 : 230,
        width: double.infinity,
        child: FlutterMap(
          options: MapOptions(
            initialCenter: point,
            initialZoom: 15,
            minZoom: 5,
            maxZoom: 18,
            interactionOptions: const InteractionOptions(
              flags: InteractiveFlag.all & ~InteractiveFlag.rotate,
            ),
          ),
          children: [
            TileLayer(
              urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
              userAgentPackageName: 'com.impactloop.frontend',
            ),
            MarkerLayer(
              markers: [
                Marker(
                  point: point,
                  width: 48,
                  height: 48,
                  alignment: Alignment.topCenter,
                  child: _DriverMapMarker(color: palette.mint),
                ),
              ],
            ),
            RichAttributionWidget(
              alignment: AttributionAlignment.bottomRight,
              attributions: [
                TextSourceAttribution(
                  'OpenStreetMap contributors',
                  onTap: () {},
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _DriverMapMarker extends StatelessWidget {
  const _DriverMapMarker({required this.color});

  final Color color;

  @override
  Widget build(BuildContext context) {
    return Icon(Icons.location_pin, color: color, size: 42);
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
            title: 'Status timeline',
            body: 'Updates from the internal delivery workflow.',
          ),
          const SizedBox(height: AppSpacing.lg),
          ...history.map(
            (item) => _TimelineItem(
              title: deliveryStatusLabel(item.newStatus),
              time: _formatDateTime(item.createdAt),
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
            FilledButton(onPressed: onAction, child: Text(actionLabel!)),
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

String _trackingStatusBody(LearnerDelivery delivery) {
  if (!delivery.canTrack) {
    final message = delivery.trackingMessage?.trim();
    if (message != null && message.isNotEmpty) {
      return message;
    }

    return switch (delivery.status) {
      'WAITING_FOR_DRIVER' => 'Waiting for driver.',
      'DRIVER_ASSIGNED' => 'Driver assigned.',
      'ARRIVED_PICKUP' => 'Driver is heading to supplier pickup.',
      _ when delivery.isTerminal => 'Tracking is complete for this delivery.',
      _ => 'Driver location is available after pickup.',
    };
  }

  final ping = delivery.latestDriverPing;
  if (ping == null) {
    return 'Driver has not shared a location yet.\n'
        'Location updates appear when the driver shares their position.';
  }

  final secondsAgo = DateTime.now().difference(ping.capturedAt).inSeconds;
  final freshness = secondsAgo < 60
      ? 'Last updated $secondsAgo seconds ago.'
      : 'Last updated ${_formatDateTime(ping.capturedAt)}.';

  return [
    deliveryStatusLabel(delivery.status),
    freshness,
    if (ping.accuracyMeters != null)
      'Accuracy: about ${ping.accuracyMeters!.round()} m',
  ].join('\n');
}

String _formatDateTime(DateTime value) {
  return '${value.year}-${_two(value.month)}-${_two(value.day)} '
      '${_two(value.hour)}:${_two(value.minute)}';
}

String _two(int value) => value.toString().padLeft(2, '0');
