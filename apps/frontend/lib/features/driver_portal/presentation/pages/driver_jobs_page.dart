import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../core/format/localized_formatters.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/l10n/driver_quantity_labels.dart';
import '../../../../shared/l10n/driver_ui_labels.dart';
import '../../../../shared/widgets/app_feedback.dart';
import '../../../../shared/widgets/bidi_text.dart';
import '../../../../shared/widgets/app_empty_state_card.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../deliveries/presentation/pickup_window_presentation.dart';
import '../../application/driver_deliveries_provider.dart';
import '../../application/driver_delivery_action_controller.dart';
import '../../application/driver_jobs_filter_helpers.dart';
import '../../application/driver_jobs_sort_labels.dart';
import '../../application/driver_profile_provider.dart';
import '../../data/models/driver_deliveries_list_result.dart';
import '../../data/models/driver_delivery.dart';
import '../../data/models/driver_operational_profile.dart';
import '../widgets/driver_route_block.dart';

class DriverJobsPage extends ConsumerStatefulWidget {
  const DriverJobsPage({super.key});

  @override
  ConsumerState<DriverJobsPage> createState() => _DriverJobsPageState();
}

class _DriverJobsPageState extends ConsumerState<DriverJobsPage> {
  bool _defaultsSeedScheduled = false;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final availableAsync = ref.watch(availableDriverDeliveriesProvider);
    final profileAsync = ref.watch(driverProfileProvider);
    final paginationError = ref.watch(
      driverAvailableJobsPaginationErrorProvider,
    );
    final appliedFilter = ref.watch(driverAvailableJobsFilterProvider);

    ref.listen(availableDriverDeliveriesProvider, (previous, next) {
      next.whenData((result) {
        if (_defaultsSeedScheduled) return;
        final notifier = ref.read(driverAvailableJobsFilterProvider.notifier);
        if (notifier.hasSeededDefaults || notifier.userModified) {
          _defaultsSeedScheduled = true;
          return;
        }
        _defaultsSeedScheduled = true;
        notifier.seedDefaultsFromMeta(result.meta);
      });
    });

