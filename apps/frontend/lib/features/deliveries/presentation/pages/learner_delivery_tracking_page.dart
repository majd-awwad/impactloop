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

final learnerDeliveryTrackingProvider = FutureProvider.autoDispose
    .family<LearnerDeliveryTracking, String>((ref, deliveryId) {
      return ref
          .read(deliveriesRepositoryProvider)
          .fetchDeliveryTracking(deliveryId);
    });

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
  bool _refreshing = false;

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  void _syncPollTimer(LearnerDeliveryTracking tracking) {
    _pollTimer?.cancel();
    if (tracking.canTrack && !tracking.isTerminal) {
      _pollTimer = Timer.periodic(_trackingPollInterval, (_) {
        unawaited(_refreshSilently());
      });
    }
  }

  Future<void> _refreshSilently() async {
    if (_refreshing || !mounted) {
      return;
    }

    final current = _tracking;
    if (current == null || !current.canTrack || current.isTerminal) {
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

      setState(() {
        _tracking = tracking;
      });
      _syncPollTimer(tracking);
    } catch (error) {
      // Keep last known tracking visible during background polling errors.
    } finally {
      _refreshing = false;
    }
  }

  Future<void> _retry() async {
    ref.invalidate(learnerDeliveryTrackingProvider(widget.deliveryId));
  }

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final trackingAsync = ref.watch(
      learnerDeliveryTrackingProvider(widget.deliveryId),
    );

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
              child: trackingAsync.when(
                loading: () => const Center(
                  child: _StatePanel(
                    icon: Icons.hourglass_empty_rounded,
                    title: 'Loading tracking',
                    subtitle: 'Fetching the latest delivery location.',
                  ),
                ),
                error: (error, _) => Center(
                  child: _StatePanel(
                    icon: Icons.cloud_off_outlined,
                    title: 'Could not load tracking',
                    subtitle: 'Please try again.',
                    actionLabel: 'Retry',
                    onAction: _retry,
                  ),
                ),
                data: (tracking) {
                  _tracking ??= tracking;
                  if (_tracking!.deliveryId != tracking.deliveryId) {
                    _tracking = tracking;
                  } else if (_tracking != tracking) {
                    _tracking = tracking;
                  }
                  _syncPollTimer(_tracking!);

                  return SingleChildScrollView(
                    padding: const EdgeInsetsDirectional.fromSTEB(
                      AppSpacing.md,
                      AppSpacing.lg,
                      AppSpacing.md,
                      AppSpacing.xl,
                    ),
                    child: Center(
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 1040),
                        child: _TrackingContent(tracking: _tracking!),
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TrackingContent extends StatelessWidget {
  const _TrackingContent({required this.tracking});

  final LearnerDeliveryTracking tracking;

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
        const SizedBox(height: AppSpacing.lg),
        TextButton.icon(
          onPressed: () => context.go('/learner/deliveries/${tracking.deliveryId}'),
          icon: const Icon(Icons.assignment_outlined),
          label: const Text('View delivery details'),
        ),
      ],
    );
  }
}

class _TrackingMap extends StatelessWidget {
  const _TrackingMap({
    required this.driverLocation,
    this.dropoffLatitude,
    this.dropoffLongitude,
  });

  final LearnerDeliveryTrackingLocation driverLocation;
  final double? dropoffLatitude;
  final double? dropoffLongitude;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final driverPoint = LatLng(
      driverLocation.latitude,
      driverLocation.longitude,
    );
    final dropoffPoint = dropoffLatitude != null && dropoffLongitude != null
        ? LatLng(dropoffLatitude!, dropoffLongitude!)
        : null;

    final markers = <Marker>[
      Marker(
        point: driverPoint,
        width: 48,
        height: 48,
        alignment: Alignment.topCenter,
        child: _MapMarker(
          color: palette.mint,
          icon: Icons.local_shipping_outlined,
          label: 'Driver',
        ),
      ),
      if (dropoffPoint != null)
        Marker(
          point: dropoffPoint,
          width: 48,
          height: 48,
          alignment: Alignment.topCenter,
          child: _MapMarker(
            color: palette.textSecondary,
            icon: Icons.home_outlined,
            label: 'Drop-off',
          ),
        ),
    ];

    final center = dropoffPoint ?? driverPoint;

    return ClipRRect(
      borderRadius: AppRadius.lgAll,
      child: SizedBox(
        height: MediaQuery.sizeOf(context).width >= 700 ? 320 : 260,
        width: double.infinity,
        child: FlutterMap(
          options: MapOptions(
            initialCenter: center,
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

class _MapMarker extends StatelessWidget {
  const _MapMarker({
    required this.color,
    required this.icon,
    required this.label,
  });

  final Color color;
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          padding: const EdgeInsetsDirectional.symmetric(
            horizontal: AppSpacing.xs,
            vertical: 2,
          ),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: AppRadius.pillAll,
            border: Border.all(color: color),
          ),
          child: Text(
            label,
            style: AppTextStyles.label(context).copyWith(
              color: color,
              fontSize: 10,
            ),
          ),
        ),
        Icon(icon, color: color, size: 32),
      ],
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
          Text(title, style: AppTextStyles.title(context), textAlign: TextAlign.center),
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
