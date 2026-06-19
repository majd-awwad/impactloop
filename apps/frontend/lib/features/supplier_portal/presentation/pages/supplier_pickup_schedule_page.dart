import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_colors.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';
import '../../data/models/supplier_pickup_schedule_item.dart';
import '../../data/pickup_schedule_grouping.dart';
import '../controllers/supplier_pickup_schedule_providers.dart';
import '../widgets/pickup_schedule_card.dart';
import '../widgets/pickup_schedule_date_section.dart';
import '../widgets/pickup_schedule_details_dialog.dart';
import '../widgets/pickup_schedule_filter_chips.dart';

const _contentMaxWidth = 960.0;

class SupplierPickupSchedulePage extends ConsumerWidget {
  const SupplierPickupSchedulePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final filter = ref.watch(pickupScheduleFilterProvider);
    final scheduleAsync = ref.watch(pickupScheduleProvider);
    final summaryAsync = ref.watch(pickupScheduleSummaryProvider);
    final compact =
        MediaQuery.sizeOf(context).width < AppSpacing.supplierLayoutBreakpoint;

    return Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: _contentMaxWidth),
        child: SingleChildScrollView(
          padding: EdgeInsets.fromLTRB(
            compact ? AppSpacing.md : AppSpacing.lg,
            compact ? AppSpacing.sm : AppSpacing.md,
            compact ? AppSpacing.md : AppSpacing.lg,
            compact ? AppSpacing.md : AppSpacing.lg,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              summaryAsync.when(
                data: (summary) => PickupScheduleSummaryRow(summary: summary),
                loading: () => const SizedBox(height: 20),
                error: (_, _) => const SizedBox.shrink(),
              ),
              const SizedBox(height: AppSpacing.sm),
              const PickupScheduleFilterChips(),
              const SizedBox(height: AppSpacing.md),
              scheduleAsync.when(
                data: (items) {
                  if (items.isEmpty) {
                    return _EmptyState(message: filter.emptyMessage);
                  }

                  final groups = groupPickupScheduleItems(items, filter);
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      for (var i = 0; i < groups.length; i++) ...[
                        if (i > 0) const SizedBox(height: AppSpacing.md),
                        PickupScheduleDateSection(
                          group: groups[i],
                          itemBuilder: (item) => PickupScheduleCard(
                            item: item,
                            groupKind: groups[i].kind,
                            onViewDetails: () => PickupScheduleDetailsDialog.show(
                              context,
                              item: item,
                              groupKind: groups[i].kind,
                            ),
                          ),
                        ),
                      ],
                    ],
                  );
                },
                loading: () => const _LoadingState(),
                error: (_, _) => _ErrorState(
                  onRetry: () {
                    ref.invalidate(pickupScheduleProvider);
                    ref.invalidate(pickupScheduleSummaryProvider);
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.lg),
      child: Center(
        child: Text(
          message,
          textAlign: TextAlign.center,
          style: AuthDarkTextStyles.body(context).copyWith(
            color: AuthDarkColors.textMuted,
          ),
        ),
      ),
    );
  }
}

class _LoadingState extends StatelessWidget {
  const _LoadingState();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.lg),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const SizedBox(
            width: 18,
            height: 18,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
          const SizedBox(width: AppSpacing.sm),
          Text(
            'Loading pickup schedule…',
            style: AuthDarkTextStyles.body(context).copyWith(
              color: AuthDarkColors.textMuted,
              fontSize: 14,
            ),
          ),
        ],
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.lg),
      child: Column(
        children: [
          Text(
            'We could not load pickup schedule.',
            textAlign: TextAlign.center,
            style: AuthDarkTextStyles.body(context).copyWith(
              color: AuthDarkColors.textMuted,
            ),
          ),
          TextButton(
            onPressed: onRetry,
            child: const Text('Try again'),
          ),
        ],
      ),
    );
  }
}