    final availableMeta = availableAsync.value?.meta;
    final headerMeta = availableMeta;
    final canAcceptMore = availableMeta?.canAcceptMore ?? true;
    final activeCount = availableMeta?.activeDeliveryCount ?? 0;
    final maxActive = availableMeta?.maxActiveDeliveries ?? 3;
    final nearbyCount =
        availableMeta?.nearbyAvailableCount ??
        availableAsync.value?.deliveries.length;
    final totalAvailableCount =
        availableMeta?.totalAvailableCount ?? nearbyCount;
    final blocker = _resolveJobsBlocker(
      profileAsync.value?.profile,
      availableMeta,
    );

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
              if (blocker != null)
                _DriverJobsBlockedState(
                  blocker: blocker,
                  isUpdating: profileAsync.value?.isMutating == true,
                  onResume: blocker == _DriverJobsBlocker.paused
                      ? () async {
                          final changed = await ref
                              .read(driverProfileProvider.notifier)
                              .setAcceptingNewJobs(true);
                          if (!context.mounted || changed) return;
                          final error = ref
                              .read(driverProfileProvider)
                              .value
                              ?.availabilityError;
                          if (error != null) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text(
                                  localizedApiErrorMessage(error, l10n),
                                ),
                              ),
                            );
                          }
                        }
                      : null,
                )
              else ...[
                Text(
                  l10n.driverAvailableNearbyJobs,
                  style: AppTextStyles.title(context),
                ),
                const SizedBox(height: AppSpacing.md),
                _ResponsiveFilters(meta: headerMeta),
                const SizedBox(height: AppSpacing.md),
                if (!canAcceptMore) ...[
                  Text(
                    l10n.driverActiveLimitReached,
                    style: AppTextStyles.body(context),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    l10n.driverActiveLimitHint,
                    style: AppTextStyles.body(context).copyWith(
                      color: MaterialsUiPalette.of(context).textSecondary,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                ],
                availableAsync.when(
                  skipLoadingOnReload: true,
                  loading: () => _StatePanel(
                    icon: Icons.inventory_2_outlined,
                    title: l10n.driverLoadingAvailable,
                    subtitle: l10n.driverLookingForWaiting,
                    compact: true,
                  ),
                  error: (error, _) => _StatePanel(
                    icon: Icons.cloud_off_outlined,
                    title: l10n.driverCouldNotLoadAvailable,
                    subtitle: kDebugMode
                        ? '$error'
                        : l10n.supplierPleaseCheckYourConnectionAndTry,
                    actionLabel: l10n.retry,
                    onAction: () =>
                        ref.invalidate(availableDriverDeliveriesProvider),
                    compact: true,
                  ),
                  data: (result) {
                    if (result.deliveries.isEmpty) {
                      final emptyCopy = availableJobsEmptyStateCopy(
                        filter: appliedFilter,
                        l10n: l10n,
                        nearbyCount: result.meta.nearbyAvailableCount ?? 0,
                        totalAvailableCount: result.meta.totalAvailableCount,
                      );
                      return _AvailableJobsEmptyState(
                        copy: emptyCopy,
                        onIncreaseRadius: emptyCopy.showIncreaseRadius
                            ? () => ref
                                  .read(
                                    driverAvailableJobsFilterProvider.notifier,
                                  )
                                  .increaseRadius()
                            : null,
                        onShowAnyDistance: emptyCopy.showAnyDistance
                            ? () => ref
                                  .read(
                                    driverAvailableJobsFilterProvider.notifier,
                                  )
                                  .setAnyDistance()
                            : null,
                        onReset: emptyCopy.showReset && headerMeta != null
                            ? () => ref
                                  .read(
                                    driverAvailableJobsFilterProvider.notifier,
                                  )
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
                        if (paginationError != null) ...[
                          _StatePanel(
                            icon: Icons.sync_problem_outlined,
                            title: localizedApiErrorMessage(
                              paginationError,
                              l10n,
                            ),
                            subtitle: l10n.driverAvailableJobsCursorInvalid,
                            actionLabel: l10n.retry,
                            onAction: () => ref
                                .read(
                                  availableDriverDeliveriesProvider.notifier,
                                )
                                .restartPagination(),
                            compact: true,
                          ),
                          const SizedBox(height: AppSpacing.md),
                        ],
                        if (result.meta.pagination?.hasMore == true)
                          Align(
                            alignment: AlignmentDirectional.center,
                            child: OutlinedButton.icon(
                              onPressed: availableAsync.isLoading
                                  ? null
                                  : () => ref
                                        .read(
                                          availableDriverDeliveriesProvider
                                              .notifier,
                                        )
                                        .loadMore(),
                              icon: availableAsync.isLoading
                                  ? const SizedBox.square(
                                      dimension: 18,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                      ),
                                    )
                                  : const Icon(Icons.expand_more_rounded),
                              label: Text(l10n.loadMore),
                            ),
                          ),
                      ],
                    );
                  },
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _FilterChipData {
  const _FilterChipData({
    required this.label,
    this.onDeleted,
    this.opensSheet = false,
  });

  final String label;
  final VoidCallback? onDeleted;

  /// When true, chip is not removable; use Edit filters to change it.
  final bool opensSheet;
}

// ---------------------------------------------------------------------------
// Filter: responsive — mobile bottom-sheet vs desktop inline
// ---------------------------------------------------------------------------

class _ResponsiveFilters extends ConsumerWidget {
  const _ResponsiveFilters({required this.meta});
  final DriverDeliveriesListMeta? meta;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final wide = MediaQuery.sizeOf(context).width >= 720;
    if (wide) return _DesktopFilters(meta: meta);
    return _MobileFilterBar(meta: meta);
  }
}

class _MobileFilterBar extends ConsumerWidget {
  const _MobileFilterBar({required this.meta});
  final DriverDeliveriesListMeta? meta;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final palette = MaterialsUiPalette.of(context);
    final filter = ref.watch(driverAvailableJobsFilterProvider);
    final anyDistance = filter.maxDistanceKm == null;
    final radiusKm = anyDistance
        ? null
        : radiusKmForStepIndex(radiusStepIndex(filter.maxDistanceKm));

    final chips = <_FilterChipData>[
      if (filter.city != null)
        _FilterChipData(
          label: filter.city!,
          onDeleted: () => ref
              .read(driverAvailableJobsFilterProvider.notifier)
              .setCity(null),
        ),
      if (filter.area != null)
        _FilterChipData(
          label: filter.area!,
          onDeleted: () => ref
              .read(driverAvailableJobsFilterProvider.notifier)
              .setArea(null),
        ),
      if (anyDistance)
        _FilterChipData(
          label: l10n.driverAnyDistance,
          onDeleted:
              null, // opens sheet via Edit filters — distance needs location context
          opensSheet: true,
        )
      else
        _FilterChipData(
          label: l10n.driverWithinKm(radiusKm!.round()),
          onDeleted: () => ref
              .read(driverAvailableJobsFilterProvider.notifier)
              .setAnyDistance(),
        ),
      if (filter.sortBy.isNotEmpty)
        _FilterChipData(
          label: driverJobsSortChipLabel(l10n, filter.sortBy),
          onDeleted: null,
          opensSheet: true,
        ),
    ];

    return Row(
      children: [
        Expanded(
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                for (final chip in chips) ...[
                  Chip(
                    label: Text(
                      chip.label,
                      style: AppTextStyles.label(
                        context,
                      ).copyWith(fontSize: 12),
                    ),
                    onDeleted: chip.onDeleted,
                    visualDensity: VisualDensity.compact,
                    materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                  ),
                  const SizedBox(width: 4),
                ],
              ],
            ),
          ),
        ),
        TextButton.icon(
          key: const ValueKey('driver-edit-filters'),
          onPressed: () => _showFilterSheet(context, ref),
          icon: const Icon(Icons.tune_rounded, size: 18),
          label: Text(l10n.driverEditFilters),
          style: TextButton.styleFrom(
            foregroundColor: palette.mint,
            visualDensity: VisualDensity.compact,
          ),
        ),
      ],
    );
  }

  void _showFilterSheet(BuildContext context, WidgetRef ref) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (sheetCtx) => DraggableScrollableSheet(
        initialChildSize: 0.7,
        maxChildSize: 0.92,
        minChildSize: 0.4,
        expand: false,
        builder: (context, scrollController) =>
            _FilterSheetContent(meta: meta, scrollController: scrollController),
      ),
    );
  }
}

