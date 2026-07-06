import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../shared/widgets/app_feedback.dart';
import '../../../../shared/widgets/materials/material_status_badge.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../deliveries/presentation/delivery_status_presentation.dart';
import '../../../deliveries/presentation/pickup_window_presentation.dart';
import '../../application/driver_deliveries_provider.dart';
import '../../application/driver_delivery_action_controller.dart';
import '../../application/driver_jobs_filter_helpers.dart';
import '../../data/models/driver_deliveries_list_result.dart';
import '../../data/models/driver_delivery.dart';

class DriverJobsPage extends ConsumerStatefulWidget {
  const DriverJobsPage({super.key});

  @override
  ConsumerState<DriverJobsPage> createState() => _DriverJobsPageState();
}

class _DriverJobsPageState extends ConsumerState<DriverJobsPage> {
  bool _defaultsSeedScheduled = false;

  @override
  Widget build(BuildContext context) {
    final activeAsync = ref.watch(activeDriverDeliveriesProvider);
    final availableAsync = ref.watch(availableDriverDeliveriesProvider);
    final appliedFilter = ref.watch(driverAvailableJobsFilterProvider);

    ref.listen(availableDriverDeliveriesProvider, (previous, next) {
      next.whenData((result) {
        if (_defaultsSeedScheduled) {
          return;
        }

        final notifier = ref.read(driverAvailableJobsFilterProvider.notifier);
        if (notifier.hasSeededDefaults || notifier.userModified) {
          _defaultsSeedScheduled = true;
          return;
        }

        _defaultsSeedScheduled = true;
        notifier.seedDefaultsFromMeta(result.meta);
      });
    });

    final activeMeta = activeAsync.value?.meta;
    final availableMeta = availableAsync.value?.meta;
    final headerMeta = availableMeta ?? activeMeta;
    final canAcceptMore =
        activeMeta?.canAcceptMore ?? availableMeta?.canAcceptMore ?? true;
    final activeCount =
        activeMeta?.activeDeliveryCount ?? availableMeta?.activeDeliveryCount ?? 0;
    final maxActive =
        activeMeta?.maxActiveDeliveries ?? availableMeta?.maxActiveDeliveries ?? 3;
    final nearbyCount = availableMeta?.nearbyAvailableCount ??
        availableAsync.value?.deliveries.length;
    final totalAvailableCount =
        availableMeta?.totalAvailableCount ?? nearbyCount;

    return SingleChildScrollView(
      padding: EdgeInsetsDirectional.fromSTEB(
        AppSpacing.md,
        AppSpacing.lg,
        AppSpacing.md,
        _driverJobsBottomPadding(context),
      ),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1120),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _JobsHeader(
                activeCount: activeCount,
                maxActive: maxActive,
                nearbyCount: nearbyCount,
                totalAvailableCount: totalAvailableCount,
                areaLabel: _areaChipLabel(headerMeta),
              ),
              const SizedBox(height: AppSpacing.lg),
              activeAsync.when(
                loading: () => const _ActiveDeliveriesLoading(),
                error: (error, _) => _StatePanel(
                  icon: Icons.cloud_off_outlined,
                  title: 'Could not load active deliveries',
                  subtitle: kDebugMode
                      ? '$error'
                      : 'Refresh before accepting a new job.',
                  actionLabel: 'Retry',
                  onAction: () => refreshDriverJobs(ref),
                ),
                data: (result) => _ActiveDeliveriesSection(result: result),
              ),
              const SizedBox(height: AppSpacing.lg),
              Text(
                'Available nearby jobs',
                style: AppTextStyles.title(context),
              ),
              const SizedBox(height: AppSpacing.md),
              _AvailableJobsFilters(meta: headerMeta),
              const SizedBox(height: AppSpacing.md),
              if (!canAcceptMore) ...[
                Text(
                  'You reached the active delivery limit.',
                  style: AppTextStyles.body(context),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  'Complete one delivery before accepting another.',
                  style: AppTextStyles.body(context).copyWith(
                    color: MaterialsUiPalette.of(context).textSecondary,
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
              ],
              availableAsync.when(
                skipLoadingOnReload: true,
                loading: () => const _StatePanel(
                  icon: Icons.inventory_2_outlined,
                  title: 'Loading available jobs…',
                  subtitle: 'Looking for waiting delivery requests.',
                  compact: true,
                ),
                error: (error, _) => _StatePanel(
                  icon: Icons.cloud_off_outlined,
                  title: 'Could not load available jobs.',
                  subtitle: kDebugMode
                      ? '$error'
                      : 'Check your connection and try again.',
                  actionLabel: 'Retry',
                  onAction: () => refreshDriverJobs(ref),
                  compact: true,
                ),
                data: (result) {
                  if (result.deliveries.isEmpty) {
                    final emptyCopy = availableJobsEmptyStateCopy(
                      filter: appliedFilter,
                      nearbyCount: result.meta.nearbyAvailableCount ?? 0,
                      totalAvailableCount: result.meta.totalAvailableCount,
                    );

                    return _AvailableJobsEmptyState(
                      copy: emptyCopy,
                      onIncreaseRadius: emptyCopy.showIncreaseRadius
                          ? () => ref
                                .read(driverAvailableJobsFilterProvider.notifier)
                                .increaseRadius()
                          : null,
                      onShowAnyDistance: emptyCopy.showAnyDistance
                          ? () => ref
                                .read(driverAvailableJobsFilterProvider.notifier)
                                .setAnyDistance()
                          : null,
                      onReset: emptyCopy.showReset && headerMeta != null
                          ? () => ref
                                .read(driverAvailableJobsFilterProvider.notifier)
                                .resetToProfileDefaults(headerMeta)
                          : null,
                    );
                  }

                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      for (final delivery in result.deliveries) ...[
                        _AvailableJobCard(
                          delivery: delivery,
                          acceptDisabled: !canAcceptMore,
                        ),
                        const SizedBox(height: AppSpacing.md),
                      ],
                    ],
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}

double _driverJobsBottomPadding(BuildContext context) {
  final isCompactMobile = MediaQuery.sizeOf(context).width < 820;
  if (!isCompactMobile) {
    return AppSpacing.xl;
  }

  return kBottomNavigationBarHeight +
      MediaQuery.paddingOf(context).bottom +
      AppSpacing.lg;
}

String? _areaChipLabel(DriverDeliveriesListMeta? meta) {
  if (meta == null) {
    return null;
  }

  final area = meta.driverProfileArea?.trim();
  final city = meta.driverProfileCity?.trim();
  if (area != null && area.isNotEmpty) {
    return area;
  }
  if (city != null && city.isNotEmpty) {
    return city;
  }
  return null;
}

class _JobsHeader extends StatelessWidget {
  const _JobsHeader({
    required this.activeCount,
    required this.maxActive,
    required this.nearbyCount,
    required this.totalAvailableCount,
    required this.areaLabel,
  });

  final int activeCount;
  final int maxActive;
  final int? nearbyCount;
  final int? totalAvailableCount;
  final String? areaLabel;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final showTotal =
        nearbyCount != null &&
        totalAvailableCount != null &&
        totalAvailableCount != nearbyCount;

    return _Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Driver jobs',
            style: AppTextStyles.display(
              context,
            ).copyWith(color: palette.textPrimary),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Basic internal delivery coordination',
            style: AppTextStyles.subtitle(
              context,
            ).copyWith(color: palette.textSecondary),
          ),
          const SizedBox(height: AppSpacing.md),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              _StatChip(
                icon: Icons.route_outlined,
                label: 'Active deliveries: $activeCount/$maxActive',
              ),
              _StatChip(
                icon: Icons.near_me_outlined,
                label: nearbyCount == null
                    ? 'Available jobs: …'
                    : 'Available jobs: $nearbyCount',
              ),
              if (showTotal)
                _StatChip(
                  icon: Icons.inventory_2_outlined,
                  label: 'Total available: $totalAvailableCount',
                ),
              if (areaLabel != null)
                _StatChip(
                  icon: Icons.place_outlined,
                  label: 'Area: $areaLabel',
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _StatChip extends StatelessWidget {
  const _StatChip({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: palette.cardSurfaceAlt,
        borderRadius: AppRadius.pillAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: palette.mint),
          const SizedBox(width: AppSpacing.xs),
          Text(
            label,
            style: AppTextStyles.label(
              context,
            ).copyWith(color: palette.textSecondary),
          ),
        ],
      ),
    );
  }
}

class _ActiveDeliveriesLoading extends StatelessWidget {
  const _ActiveDeliveriesLoading();

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('My active deliveries', style: AppTextStyles.title(context)),
        const SizedBox(height: AppSpacing.md),
        const _Panel(
          child: Row(
            children: [
              SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
              SizedBox(width: AppSpacing.md),
              Expanded(child: Text('Loading active deliveries…')),
            ],
          ),
        ),
      ],
    );
  }
}

