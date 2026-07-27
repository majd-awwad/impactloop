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
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../data/deliveries_repository.dart';
import '../../data/models/learner_delivery_tracking.dart';
import '../delivery_status_presentation.dart';

const _trackingPollInterval = Duration(seconds: 20);

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
  bool _initialLoading = true;
  bool _pollInFlight = false;
  bool _manualRefreshing = false;
  Object? _error;
  String? _backgroundWarning;
  bool _pollTimerActive = false;

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
    _pollTimer = null;
    super.dispose();
  }

  bool _trackingDataChanged(
    LearnerDeliveryTracking? previous,
    LearnerDeliveryTracking next,
  ) {
    if (previous == null) {
      return true;
    }

    if (previous.status != next.status ||
        previous.canTrack != next.canTrack ||
        previous.isTerminal != next.isTerminal ||
        previous.isLocationStale != next.isLocationStale ||
        previous.trackingMessage != next.trackingMessage) {
      return true;
    }

    final prevLocation = previous.latestDriverLocation;
    final nextLocation = next.latestDriverLocation;

    if (prevLocation == null && nextLocation == null) {
      return false;
    }

    if (prevLocation == null || nextLocation == null) {
      return true;
    }

    return prevLocation.latitude != nextLocation.latitude ||
        prevLocation.longitude != nextLocation.longitude ||
        prevLocation.capturedAt != nextLocation.capturedAt;
  }

  void _stopPolling() {
    _pollTimer?.cancel();
    _pollTimer = null;
    _pollTimerActive = false;
  }

  void _ensurePollTimer(LearnerDeliveryTracking tracking) {
    final shouldPoll = tracking.canTrack && !tracking.isTerminal;

    if (!shouldPoll) {
      _stopPolling();
      return;
    }

    if (_pollTimerActive) {
      return;
    }

    _pollTimer = Timer.periodic(_trackingPollInterval, (_) {
      unawaited(_fetchTracking(silent: true));
    });
    _pollTimerActive = true;
  }

  Future<void> _fetchTracking({
    bool initial = false,
    bool silent = false,
    bool manual = false,
  }) async {
    if (!mounted) {
      return;
    }

    if (_pollInFlight) {
      if (silent) {
        return;
      }
    }

    _pollInFlight = true;
    if (initial) {
      setState(() {
        _initialLoading = true;
        _error = null;
        _backgroundWarning = null;
      });
    } else if (manual) {
      setState(() {
        _manualRefreshing = true;
        _backgroundWarning = null;
      });
    }

    try {
      final tracking = await ref
          .read(deliveriesRepositoryProvider)
          .fetchDeliveryTracking(widget.deliveryId);
      if (!mounted) {
        return;
      }

      final changed = _trackingDataChanged(_tracking, tracking);
      if (changed || initial) {
        setState(() {
          _tracking = tracking;
          _initialLoading = false;
          _error = null;
          _backgroundWarning = null;
        });
      } else if (_initialLoading) {
        setState(() => _initialLoading = false);
      } else if (silent) {
        setState(() => _backgroundWarning = null);
      }

      if (tracking.isTerminal || !tracking.canTrack) {
        _stopPolling();
      } else {
        _ensurePollTimer(tracking);
      }
    } catch (error) {
      if (!mounted) {
        return;
      }

      if (initial || _tracking == null) {
        setState(() {
          _initialLoading = false;
          _error = error;
        });
        _stopPolling();
      } else if (silent || manual) {
        setState(
          () => _backgroundWarning =
              'Could not refresh tracking. Showing the last known location.',
        );
      }
    } finally {
      if (mounted) {
        if (manual || !silent) {
          setState(() => _manualRefreshing = false);
        }
      }
      _pollInFlight = false;
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
              child: _initialLoading
                  ? const Center(
                      child: _StatePanel(
                        icon: Icons.hourglass_empty_rounded,
                        title: 'Loading delivery tracking…',
                        subtitle: 'Fetching the latest delivery location.',
                      ),
                    )
                  : _error != null
                  ? Center(
                      child: _StatePanel(
                        icon: Icons.cloud_off_outlined,
                        title: 'Could not load tracking.',
                        subtitle: 'Please try again.',
                        actionLabel: 'Retry',
                        onAction: () =>
                            unawaited(_fetchTracking(initial: true)),
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
                            refreshing: _manualRefreshing,
                            backgroundWarning: _backgroundWarning,
                            showAutoUpdateHint:
                                _tracking!.canTrack && !_tracking!.isTerminal,
                            onRefresh: () =>
                                unawaited(_fetchTracking(manual: true)),
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
    required this.showAutoUpdateHint,
    required this.onRefresh,
    this.backgroundWarning,
  });

  final LearnerDeliveryTracking tracking;
  final bool refreshing;
  final bool showAutoUpdateHint;
  final String? backgroundWarning;
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
                  AppStatusBadge(
                    label: deliveryStatusLabel(tracking.status),
                    tone: deliveryStatusAppTone(tracking.status),
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
            title: 'Waiting for driver location.',
            subtitle:
                'The driver has picked up your material. Location will appear here once shared.',
          )
        else ...[
          if (backgroundWarning != null)
            Container(
              margin: const EdgeInsetsDirectional.only(bottom: AppSpacing.md),
              padding: const EdgeInsetsDirectional.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: AppThemeColors.of(context).warningSoft,
                borderRadius: AppRadius.lgAll,
                border: Border.all(
                  color: AppThemeColors.of(
                    context,
                  ).warningBorder.withValues(alpha: 0.35),
                ),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.cloud_off_outlined,
                    color: AppThemeColors.of(context).warning,
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Text(
                      backgroundWarning!,
                      style: AppTextStyles.body(context),
                    ),
                  ),
                ],
              ),
            ),
          if (tracking.isLocationStale)
            Container(
              margin: const EdgeInsetsDirectional.only(bottom: AppSpacing.md),
              padding: const EdgeInsetsDirectional.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: AppThemeColors.of(context).warningSoft,
                borderRadius: AppRadius.lgAll,
                border: Border.all(
                  color: AppThemeColors.of(
                    context,
                  ).warningBorder.withValues(alpha: 0.35),
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
                      'Driver location has not updated recently.',
                      style: AppTextStyles.body(context),
                    ),
                  ),
                ],
              ),
            ),
          _TrackingMap(
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
        if (showAutoUpdateHint) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Auto-updates while this page is open.',
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
            style: AppStatusButtonStyle.text(context, AppStatusTone.info),
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
          style: AppStatusButtonStyle.text(context, AppStatusTone.neutral),
          icon: const Icon(Icons.assignment_outlined),
          label: const Text('View delivery details'),
        ),
      ],
    );
  }
}