class _FilterSheetContent extends ConsumerWidget {
  const _FilterSheetContent({
    required this.meta,
    required this.scrollController,
  });
  final DriverDeliveriesListMeta? meta;
  final ScrollController scrollController;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final palette = MaterialsUiPalette.of(context);
    final formatters = LocalizedFormatters(l10n);
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

    return ListView(
      controller: scrollController,
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      children: [
        Center(
          child: Container(
            width: 40,
            height: 4,
            margin: const EdgeInsets.only(bottom: AppSpacing.md),
            decoration: BoxDecoration(
              color: palette.borderSubtle,
              borderRadius: AppRadius.pillAll,
            ),
          ),
        ),
        Text(l10n.driverEditFilters, style: AppTextStyles.title(context)),
        const SizedBox(height: AppSpacing.lg),

        // City
        Text(
          l10n.driverCityLabel,
          style: AppTextStyles.label(
            context,
          ).copyWith(color: palette.textMuted),
        ),
        const SizedBox(height: AppSpacing.sm),
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: [
            FilterChip(
              label: Text(l10n.driverAllCities),
              selected: filter.city == null,
              showCheckmark: true,
              onSelected: (_) => notifier.setCity(null),
            ),
            if (profileCity != null)
              FilterChip(
                label: BidiText(profileCity),
                selected:
                    filter.city?.toLowerCase() == profileCity.toLowerCase(),
                showCheckmark: true,
                onSelected: (_) => notifier.setCity(profileCity),
              ),
          ],
        ),
        const SizedBox(height: AppSpacing.lg),

        // Area
        Text(
          l10n.driverAreaLabel,
          style: AppTextStyles.label(
            context,
          ).copyWith(color: palette.textMuted),
        ),
        const SizedBox(height: AppSpacing.sm),
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: [
            FilterChip(
              label: Text(l10n.driverAllAreas),
              selected: filter.area == null,
              showCheckmark: true,
              onSelected: (_) => notifier.setArea(null),
            ),
            if (profileArea != null)
              FilterChip(
                label: BidiText(profileArea),
                selected:
                    filter.area?.toLowerCase() == profileArea.toLowerCase(),
                showCheckmark: true,
                onSelected: (_) => notifier.setArea(profileArea),
              ),
          ],
        ),
        const SizedBox(height: AppSpacing.lg),