class _ActiveDeliveriesSection extends StatelessWidget {
  const _ActiveDeliveriesSection({required this.result});

  final DriverDeliveriesListResult result;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                'My active deliveries',
                style: AppTextStyles.title(context),
              ),
            ),
            Text(
              '${result.meta.activeDeliveryCount}/${result.meta.maxActiveDeliveries}',
              style: AppTextStyles.label(context),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.md),
        if (result.deliveries.isEmpty)
          const _StatePanel(
            icon: Icons.check_circle_outline,
            title: 'No active deliveries yet.',
            subtitle: 'You can accept available jobs when you are ready.',
            compact: true,
          )
        else
          for (final delivery in result.deliveries) ...[
            _ActiveDeliveryCard(delivery: delivery),
            const SizedBox(height: AppSpacing.md),
          ],
      ],
    );
  }
}

class _ActiveDeliveryCard extends StatelessWidget {
  const _ActiveDeliveryCard({required this.delivery});

  final DriverDelivery delivery;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final pickup = _locationRouteLabel(
      city: delivery.pickupCity ?? delivery.pickupLocation.city,
      area: delivery.pickupArea ?? delivery.pickupLocation.area,
      fallback: delivery.pickupLocation.exactSummary,
    );
    final dropoff = _locationRouteLabel(
      city: delivery.dropoffCity ?? delivery.dropoffLocation.city,
      area: delivery.dropoffArea ?? delivery.dropoffLocation.area,
      fallback: delivery.dropoffLocation.exactSummary,
    );

