import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:latlong2/latlong.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../app/widgets/entry_nav_bar.dart';
import '../../../../shared/widgets/materials/material_status_badge.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../data/deliveries_repository.dart';
import '../../data/models/learner_delivery_tracking.dart';
import '../delivery_status_presentation.dart';

const _trackingPollInterval = Duration(seconds: 45);

class LearnerDeliveryTrackingPage extends ConsumerStatefulWidget {
  const LearnerDeliveryTrackingPage({super.key, required this.deliveryId});

  final String deliveryId;

  @override
  ConsumerState<LearnerDeliveryTrackingPage> createState() =>
      _LearnerDeliveryTrackingPageState();
}

class _LearnerDeliveryTrackingPageState
    extends ConsumerState<LearnerDeliveryTrackingPage> {
  Timer? _pollTimer;
  LearnerDeliveryTracking? _tracking;
  bool _loading = true;
  Object? _error;
  bool _refreshing = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      unawaited(_fetchTracking(initial: true));
    });
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  void _syncPollTimer(LearnerDeliveryTracking tracking) {
    _pollTimer?.cancel();
    _pollTimer = null;

    if (tracking.canTrack && !tracking.isTerminal) {
      _pollTimer = Timer.periodic(_trackingPollInterval, (_) {
        unawaited(_fetchTracking());
      });
    }
  }

  Future<void> _fetchTracking({bool initial = false}) async {
    if (_refreshing || !mounted) {
      return;
    }

    _refreshing = true;
    if (initial) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }

    try {
      final tracking = await ref
          .read(deliveriesRepositoryProvider)
          .fetchDeliveryTracking(widget.deliveryId);
      if (!mounted) {
        return;
      }

      setState(() {
        _tracking = tracking;
        _loading = false;
        _error = null;
      });
      _syncPollTimer(tracking);
    } catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _loading = initial;
        _error = error;
      });
      _pollTimer?.cancel();
      _pollTimer = null;
    } finally {
      _refreshing = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

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
              child: _loading
                  ? const Center(
                      child: _StatePanel(
                        icon: Icons.hourglass_empty_rounded,
                        title: 'Loading tracking',
                        subtitle: 'Fetching the latest delivery location.',
                      ),
                    )
                  : _error != null
                  ? Center(
                      child: _StatePanel(
                        icon: Icons.cloud_off_outlined,
                        title: 'Could not load tracking',
                        subtitle: 'Please try again.',
                        actionLabel: 'Retry',
                        onAction: () => unawaited(_fetchTracking(initial: true)),
                      ),
                    )
                  : _tracking == null
                  ? const SizedBox.shrink()
                  : SingleChildScrollView(
                      padding: const EdgeInsetsDirectional.fromSTEB(
                        AppSpacing.md,
                        AppSpacing.lg,
                        AppSpacing.md,
                        AppSpacing.xl,
                      ),
                      child: Center(
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 1040),
                          child: _TrackingContent(
                            tracking: _tracking!,
                            refreshing: _refreshing,
                            onRefresh: () => unawaited(_fetchTracking()),
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

class _TrackingContent extends StatelessWidget {
  const _TrackingContent({
    required this.tracking,
    required this.refreshing,
    required this.onRefresh,
  });

  final LearnerDeliveryTracking tracking;
  final bool refreshing;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final location = tracking.latestDriverLocation;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
          decoration: BoxDecoration(
            color: palette.panelSurface,
            borderRadius: AppRadius.xlAll,
            border: Border.all(color: palette.borderStrong),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                tracking.materialTitle,
                style: AppTextStyles.title(
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
                    label: deliveryStatusLabel(tracking.status),
                    tone: deliveryStatusTone(tracking.status),
                  ),
                  if (tracking.driverDisplayName?.trim().isNotEmpty == true)
                    Text(
                      'Driver: ${tracking.driverDisplayName}',
                      style: AppTextStyles.body(
                        context,
                      ).copyWith(color: palette.textSecondary),
                    ),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              Text(
                tracking.trackingMessage,
                style: AppTextStyles.body(context),
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                tracking.routeLabel,
                style: AppTextStyles.label(
                  context,
                ).copyWith(color: palette.textMuted),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        if (!tracking.canTrack)
          _StatePanel(
            icon: Icons.info_outline,
            title: 'Tracking not available yet',
            subtitle: tracking.trackingMessage,
          )
        else if (location == null)
          _StatePanel(
            icon: Icons.location_searching,
            title: 'Waiting for driver location',
            subtitle:
                'The driver has picked up your material. Location will appear here once shared.',
          )
        else ...[
          if (tracking.isLocationStale)
            Container(
              margin: const EdgeInsetsDirectional.only(bottom: AppSpacing.md),
              padding: const EdgeInsetsDirectional.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: AppThemeColors.of(context).warningSoft,
                borderRadius: AppRadius.lgAll,
                border: Border.all(
                  color: AppThemeColors.of(context).warningBorder.withValues(
                    alpha: 0.35,
                  ),
                ),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.warning_amber_rounded,
                    color: AppThemeColors.of(context).warning,
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Text(
                      'Driver location may be outdated. Last update was more than 90 seconds ago.',
                      style: AppTextStyles.body(context),
                    ),
                  ),
                ],
              ),
            ),
          _TrackingMap(
            key: ValueKey(
              '${location.latitude}_${location.longitude}_${location.capturedAt.millisecondsSinceEpoch}',
            ),
            driverLocation: location,
            dropoffLatitude: tracking.dropoffLatitude,
            dropoffLongitude: tracking.dropoffLongitude,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Last updated: ${DateFormat.yMMMd().add_jm().format(location.capturedAt.toLocal())}',
            style: AppTextStyles.label(
              context,
            ).copyWith(color: palette.textMuted),
          ),
        ],
        const SizedBox(height: AppSpacing.md),
        Align(
          alignment: AlignmentDirectional.centerStart,
          child: TextButton.icon(
            onPressed: refreshing ? null : onRefresh,
            icon: refreshing
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.refresh_outlined, size: 18),
            label: Text(refreshing ? 'Refreshing…' : 'Refresh tracking'),
          ),
        ),
        TextButton.icon(
          onPressed: () =>
              context.go('/learner/deliveries/${tracking.deliveryId}'),
          icon: const Icon(Icons.assignment_outlined),
          label: const Text('View delivery details'),
        ),
      ],
    );
  }
}