        // Radius
        Text(
          searchRadiusLabel(
            anyDistance: anyDistance,
            radiusKm: radiusKm,
            l10n: l10n,
          ),
          style: AppTextStyles.label(context),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          l10n.driverDistanceToPickupHint,
          style: AppTextStyles.body(
            context,
          ).copyWith(color: palette.textSecondary, fontSize: 12),
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
                ? l10n.driverAnyDistance
                : l10n.driverWithinKm(radiusKm.round()),
            onChanged: !radiusEnabled
                ? null
                : (value) =>
                      notifier.setRadiusKm(radiusKmForStepIndex(value.round())),
          ),
        ),
        _RadiusMarks(
          steps: DriverJobsFilterConstants.radiusStepsKm,
          activeIndex: anyDistance ? null : radiusIndex,
          muted: anyDistance,
          formatters: formatters,
        ),
        const SizedBox(height: AppSpacing.sm),
        FilterChip(
          avatar: anyDistance
              ? Icon(Icons.check_circle, size: 16, color: palette.mint)
              : null,
          label: Text(l10n.driverAnyDistance),
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
        const SizedBox(height: AppSpacing.lg),

        // Sort
        Text(
          l10n.driverSort,
          style: AppTextStyles.label(
            context,
          ).copyWith(color: palette.textMuted),
        ),
        const SizedBox(height: AppSpacing.sm),
        SegmentedButton<String>(
          segments: [
            ButtonSegment(value: 'nearest', label: Text(l10n.driverNearest)),
            ButtonSegment(value: 'newest', label: Text(l10n.driverNewest)),
          ],
          selected: {
            filter.sortBy.isNotEmpty
                ? filter.sortBy
                : (meta?.driverHasRecentLocation == true
                      ? 'nearest'
                      : 'newest'),
          },
          onSelectionChanged: (selection) =>
              notifier.setSortBy(selection.first),
        ),
        const SizedBox(height: AppSpacing.lg),

        Row(
          children: [
            Expanded(
              child: TextButton(
                onPressed: meta == null
                    ? null
                    : () => notifier.resetToProfileDefaults(meta!),
                style: AppStatusButtonStyle.text(
                  context,
                  AppStatusTone.neutral,
                ),
                child: Text(l10n.driverResetFilters),
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: FilledButton(
                key: const ValueKey('driver-filter-done'),
                onPressed: () => Navigator.of(context).pop(),
                child: Text(l10n.driverDone),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _DesktopFilters extends ConsumerWidget {
  const _DesktopFilters({required this.meta});
  final DriverDeliveriesListMeta? meta;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = MaterialsUiPalette.of(context);
    final l10n = context.l10n;
    final formatters = LocalizedFormatters(l10n);
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

    return Container(
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
                flex: 3,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      searchRadiusLabel(
                        anyDistance: anyDistance,
                        radiusKm: radiusKm,
                        l10n: l10n,
                      ),
                      style: AppTextStyles.label(context),
                    ),
                    SliderTheme(
                      data: SliderTheme.of(context).copyWith(
                        trackHeight: 3,
                        thumbShape: const RoundSliderThumbShape(
                          enabledThumbRadius: 7,
                        ),
                        overlayShape: const RoundSliderOverlayShape(
                          overlayRadius: 14,
                        ),
                        inactiveTrackColor: anyDistance
                            ? palette.borderSubtle.withValues(alpha: 0.5)
                            : null,
                      ),
                      child: Slider(
                        value: radiusIndex.toDouble(),
                        min: 0,
                        max:
                            (DriverJobsFilterConstants.radiusStepsKm.length - 1)
                                .toDouble(),
                        divisions:
                            DriverJobsFilterConstants.radiusStepsKm.length - 1,
                        label: anyDistance
                            ? l10n.driverAnyDistance
                            : l10n.driverWithinKm(radiusKm.round()),
                        onChanged: !radiusEnabled
                            ? null
                            : (value) => notifier.setRadiusKm(
                                radiusKmForStepIndex(value.round()),
                              ),
                      ),
                    ),
                    _RadiusMarks(
                      steps: DriverJobsFilterConstants.radiusStepsKm,
                      activeIndex: anyDistance ? null : radiusIndex,
                      muted: anyDistance,
                      formatters: formatters,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.lg),
              Expanded(
                flex: 2,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      l10n.driverSort,
                      style: AppTextStyles.label(
                        context,
                      ).copyWith(color: palette.textMuted),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    SegmentedButton<String>(
                      segments: [
                        ButtonSegment(
                          value: 'nearest',
                          label: Text(l10n.driverNearest),
                        ),
                        ButtonSegment(
                          value: 'newest',
                          label: Text(l10n.driverNewest),
                        ),
                      ],
                      selected: {
                        filter.sortBy.isNotEmpty
                            ? filter.sortBy
                            : (meta?.driverHasRecentLocation == true
                                  ? 'nearest'
                                  : 'newest'),
                      },
                      onSelectionChanged: (selection) =>
                          notifier.setSortBy(selection.first),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Text(
                l10n.driverCityLabel,
                style: AppTextStyles.label(
                  context,
                ).copyWith(color: palette.textMuted),
              ),
              FilterChip(
                label: Text(l10n.driverAllCities),
                selected: filter.city == null,
                showCheckmark: true,
                onSelected: (_) => notifier.setCity(null),
              ),
              if (profileCity != null)
                FilterChip(
                  label: BidiText(profileCity),
                  selected:
                      filter.city?.toLowerCase() == profileCity.toLowerCase(),
                  showCheckmark: true,
                  onSelected: (_) => notifier.setCity(profileCity),
                ),
              Text(
                l10n.driverAreaLabel,
                style: AppTextStyles.label(
                  context,
                ).copyWith(color: palette.textMuted),
              ),
              FilterChip(
                label: Text(l10n.driverAllAreas),
                selected: filter.area == null,
                showCheckmark: true,
                onSelected: (_) => notifier.setArea(null),
              ),
              if (profileArea != null)
                FilterChip(
                  label: BidiText(profileArea),
                  selected:
                      filter.area?.toLowerCase() == profileArea.toLowerCase(),
                  showCheckmark: true,
                  onSelected: (_) => notifier.setArea(profileArea),
                ),
              FilterChip(
                avatar: anyDistance
                    ? Icon(Icons.check_circle, size: 16, color: palette.mint)
                    : null,
                label: Text(l10n.driverAnyDistance),
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
                style: AppStatusButtonStyle.text(
                  context,
                  AppStatusTone.neutral,
                ),
                child: Text(l10n.driverResetFilters),
              ),
              if (!radiusEnabled)
                Text(
                  l10n.driverLocationNeeded,
                  style: AppTextStyles.body(
                    context,
                  ).copyWith(color: palette.textSecondary, fontSize: 12),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Shared filter / header widgets
// ---------------------------------------------------------------------------

enum _DriverJobsBlocker { paused, inactive, suspended, unknownStatus }

_DriverJobsBlocker? _resolveJobsBlocker(
  DriverOperationalProfile? profile,
  DriverDeliveriesListMeta? meta,
) {
  final status = profile?.status ?? meta?.status;
  if (status == DriverProfileStatus.inactive) {
    return _DriverJobsBlocker.inactive;
  }
  if (status == DriverProfileStatus.suspended) {
    return _DriverJobsBlocker.suspended;
  }
  if (status == DriverProfileStatus.unknown && profile != null) {
    return _DriverJobsBlocker.unknownStatus;
  }
  final accepting = profile?.acceptingNewJobs ?? meta?.acceptingNewJobs;
  if (status == DriverProfileStatus.active && accepting == false) {
    return _DriverJobsBlocker.paused;
  }
  if (profile == null && meta?.canBrowseAvailableJobs == false) {
    return _DriverJobsBlocker.paused;
  }
  return null;
}

class _DriverJobsBlockedState extends StatelessWidget {
  const _DriverJobsBlockedState({
    required this.blocker,
    required this.isUpdating,
    this.onResume,
  });

  final _DriverJobsBlocker blocker;
  final bool isUpdating;
  final VoidCallback? onResume;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final (icon, title, subtitle) = switch (blocker) {
      _DriverJobsBlocker.paused => (
        Icons.pause_circle_outline_rounded,
        l10n.driverJobsPausedTitle,
        l10n.driverJobsPausedExplanation,
      ),
      _DriverJobsBlocker.inactive => (
        Icons.person_off_outlined,
        l10n.driverJobsInactiveTitle,
        l10n.driverProfileInactiveExplanation,
      ),
      _DriverJobsBlocker.suspended => (
        Icons.gpp_bad_outlined,
        l10n.driverJobsSuspendedTitle,
        l10n.driverProfileSuspendedExplanation,
      ),
      _DriverJobsBlocker.unknownStatus => (
        Icons.help_outline_rounded,
        l10n.driverJobsUnavailableTitle,
        l10n.driverProfileUnknownExplanation,
      ),
    };
    final operationalAccessAvailable = blocker == _DriverJobsBlocker.paused;

    return AppEmptyStateCard(
      key: const ValueKey('driver-jobs-blocked-state'),
      icon: icon,
      title: title,
      subtitle: operationalAccessAvailable
          ? '$subtitle\n${l10n.driverAssignedDeliveriesContinue}'
          : subtitle,
      actions: [
        if (onResume != null)
          FilledButton.icon(
            key: const ValueKey('driver-resume-new-jobs'),
            onPressed: isUpdating ? null : onResume,
            icon: isUpdating
                ? const SizedBox.square(
                    dimension: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.play_circle_outline_rounded),
            label: Text(l10n.driverResumeNewJobs),
          ),
        if (operationalAccessAvailable)
          OutlinedButton.icon(
            key: const ValueKey('driver-open-active-deliveries'),
            onPressed: () => context.go('/driver/active'),
            icon: const Icon(Icons.local_shipping_outlined),
            label: Text(l10n.driverMyActiveDeliveries),
          ),
      ],
    );
  }
}

double _driverJobsBottomPadding(BuildContext context) {
  final isCompactMobile = MediaQuery.sizeOf(context).width < 820;
  if (!isCompactMobile) return AppSpacing.xl;
  return kBottomNavigationBarHeight +
      MediaQuery.paddingOf(context).bottom +
      AppSpacing.lg;
}

String? _areaChipLabel(DriverDeliveriesListMeta? meta) {
  if (meta == null) return null;
  final area = meta.driverProfileArea?.trim();
  final city = meta.driverProfileCity?.trim();
  if (area != null && area.isNotEmpty) return area;
  if (city != null && city.isNotEmpty) return city;
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
    final l10n = context.l10n;
    final showTotal =
        nearbyCount != null &&
        totalAvailableCount != null &&
        totalAvailableCount != nearbyCount;

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
          Text(
            l10n.driverJobsTitle,
            style: AppTextStyles.display(
              context,
            ).copyWith(color: palette.textPrimary),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            l10n.driverJobsSubtitle,
            style: AppTextStyles.body(
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
                label: l10n.driverActiveDeliveriesCount(activeCount, maxActive),
              ),
              _StatChip(
                icon: Icons.near_me_outlined,
                label: nearbyCount == null
                    ? l10n.driverAvailableJobsCountLoading
                    : l10n.driverAvailableJobsCount(nearbyCount!),
              ),
              if (showTotal)
                _StatChip(
                  icon: Icons.inventory_2_outlined,
                  label: l10n.driverTotalAvailable(totalAvailableCount!),
                ),
              if (areaLabel != null)
                _StatChip(
                  icon: Icons.place_outlined,
                  label: l10n.driverAreaChip(areaLabel!),
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
          Icon(icon, size: 14, color: palette.mint),
          const SizedBox(width: 4),
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTextStyles.label(
                context,
              ).copyWith(color: palette.textSecondary, fontSize: 12),
            ),
          ),
        ],
      ),
    );
  }
}

class _RadiusMarks extends StatelessWidget {
  const _RadiusMarks({
    required this.steps,
    required this.activeIndex,
    required this.muted,
    required this.formatters,
  });

  final List<double> steps;
  final int? activeIndex;
  final bool muted;
  final LocalizedFormatters formatters;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    return Row(
      children: [
        for (var index = 0; index < steps.length; index++)
          Expanded(
            child: Text(
              formatters.distanceKilometers(
                steps[index].round(),
                decimalDigits: 0,
              ),
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTextStyles.label(context).copyWith(
                color: muted
                    ? palette.textMuted
                    : activeIndex == index
                    ? palette.mint
                    : palette.textSecondary,
                fontSize: 11,
                fontWeight: activeIndex == index
                    ? FontWeight.w700
                    : FontWeight.w500,
              ),
            ),
          ),
      ],
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
    final l10n = context.l10n;
    return AppEmptyStateCard(
      icon: Icons.local_shipping_outlined,
      title: copy.title,
      subtitle: copy.subtitle,
      compact: true,
      actions: [
        if (onIncreaseRadius != null)
          FilledButton(
            onPressed: onIncreaseRadius,
            style: AppStatusButtonStyle.filled(context, AppStatusTone.primary),
            child: Text(l10n.driverIncreaseRadius),
          ),
        if (onShowAnyDistance != null)
          OutlinedButton(
            onPressed: onShowAnyDistance,
            style: AppStatusButtonStyle.outlined(
              context,
              AppStatusTone.neutral,
            ),
            child: Text(l10n.driverShowAnyDistance),
          ),
        if (onReset != null)
          TextButton(
            onPressed: onReset,
            style: AppStatusButtonStyle.text(context, AppStatusTone.neutral),
            child: Text(l10n.driverResetFilters),
          ),
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
    final l10n = context.l10n;
    final actionState = ref.watch(driverDeliveryActionControllerProvider);
    final isSubmitting = actionState.isLoading;
    final labels = DriverUiLabels(l10n);
    final pickupSummary = _locationRouteLabel(
      city: delivery.pickupCity ?? delivery.pickupLocation.city,
      area: delivery.pickupArea ?? delivery.pickupLocation.area,
      fallback: labels.locationSummary(delivery.pickupLocation.safeSummary),
    );
    final dropoffSummary = _locationRouteLabel(
      city: delivery.dropoffCity ?? delivery.dropoffLocation.city,
      area: delivery.dropoffArea ?? delivery.dropoffLocation.area,
      fallback: labels.locationSummary(delivery.dropoffLocation.safeSummary),
    );
    final distanceText = distanceFromYouLabel(delivery.distanceKm, l10n: l10n);

    final itemStyle = AppTextStyles.body(
      context,
    ).copyWith(color: palette.textSecondary);
    final acceptButton = FilledButton.icon(
      onPressed: acceptDisabled || isSubmitting
          ? null
          : () => _acceptDelivery(context, ref),
      style: AppStatusButtonStyle.filled(context, AppStatusTone.success),
      icon: isSubmitting
          ? const SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          : const Icon(Icons.assignment_turned_in_outlined),
      label: Text(
        acceptDisabled
            ? l10n.driverActiveLimitReachedButton
            : isSubmitting
            ? l10n.driverAccepting
            : l10n.driverAcceptJob,
      ),
    );

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: palette.cardSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderStrong),
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final isNarrow = constraints.maxWidth < 520;
          final sectionGap = isNarrow ? AppSpacing.sm : AppSpacing.md;
          final metaChips = [
            _InfoChip(
              icon: Icons.schedule_outlined,
              label: driverPickupWindowSummary(delivery, l10n: l10n),
              expanded: isNarrow,
            ),
            _InfoChip(
              icon: Icons.near_me_outlined,
              label: distanceText,
              expanded: isNarrow,
            ),
            if (delivery.hasGroupedItems)
              _InfoChip(
                icon: Icons.inventory_2_outlined,
                label: labels.groupedItemsCount(delivery.itemCount),
                expanded: isNarrow,
              ),
          ];

          return Column(
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
                      style: AppTextStyles.title(
                        context,
                      ).copyWith(color: palette.textPrimary),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  AppStatusBadge(
                    label: l10n.driverStatusWaitingForAssignment,
                    tone: AppStatusTone.warning,
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.xs),
              if (delivery.hasGroupedItems) ...[
                Text(
                  labels.groupedItemsCount(delivery.itemCount),
                  style: itemStyle,
                ),
                const SizedBox(height: 2),
                for (final item in delivery.items) ...[
                  BidiText(
                    '${bidiIsolate(labels.materialTitle(item.title))} × ${bidiIsolate(driverQuantityLabel(l10n, item.quantity, item.unit))}',
                    style: itemStyle,
                  ),
                  const SizedBox(height: 2),
                ],
              ] else
                Text(
                  driverQuantityLabel(
                    l10n,
                    delivery.material.quantityRequested,
                    delivery.material.unit,
                  ),
                  style: itemStyle,
                ),
              SizedBox(height: sectionGap),
              DriverRouteBlock(
                pickupSummary: pickupSummary,
                dropoffSummary: dropoffSummary,
                compact: true,
                forceVertical: isNarrow,
              ),
              SizedBox(height: sectionGap),
              if (isNarrow)
                Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    for (var i = 0; i < metaChips.length; i++) ...[
                      if (i > 0) const SizedBox(height: AppSpacing.xs),
                      metaChips[i],
                    ],
                  ],
                )
              else
                Wrap(
                  spacing: AppSpacing.md,
                  runSpacing: AppSpacing.sm,
                  children: metaChips,
                ),
              SizedBox(height: sectionGap),
              if (isNarrow)
                acceptButton
              else
                Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: acceptButton,
                ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _acceptDelivery(BuildContext context, WidgetRef ref) async {
    final l10n = context.l10n;
    try {
      final assigned = await ref
          .read(driverDeliveryActionControllerProvider.notifier)
          .acceptDelivery(delivery.id);
      if (!context.mounted) return;
      showInfoSnackBar(context, l10n.driverDeliveryAccepted);
      context.push('/driver/deliveries/${assigned.id}');
    } on ApiException catch (error) {
      refreshDriverJobs(ref);
      if (!context.mounted) return;
      final message = _driverAcceptConflictMessage(error, l10n);
      showInfoSnackBar(context, message);
    } catch (error) {
      if (!context.mounted) return;
      showErrorSnackBar(context, error);
    }
  }
}

class _InfoChip extends StatelessWidget {
  const _InfoChip({
    required this.icon,
    required this.label,
    this.expanded = false,
  });
  final IconData icon;
  final String label;
  final bool expanded;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    return Row(
      mainAxisSize: expanded ? MainAxisSize.max : MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: palette.textMuted),
        const SizedBox(width: 4),
        Flexible(
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppTextStyles.body(
              context,
            ).copyWith(color: palette.textSecondary, fontSize: 12),
          ),
        ),
      ],
    );
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

String _driverAcceptConflictMessage(ApiException error, AppLocalizations l10n) {
  if (error.code == 'DRIVER_ACTIVE_LIMIT_REACHED') {
    return l10n.driverReachedActiveLimit;
  }
  if (error.code == 'DELIVERY_NOT_AVAILABLE') {
    return l10n.driverDeliveryNoLongerAvailable;
  }
  return localizedApiErrorMessage(error, l10n);
}

class _StatePanel extends StatelessWidget {
  const _StatePanel({
    required this.icon,
    required this.title,
    required this.subtitle,
    this.actionLabel,
    this.onAction,
    this.compact = false,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final String? actionLabel;
  final VoidCallback? onAction;
  final bool compact;

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