class _TrackingMap extends StatefulWidget {
  const _TrackingMap({
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
  bool _mapReady = false;

  @override
  void initState() {
    super.initState();
    _mapController = MapController();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        setState(() => _mapReady = true);
      }
    });
  }

  @override
  void didUpdateWidget(covariant _TrackingMap oldWidget) {
    super.didUpdateWidget(oldWidget);
    final oldPoint = LatLng(
      oldWidget.driverLocation.latitude,
      oldWidget.driverLocation.longitude,
    );
    final nextPoint = LatLng(
      widget.driverLocation.latitude,
      widget.driverLocation.longitude,
    );

    if (oldPoint.latitude == nextPoint.latitude &&
        oldPoint.longitude == nextPoint.longitude) {
      return;
    }

    if (!_mapReady) {
      return;
    }

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) {
        return;
      }

      try {
        _mapController.move(nextPoint, _mapController.camera.zoom);
      } catch (_) {
        // Map may not be ready yet; marker layer still updates.
      }
    });
  }

  @override
  void dispose() {
    _mapController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final driverPoint = LatLng(
      widget.driverLocation.latitude,
      widget.driverLocation.longitude,
    );
    final dropoffPoint =
        widget.dropoffLatitude != null && widget.dropoffLongitude != null
        ? LatLng(widget.dropoffLatitude!, widget.dropoffLongitude!)
        : null;

    final markers = <Marker>[
      Marker(
        point: driverPoint,
        width: 40,
        height: 40,
        alignment: Alignment.center,
        child: Icon(
          Icons.local_shipping_outlined,
          color: palette.mint,
          size: 28,
        ),
      ),
      if (dropoffPoint != null)
        Marker(
          point: dropoffPoint,
          width: 40,
          height: 40,
          alignment: Alignment.center,
          child: Icon(
            Icons.home_outlined,
            color: palette.textSecondary,
            size: 28,
          ),
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
            initialCenter: driverPoint,
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
