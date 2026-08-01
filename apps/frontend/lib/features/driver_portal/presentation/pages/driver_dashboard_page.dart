import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../application/driver_deliveries_provider.dart';
import '../widgets/driver_active_delivery_card.dart';

class DriverDashboardPage extends ConsumerWidget {
  const DriverDashboardPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final active = ref.watch(activeDriverDeliveriesProvider);
    final available = ref.watch(availableDriverDeliveriesProvider);
    final activeResult = active.value;
    final availableResult = available.value;

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(activeDriverDeliveriesProvider);
        ref.invalidate(availableDriverDeliveriesProvider);
        await Future.wait([
          ref.read(activeDriverDeliveriesProvider.future),
          ref.read(availableDriverDeliveriesProvider.future),
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
              constraints: const BoxConstraints(maxWidth: 1180),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    l10n.driverPortal,
                    style: AppTextStyles.display(context),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    l10n.driverJobsSubtitle,
                    style: AppTextStyles.body(context),
                  ),
                  const SizedBox(height: AppSpacing.lg),
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
                            const SizedBox(height: AppSpacing.md),
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
                  const SizedBox(height: AppSpacing.lg),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          l10n.driverMyActiveDeliveries,
                          style: AppTextStyles.title(context),
                        ),
                      ),
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
                        padding: EdgeInsets.all(AppSpacing.xl),
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
                    _DashboardNotice(text: l10n.driverNoActiveDeliveriesHint)
                  else
                    DriverActiveDeliveryCard(
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
          padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
          decoration: BoxDecoration(
            color: palette.cardSurface,
            borderRadius: AppRadius.lgAll,
            border: Border.all(color: palette.borderStrong),
          ),
          child: Row(
            children: [
              Icon(icon, color: palette.mint),
              const SizedBox(width: AppSpacing.md),
              Expanded(child: Text(label, style: AppTextStyles.label(context))),
              Text(value, style: AppTextStyles.title(context)),
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
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
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

double _dashboardBottomPadding(BuildContext context) =>
    MediaQuery.sizeOf(context).width < 820
    ? kBottomNavigationBarHeight +
          MediaQuery.paddingOf(context).bottom +
          AppSpacing.lg
    : AppSpacing.xl;
