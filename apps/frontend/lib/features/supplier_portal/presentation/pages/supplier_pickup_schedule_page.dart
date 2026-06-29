import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/errors/api_exception.dart';
import '../../data/models/supplier_pickup_schedule_item.dart';
import '../../data/pickup_schedule_grouping.dart';
import '../controllers/supplier_pickup_schedule_providers.dart';
import '../controllers/supplier_requests_providers.dart';
import '../theme/supplier_theme_extension.dart';
import '../widgets/complete_pickup_dialog.dart';
import '../widgets/pickup_schedule_card.dart';
import '../widgets/pickup_schedule_date_section.dart';
import '../widgets/pickup_schedule_details_dialog.dart';
import '../widgets/pickup_schedule_filter_chips.dart';
import '../widgets/supplier_feedback.dart';

const _contentMaxWidth = 960.0;
const _deliveryHandledCompleteMessage =
    'This reservation is handled by delivery. The driver will mark it completed.';

bool _isDeliveryCompleteConflict(Object error) {
  return error is ApiException &&
      error.statusCode == 409 &&
      error.message.toLowerCase().contains('self-pickup');
}

Future<void> _handleCompletePickup(
  BuildContext context,
  WidgetRef ref,
  SupplierPickupScheduleItem item,
) async {
  final confirmed = await CompletePickupDialog.show(context);
  if (confirmed != true || !context.mounted) {
    return;
  }

  ref.read(completingReservationIdProvider.notifier).setCompleting(item.id);
  try {
    await completeIncomingRequest(ref, requestId: item.id);
    if (!context.mounted) return;
    showSupplierInfoSnackBar(context, context.s.pickupCompleted);
  } catch (error) {
    if (!context.mounted) return;
    showSupplierErrorSnackBar(
      context,
      _isDeliveryCompleteConflict(error)
          ? _deliveryHandledCompleteMessage
          : context.s.pickupCompleteFailed,
    );
  } finally {
    ref.read(completingReservationIdProvider.notifier).setCompleting(null);
  }
}

class SupplierPickupSchedulePage extends ConsumerWidget {
  const SupplierPickupSchedulePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final filter = ref.watch(pickupScheduleFilterProvider);
    final scheduleAsync = ref.watch(pickupScheduleProvider);
    final summaryAsync = ref.watch(pickupScheduleSummaryProvider);
    final completingId = ref.watch(completingReservationIdProvider);
    final compact =
        MediaQuery.sizeOf(context).width < AppSpacing.supplierLayoutBreakpoint;
    final l = context.s;

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
                    return _EmptyState(
                      message: l.pickupScheduleEmptyMessage(filter),
                    );
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
                            isCompleting: completingId == item.id,
                            onViewDetails: () =>
                                PickupScheduleDetailsDialog.show(
                                  context,
                                  item: item,
                                  groupKind: groups[i].kind,
                                ),
                            onMarkCompleted:
                                item.status ==
                                        SupplierPickupScheduleStatus.accepted &&
                                    item.canSupplierComplete
                                ? () =>
                                      _handleCompletePickup(context, ref, item)
                                : null,
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
    final colors = context.supplierColors;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.lg),
      child: Center(
        child: Text(
          message,
          textAlign: TextAlign.center,
          style: context.supplierBody().copyWith(color: colors.textMuted),
        ),
      ),
    );
  }
}

class _LoadingState extends StatelessWidget {
  const _LoadingState();

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;

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
            context.s.loadingPickupSchedule,
            style: context.supplierBody().copyWith(
              color: colors.textMuted,
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
    final l = context.s;
    final colors = context.supplierColors;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.lg),
      child: Column(
        children: [
          Text(
            l.pickupScheduleLoadError,
            textAlign: TextAlign.center,
            style: context.supplierBody().copyWith(color: colors.textMuted),
          ),
          TextButton(onPressed: onRetry, child: Text(l.tryAgain)),
        ],
      ),
    );
  }
}