    return _Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      delivery.material.title,
                      style: AppTextStyles.title(
                        context,
                      ).copyWith(color: palette.textPrimary),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      delivery.material.quantityLabel,
                      style: AppTextStyles.body(
                        context,
                      ).copyWith(color: palette.textSecondary),
                    ),
                  ],
                ),
              ),
              MaterialStatusBadge(
                label: deliveryStatusLabel(delivery.status),
                tone: deliveryStatusTone(delivery.status),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          LayoutBuilder(
            builder: (context, constraints) {
              final compact = constraints.maxWidth < 480;
              if (compact) {
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _RouteEndpoint(
                      icon: Icons.trip_origin,
                      label: pickup,
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    _RouteEndpoint(
                      icon: Icons.place_outlined,
                      label: dropoff,
                    ),
                  ],
                );
              }

              return Row(
                children: [
                  Icon(Icons.trip_origin, size: 16, color: palette.textMuted),
                  const SizedBox(width: AppSpacing.xs),
                  Expanded(
                    child: Text(pickup, style: AppTextStyles.body(context)),
                  ),
                  Icon(Icons.arrow_forward, size: 16, color: palette.textMuted),
                  const SizedBox(width: AppSpacing.xs),
                  Icon(Icons.place_outlined, size: 16, color: palette.textMuted),
                  const SizedBox(width: AppSpacing.xs),
                  Expanded(
                    child: Text(dropoff, style: AppTextStyles.body(context)),
                  ),
                ],
              );
            },
          ),
          const SizedBox(height: AppSpacing.md),
          FilledButton.icon(
            onPressed: () => context.push('/driver/deliveries/${delivery.id}'),
            icon: const Icon(Icons.route_outlined),
            label: const Text('Open delivery'),
          ),
        ],
      ),
    );
  }
}

class _RouteEndpoint extends StatelessWidget {
  const _RouteEndpoint({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 16, color: palette.textMuted),
        const SizedBox(width: AppSpacing.xs),
        Expanded(child: Text(label, style: AppTextStyles.body(context))),
      ],
    );
  }
}

class _AvailableJobsFilters extends ConsumerWidget {
  const _AvailableJobsFilters({required this.meta});

  final DriverDeliveriesListMeta? meta;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = MaterialsUiPalette.of(context);
    final filter = ref.watch(driverAvailableJobsFilterProvider);
    final notifier = ref.read(driverAvailableJobsFilterProvider.notifier);
    final radiusEnabled = hasUsableRadiusReference(meta);
    final anyDistance = filter.maxDistanceKm == null;
    final radiusIndex = radiusStepIndex(filter.maxDistanceKm);
    final radiusKm = anyDistance
        ? DriverJobsFilterConstants.defaultRadiusKm
        : radiusKmForStepIndex(radiusIndex);
    final profileCity = normalizeProfileField(meta?.driverProfileCity);
    final profileArea = distinctProfileArea(
      meta?.driverProfileArea,
      meta?.driverProfileCity,
    );

