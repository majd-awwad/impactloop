import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/widgets/app_empty_state_card.dart';
import '../../application/driver_deliveries_provider.dart';
import '../widgets/driver_active_delivery_card.dart';

class DriverActiveDeliveriesPage extends ConsumerWidget {
  const DriverActiveDeliveriesPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final deliveriesAsync = ref.watch(activeDriverDeliveriesProvider);

    return RefreshIndicator(
      onRefresh: () => ref.refresh(activeDriverDeliveriesProvider.future),
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: EdgeInsetsDirectional.fromSTEB(
          AppSpacing.md,
          AppSpacing.lg,
          AppSpacing.md,
          _bottomPadding(context),
        ),
        children: [
          Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 1120),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    l10n.driverMyActiveDeliveries,
                    style: AppTextStyles.display(context),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  deliveriesAsync.when(
                    skipLoadingOnReload: true,
                    loading: () => const Center(
                      child: Padding(
                        padding: EdgeInsets.all(AppSpacing.xl),
                        child: CircularProgressIndicator(),
                      ),
                    ),
                    error: (error, _) => AppEmptyStateCard(
                      icon: Icons.cloud_off_outlined,
                      title: l10n.driverCouldNotLoadActive,
                      subtitle: kDebugMode ? '$error' : l10n.tryAgain,
                      actions: [
                        FilledButton(
                          onPressed: () =>
                              ref.invalidate(activeDriverDeliveriesProvider),
                          child: Text(l10n.retry),
                        ),
                      ],
                    ),
                    data: (result) {
                      if (result.deliveries.isEmpty) {
                        return AppEmptyStateCard(
                          icon: Icons.local_shipping_outlined,
                          title: l10n.driverNoActiveDeliveries,
                          subtitle: l10n.driverNoActiveDeliveriesHint,
                        );
                      }

                      return LayoutBuilder(
                        builder: (context, constraints) {
                          final columns = constraints.maxWidth >= 920 ? 2 : 1;
                          final width = columns == 1
                              ? constraints.maxWidth
                              : (constraints.maxWidth - AppSpacing.md) / 2;
                          return Wrap(
                            spacing: AppSpacing.md,
                            runSpacing: AppSpacing.md,
                            children: [
                              for (final delivery in result.deliveries)
                                SizedBox(
                                  width: width,
                                  child: DriverActiveDeliveryCard(
                                    delivery: delivery,
                                  ),
                                ),
                            ],
                          );
                        },
                      );
                    },
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

double _bottomPadding(BuildContext context) =>
    MediaQuery.sizeOf(context).width < 820
    ? kBottomNavigationBarHeight +
          MediaQuery.paddingOf(context).bottom +
          AppSpacing.lg
    : AppSpacing.xl;
