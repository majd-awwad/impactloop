import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/l10n/driver_status_labels.dart';
import '../../../../shared/l10n/driver_ui_labels.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../application/driver_deliveries_provider.dart';
import '../../application/driver_profile_provider.dart';
import '../../data/models/driver_delivery.dart';
import '../driver_delivery_timing_presentation.dart';
import '../widgets/driver_asset_image.dart';
import '../widgets/driver_availability_summary_card.dart';
import '../widgets/driver_page_header.dart';
import '../widgets/driver_route_block.dart';

class DriverDashboardPage extends ConsumerWidget {
  const DriverDashboardPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final active = ref.watch(activeDriverDeliveriesProvider);
    final available = ref.watch(availableDriverDeliveriesProvider);
    final profile = ref.watch(driverProfileProvider);
    final activeResult = active.value;
    final availableResult = available.value;

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(activeDriverDeliveriesProvider);
        ref.invalidate(availableDriverDeliveriesProvider);
        ref.invalidate(driverProfileProvider);
        await Future.wait([
          ref.read(activeDriverDeliveriesProvider.future),
          ref.read(availableDriverDeliveriesProvider.future),
          ref.read(driverProfileProvider.future),
        ]);
      },
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: EdgeInsetsDirectional.fromSTEB(
          AppSpacing.md,
          AppSpacing.lg,
          AppSpacing.md,
          _dashboardBottomPadding(context),
        ),
        children: [
          Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 1120),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  DriverPageHeader(
                    title: l10n.driverPortal,
                    subtitle: l10n.driverJobsSubtitle,
                    maxWidth: 1120,
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  profile.when(
                    loading: () => Center(
                      child: Padding(
                        padding: const EdgeInsets.all(AppSpacing.lg),
                        child: Semantics(
                          label: l10n.driverLoadingActive,
                          child: const CircularProgressIndicator(),
                        ),
                      ),
                    ),
                    error: (error, _) => _DashboardNotice(
                      text: localizedApiErrorMessage(error, l10n),
                      onRetry: () => ref.invalidate(driverProfileProvider),
                    ),
                    data: (state) => DriverAvailabilitySummaryCard(
                      profile: state.profile,
                      isMutating: state.isMutating,
                      isUpdatingAvailability: state.isUpdatingAvailability,
                      compact: true,
                      heroAssetPath: DriverAssetPaths.readyVan,
                      onPreferenceChanged: (value) async {
                        if (!await confirmDriverAvailabilityPreference(
                              context,
                              value,
                            ) ||
                            !context.mounted) {
                          return;
                        }
                        final changed = await ref
                            .read(driverProfileProvider.notifier)
                            .setAcceptingNewJobs(value);
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
                      },
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  LayoutBuilder(
                    builder: (context, constraints) {
                      final stack = constraints.maxWidth < 620;
                      final cards = [
                        _DashboardMetric(
                          icon: Icons.local_shipping_outlined,
                          label: l10n.driverMyActiveDeliveries,
                          value: activeResult == null
                              ? '…'
                              : '${activeResult.meta.activeDeliveryCount}/${activeResult.meta.maxActiveDeliveries}',
                          onTap: () => context.go('/driver/active'),
                        ),
                        _DashboardMetric(
                          icon: Icons.work_outline_rounded,
                          label: l10n.driverAvailableNearbyJobs,
                          value: availableResult == null
                              ? '…'
                              : '${availableResult.meta.nearbyAvailableCount ?? availableResult.deliveries.length}',
                          onTap: () => context.go('/driver/jobs'),
                        ),
                      ];
                      if (stack) {
                        return Column(
                          children: [
                            cards.first,
                            const SizedBox(height: AppSpacing.sm),
                            cards.last,
                          ],
                        );
                      }
                      return Row(
                        children: [
                          Expanded(child: cards.first),
                          const SizedBox(width: AppSpacing.md),
                          Expanded(child: cards.last),
                        ],
                      );
                    },
                  ),
                  const SizedBox(height: AppSpacing.md),
                  _CompactMapCard(),
                  const SizedBox(height: AppSpacing.md),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          l10n.driverMyActiveDeliveries,
                          style: AppTextStyles.title(context).copyWith(
                            color: MaterialsUiPalette.of(context).textPrimary,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      if (activeResult?.deliveries.isNotEmpty ?? false)
                        TextButton(
                          onPressed: () => context.go('/driver/active'),
                          child: Text(l10n.driverOpenDelivery),
                        ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  if (active.isLoading && activeResult == null)
                    const Center(
                      child: Padding(
                        padding: EdgeInsets.all(AppSpacing.lg),
                        child: CircularProgressIndicator(),
                      ),
                    )
                  else if (active.hasError && activeResult == null)
                    _DashboardNotice(
                      text: l10n.driverCouldNotLoadActive,
                      onRetry: () =>
                          ref.invalidate(activeDriverDeliveriesProvider),
                    )
                  else if (activeResult?.deliveries.isEmpty ?? true)
                    _EmptyActivePreview()
                  else
                    _ActiveDeliveryPreview(
                      delivery: activeResult!.deliveries.first,
                    ),
                  if (active.isRefreshing || available.isRefreshing) ...[
                    const SizedBox(height: AppSpacing.md),
                    const LinearProgressIndicator(),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ActiveDeliveryPreview extends StatelessWidget {
  const _ActiveDeliveryPreview({required this.delivery});
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
          Text(
            driverDeliveryStatusLabel(delivery.status, l10n),
            style: AppTextStyles.label(
              context,
            ).copyWith(color: palette.textPrimary, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: AppSpacing.xs),
          Row(
            children: [
              Icon(
                Directionality.of(context) == TextDirection.rtl
                    ? Icons.arrow_back_rounded
                    : Icons.arrow_forward_rounded,
                size: 16,
                color: palette.mint,
              ),
              const SizedBox(width: AppSpacing.xs),
              Expanded(
                child: Text(
                  l10n.driverNextAction(guidance.actionLabel),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.body(
                    context,
                  ).copyWith(color: palette.textPrimary),
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
          const SizedBox(height: AppSpacing.md),
          FilledButton(
            onPressed: () => context.push('/driver/deliveries/${delivery.id}'),
            child: Text(l10n.driverOpenDelivery),
          ),
        ],
      ),
    );
  }
}

class _EmptyActivePreview extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final palette = MaterialsUiPalette.of(context);
    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: palette.cardSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Column(
        children: [
          DriverAssetImage(
            assetPath: DriverAssetPaths.emptyDeliveries,
            height: 80,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            l10n.driverEmptyActiveTitle,
            style: AppTextStyles.title(
              context,
            ).copyWith(color: palette.textPrimary),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            l10n.driverEmptyActiveBody,
            style: AppTextStyles.body(
              context,
            ).copyWith(color: palette.textSecondary),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: AppSpacing.md),
          FilledButton(
            onPressed: () => context.go('/driver/jobs'),
            child: Text(l10n.driverEmptyActiveCta),
          ),
        ],
      ),
    );
  }
}

class _CompactMapCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final palette = MaterialsUiPalette.of(context);
    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: palette.cardSurfaceAlt,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Row(
        children: [
          DriverAssetImage(
            assetPath: DriverAssetPaths.locationMap,
            height: 56,
            width: 56,
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Text(
              l10n.driverMapSectionTitle,
              style: AppTextStyles.label(
                context,
              ).copyWith(color: palette.textPrimary),
            ),
          ),
        ],
      ),
    );
  }
}

class _DashboardMetric extends StatelessWidget {
  const _DashboardMetric({
    required this.icon,
    required this.label,
    required this.value,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final String value;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    return Semantics(
      button: true,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadius.lgAll,
        child: Container(
          padding: const EdgeInsetsDirectional.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: palette.cardSurface,
            borderRadius: AppRadius.lgAll,
            border: Border.all(color: palette.borderStrong),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, color: palette.mint, size: 22),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      value,
                      style: AppTextStyles.title(
                        context,
                      ).copyWith(color: palette.textPrimary),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      label,
                      style: AppTextStyles.label(context).copyWith(
                        color: palette.textSecondary,
                        fontWeight: FontWeight.w500,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DashboardNotice extends StatelessWidget {
  const _DashboardNotice({required this.text, this.onRetry});

  final String text;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: palette.cardSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Row(
        children: [
          Expanded(child: Text(text)),
          if (onRetry != null)
            IconButton(
              onPressed: onRetry,
              tooltip: context.l10n.retry,
              icon: const Icon(Icons.refresh_rounded),
            ),
        ],
      ),
    );
  }
}

String _locationLabel({String? city, String? area, required String fallback}) {
  final parts = [area, city]
      .where((p) => p != null && p.trim().isNotEmpty)
      .cast<String>()
      .toList(growable: false);
  return parts.isEmpty ? fallback : parts.join(', ');
}

double _dashboardBottomPadding(BuildContext context) =>
    MediaQuery.sizeOf(context).width < 820
    ? kBottomNavigationBarHeight +
          MediaQuery.paddingOf(context).bottom +
          AppSpacing.lg
    : AppSpacing.xl;