    return _CompactPanel(
      child: LayoutBuilder(
        builder: (context, constraints) {
          final wide = constraints.maxWidth >= 720;

          final radiusSection = Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                searchRadiusLabel(anyDistance: anyDistance, radiusKm: radiusKm),
                style: AppTextStyles.label(context),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                'Jobs are matched by pickup location.',
                style: AppTextStyles.body(context).copyWith(
                  color: palette.textSecondary,
                  fontSize: 12,
                ),
              ),
              SliderTheme(
                data: SliderTheme.of(context).copyWith(
                  trackHeight: 3,
                  thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 7),
                  overlayShape: const RoundSliderOverlayShape(overlayRadius: 14),
                  inactiveTrackColor: anyDistance
                      ? palette.borderSubtle.withValues(alpha: 0.5)
                      : null,
                ),
                child: Slider(
                  value: radiusIndex.toDouble(),
                  min: 0,
                  max: (DriverJobsFilterConstants.radiusStepsKm.length - 1)
                      .toDouble(),
                  divisions: DriverJobsFilterConstants.radiusStepsKm.length - 1,
                  label: anyDistance
                      ? 'Any distance'
                      : 'Within ${radiusKm.round()} km',
                  onChanged: !radiusEnabled || anyDistance
                      ? null
                      : (value) {
                          notifier.setRadiusKm(
                            radiusKmForStepIndex(value.round()),
                          );
                        },
                ),
              ),
              _RadiusMarks(
                steps: DriverJobsFilterConstants.radiusStepsKm,
                activeIndex: anyDistance ? null : radiusIndex,
                muted: anyDistance,
              ),
            ],
          );

          final sortSection = SegmentedButton<String>(
            segments: const [
              ButtonSegment(value: 'nearest', label: Text('Nearest')),
              ButtonSegment(value: 'newest', label: Text('Newest')),
            ],
            selected: {filter.sortBy},
            onSelectionChanged: (selection) {
              notifier.setSortBy(selection.first);
            },
          );

          final bottomChips = Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Text(
                'City:',
                style: AppTextStyles.label(
                  context,
                ).copyWith(color: palette.textMuted),
              ),
              FilterChip(
                label: const Text('All cities'),
                selected: filter.city == null,
                showCheckmark: true,
                onSelected: (_) => notifier.setCity(null),
              ),
              if (profileCity != null)
                FilterChip(
                  label: Text(profileCity),
                  selected:
                      filter.city?.toLowerCase() == profileCity.toLowerCase(),
                  showCheckmark: true,
                  onSelected: (_) => notifier.setCity(profileCity),
                ),
              Text(
                'Area:',
                style: AppTextStyles.label(
                  context,
                ).copyWith(color: palette.textMuted),
              ),
              FilterChip(
                label: const Text('All areas'),
                selected: filter.area == null,
                showCheckmark: true,
                onSelected: (_) => notifier.setArea(null),
              ),
              if (profileArea != null)
                FilterChip(
                  label: Text(profileArea),
                  selected:
                      filter.area?.toLowerCase() == profileArea.toLowerCase(),
                  showCheckmark: true,
                  onSelected: (_) => notifier.setArea(profileArea),
                ),
              FilterChip(
                avatar: anyDistance
                    ? Icon(Icons.check_circle, size: 16, color: palette.mint)
                    : null,
                label: const Text('Any distance'),
                selected: anyDistance,
                showCheckmark: false,
                onSelected: !radiusEnabled
                    ? null
                    : (selected) {
                        if (selected) {
                          notifier.setAnyDistance();
                        } else {
                          notifier.setRadiusKm(
                            DriverJobsFilterConstants.defaultRadiusKm,
                          );
                        }
                      },
              ),
              TextButton(
                onPressed: meta == null
                    ? null
                    : () => notifier.resetToProfileDefaults(meta!),
                child: const Text('Reset filters'),
              ),
              if (!radiusEnabled)
                Text(
                  'Radius needs a recent location ping.',
                  style: AppTextStyles.body(context).copyWith(
                    color: palette.textSecondary,
                    fontSize: 12,
                  ),
                ),
            ],
          );

          if (wide) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.my_location_outlined, size: 18, color: palette.mint),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Location',
                            style: AppTextStyles.label(
                              context,
                            ).copyWith(color: palette.textMuted),
                          ),
                          const SizedBox(height: AppSpacing.xs),
                          Text(
                            driverLocationSummary(meta),
                            style: AppTextStyles.body(context),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.md),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(flex: 3, child: radiusSection),
                    const SizedBox(width: AppSpacing.lg),
                    Expanded(
                      flex: 2,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Sort',
                            style: AppTextStyles.label(
                              context,
                            ).copyWith(color: palette.textMuted),
                          ),
                          const SizedBox(height: AppSpacing.sm),
                          sortSection,
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.sm),
                bottomChips,
              ],
            );
          }

          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.my_location_outlined, size: 18, color: palette.mint),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Location',
                          style: AppTextStyles.label(
                            context,
                          ).copyWith(color: palette.textMuted),
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        Text(
                          driverLocationSummary(meta),
                          style: AppTextStyles.body(context),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              radiusSection,
              const SizedBox(height: AppSpacing.md),
              Text(
                'Sort',
                style: AppTextStyles.label(
                  context,
                ).copyWith(color: palette.textMuted),
              ),
              const SizedBox(height: AppSpacing.sm),
              sortSection,
              const SizedBox(height: AppSpacing.sm),
              bottomChips,
            ],
          );
        },
      ),
    );
  }
}