class _TrackingMap extends StatefulWidget {
  const _TrackingMap({
    super.key,
    required this.driverLocation,
    this.dropoffLatitude,
    this.dropoffLongitude,
  });

  final LearnerDeliveryTrackingLocation driverLocation;
  final double? dropoffLatitude;
  final double? dropoffLongitude;

  @override
  State<_TrackingMap> createState() => _TrackingMapState();
}

class _TrackingMapState extends State<_TrackingMap> {
  late final MapController _mapController;
  late LatLng _driverPoint;

  @override
  void initState() {
    super.initState();
    _mapController = MapController();
    _driverPoint = LatLng(
      widget.driverLocation.latitude,
      widget.driverLocation.longitude,
    );
  }

  @override
  void didUpdateWidget(covariant _TrackingMap oldWidget) {
    super.didUpdateWidget(oldWidget);
    final nextPoint = LatLng(
      widget.driverLocation.latitude,
      widget.driverLocation.longitude,
    );
    if (nextPoint != _driverPoint) {
      _driverPoint = nextPoint;
      _mapController.move(nextPoint, _mapController.camera.zoom);
    }
  }

  @override
  void dispose() {
    _mapController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final dropoffPoint = widget.dropoffLatitude != null &&
            widget.dropoffLongitude != null
        ? LatLng(widget.dropoffLatitude!, widget.dropoffLongitude!)
        : null;

    final markers = <Marker>[
      Marker(
        point: _driverPoint,
        width: 40,
        height: 40,
        alignment: Alignment.center,
        child: Icon(Icons.local_shipping_outlined, color: palette.mint, size: 28),
      ),
      if (dropoffPoint != null)
        Marker(
          point: dropoffPoint,
          width: 40,
          height: 40,
          alignment: Alignment.center,
          child: Icon(Icons.home_outlined, color: palette.textSecondary, size: 28),
        ),
    ];

    return ClipRRect(
      borderRadius: AppRadius.lgAll,
      child: SizedBox(
        height: MediaQuery.sizeOf(context).width >= 700 ? 320 : 260,
        width: double.infinity,
        child: FlutterMap(
          mapController: _mapController,
          options: MapOptions(
            initialCenter: _driverPoint,
            initialZoom: 13,
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
            MarkerLayer(markers: markers),
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
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: palette.panelSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 36, color: palette.textMuted),
          const SizedBox(height: AppSpacing.md),
          Text(
            title,
            style: AppTextStyles.title(context),
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
            const SizedBox(height: AppSpacing.md),
            FilledButton(onPressed: onAction, child: Text(actionLabel!)),
          ],
        ],
      ),
    );
  }
}