class _RadiusMarks extends StatelessWidget {
  const _RadiusMarks({
    required this.steps,
    required this.activeIndex,
    required this.muted,
  });

  final List<double> steps;
  final int? activeIndex;
  final bool muted;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Row(
      children: [
        for (var index = 0; index < steps.length; index++) ...[
          if (index > 0) const Expanded(child: SizedBox()),
          Text(
            '${steps[index].round()} km',
            style: AppTextStyles.label(context).copyWith(
              color: muted
                  ? palette.textMuted
                  : activeIndex == index
                  ? palette.mint
                  : palette.textSecondary,
              fontSize: 11,
              fontWeight: activeIndex == index ? FontWeight.w700 : FontWeight.w500,
            ),
          ),
        ],
      ],
    );
  }
}

class _CompactPanel extends StatelessWidget {
  const _CompactPanel({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: palette.cardSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderStrong),
      ),
      child: child,
    );
  }
}

class _AvailableJobsEmptyState extends StatelessWidget {
  const _AvailableJobsEmptyState({
    required this.copy,
    this.onIncreaseRadius,
    this.onShowAnyDistance,
    this.onReset,
  });

  final AvailableJobsEmptyStateCopy copy;
  final VoidCallback? onIncreaseRadius;
  final VoidCallback? onShowAnyDistance;
  final VoidCallback? onReset;

  @override
  Widget build(BuildContext context) {
    return _StatePanel(
      icon: Icons.local_shipping_outlined,
      title: copy.title,
      subtitle: copy.subtitle,
      compact: true,
      actions: [
        if (onIncreaseRadius != null)
          FilledButton(
            onPressed: onIncreaseRadius,
            child: const Text('Increase radius'),
          ),
        if (onShowAnyDistance != null)
          FilledButton.tonal(
            onPressed: onShowAnyDistance,
            child: const Text('Show any distance'),
          ),
        if (onReset != null)
          TextButton(onPressed: onReset, child: const Text('Reset filters')),
      ],
    );
  }
}

class _AvailableJobCard extends ConsumerWidget {
  const _AvailableJobCard({
    required this.delivery,
    required this.acceptDisabled,
  });

  final DriverDelivery delivery;
  final bool acceptDisabled;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = MaterialsUiPalette.of(context);
    final actionState = ref.watch(driverDeliveryActionControllerProvider);
    final isSubmitting = actionState.isLoading;
    final pickupSummary = _locationRouteLabel(
      city: delivery.pickupCity ?? delivery.pickupLocation.city,
      area: delivery.pickupArea ?? delivery.pickupLocation.area,
      fallback: delivery.pickupLocation.safeSummary,
    );
    final dropoffSummary = _locationRouteLabel(
      city: delivery.dropoffCity ?? delivery.dropoffLocation.city,
      area: delivery.dropoffArea ?? delivery.dropoffLocation.area,
      fallback: delivery.dropoffLocation.safeSummary,
    );
    final distanceText = distanceFromYouLabel(delivery.distanceKm);

    return _Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      delivery.material.title,
                      style: AppTextStyles.title(
                        context,
                      ).copyWith(color: palette.textPrimary),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      delivery.material.quantityLabel,
                      style: AppTextStyles.body(
                        context,
                      ).copyWith(color: palette.textSecondary),
                    ),
                  ],
                ),
              ),
              MaterialStatusBadge(
                label: deliveryStatusLabel(delivery.status),
                tone: deliveryStatusTone(delivery.status),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          _InfoGrid(
            items: [
              _InfoItem('Pickup window', driverPickupWindowSummary(delivery)),
              _InfoItem('Pickup', pickupSummary),
              _InfoItem('Drop-off', dropoffSummary),
              _InfoItem('Distance', distanceText),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: FilledButton.icon(
              onPressed: acceptDisabled || isSubmitting
                  ? null
                  : () => _acceptDelivery(context, ref),
              icon: isSubmitting
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.assignment_turned_in_outlined),
              label: Text(
                acceptDisabled
                    ? 'Active delivery limit reached'
                    : isSubmitting
                    ? 'Accepting…'
                    : 'Accept job',
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _acceptDelivery(BuildContext context, WidgetRef ref) async {
    try {
      final assigned = await ref
          .read(driverDeliveryActionControllerProvider.notifier)
          .acceptDelivery(delivery.id);

      if (!context.mounted) {
        return;
      }

      showInfoSnackBar(context, 'Delivery accepted.');
      context.push('/driver/deliveries/${assigned.id}');
    } on ApiException catch (error) {
      refreshDriverJobs(ref);

      if (!context.mounted) {
        return;
      }

      final message = error.statusCode == 409
          ? _driverConflictMessage(error.message)
          : error.displayMessage;
      showInfoSnackBar(context, message);
    } catch (error) {
      if (!context.mounted) {
        return;
      }

      showErrorSnackBar(context, error);
    }
  }
}

String _locationRouteLabel({
  String? city,
  String? area,
  required String fallback,
}) {
  final parts = [area, city]
      .where((item) => item != null && item.trim().isNotEmpty)
      .cast<String>()
      .toList(growable: false);
  return parts.isEmpty ? fallback : parts.join(', ');
}

String _driverConflictMessage(String message) {
  final lower = message.toLowerCase();
  if (lower.contains('active delivery limit')) {
    return 'You have reached the active delivery limit.';
  }
  if (lower.contains('active delivery')) {
    return message;
  }
  if (lower.contains('not available') || lower.contains('must be available')) {
    return message;
  }

  return 'This delivery is no longer available.';
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

class _StatePanel extends StatelessWidget {
  const _StatePanel({
    required this.icon,
    required this.title,
    required this.subtitle,
    this.actionLabel,
    this.onAction,
    this.actions = const [],
    this.compact = false,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final String? actionLabel;
  final VoidCallback? onAction;
  final List<Widget> actions;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return _Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: palette.mint, size: compact ? 22 : 28),
          const SizedBox(height: AppSpacing.sm),
          Text(
            title,
            style: AppTextStyles.title(
              context,
            ).copyWith(color: palette.textPrimary),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            subtitle,
            style: AppTextStyles.body(
              context,
            ).copyWith(color: palette.textSecondary),
          ),
          if (actionLabel != null && onAction != null) ...[
            const SizedBox(height: AppSpacing.md),
            FilledButton(onPressed: onAction, child: Text(actionLabel!)),
          ],
          if (actions.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.md),
            Wrap(
              spacing: AppSpacing.sm,
              runSpacing: AppSpacing.sm,
              children: actions,
            ),
          ],
        ],
      ),
    );
  }
}

class _InfoGrid extends StatelessWidget {
  const _InfoGrid({required this.items});

  final List<_InfoItem> items;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final columns = constraints.maxWidth >= 720 ? 2 : 1;
        return Wrap(
          spacing: AppSpacing.md,
          runSpacing: AppSpacing.md,
          children: [
            for (final item in items)
              SizedBox(
                width: columns == 1
                    ? constraints.maxWidth
                    : (constraints.maxWidth - AppSpacing.md) / 2,
                child: _InfoTile(item: item),
              ),
          ],
        );
      },
    );
  }
}

class _InfoItem {
  const _InfoItem(this.label, this.value);

  final String label;
  final String value;
}

class _InfoTile extends StatelessWidget {
  const _InfoTile({required this.item});

  final _InfoItem item;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: palette.cardSurfaceAlt,
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            item.label,
            style: AppTextStyles.label(
              context,
            ).copyWith(color: palette.textMuted),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            item.value,
            style: AppTextStyles.body(
              context,
            ).copyWith(color: palette.textPrimary),
          ),
        ],
      ),
    );
  }
}
