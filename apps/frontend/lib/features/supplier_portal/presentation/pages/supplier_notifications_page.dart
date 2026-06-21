import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_colors.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';
import '../../data/models/supplier_action_notification.dart';
import '../controllers/supplier_notifications_providers.dart';
import '../widgets/supplier_feedback.dart';
import '../widgets/supplier_notification_card.dart';
import '../widgets/supplier_notification_filter_chips.dart';

const _contentMaxWidth = 960.0;

class SupplierNotificationsPage extends ConsumerWidget {
  const SupplierNotificationsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final filter = ref.watch(supplierNotificationFilterProvider);
    final notificationsAsync = ref.watch(supplierNotificationsProvider);
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
              Text(
                'Notifications',
                style: AuthDarkTextStyles.sectionTitle(context),
              ),
              const SizedBox(height: 4),
              Text(
                'Review updates and actions that need your attention.',
                style: AuthDarkTextStyles.body(
                  context,
                ).copyWith(color: AuthDarkColors.textMuted, fontSize: 14),
              ),
              const SizedBox(height: AppSpacing.md),
              notificationsAsync.when(
                data: (result) => _SummaryRow(summary: result.summary),
                loading: () => const SizedBox.shrink(),
                error: (_, _) => const SizedBox.shrink(),
              ),
              const SizedBox(height: AppSpacing.sm),
              const SupplierNotificationFilterChips(),
              const SizedBox(height: AppSpacing.md),
              notificationsAsync.when(
                data: (result) {
                  final filtered = result.notifications
                      .where(
                        (item) =>
                            matchesSupplierNotificationFilter(item, filter),
                      )
                      .toList();

                  if (filtered.isEmpty) {
                    return _EmptyState(filter: filter);
                  }

                  return Column(
                    children: [
                      for (var i = 0; i < filtered.length; i++) ...[
                        if (i > 0) const SizedBox(height: AppSpacing.sm),
                        SupplierNotificationCard(
                          notification: filtered[i],
                          onAction:
                              filtered[i].actionLabel == null ||
                                  filtered[i].isCompleted
                              ? null
                              : () => _handleAction(context, ref, filtered[i]),
                        ),
                      ],
                    ],
                  );
                },
                loading: () => const _LoadingState(),
                error: (_, _) => _ErrorState(
                  onRetry: () => ref.invalidate(supplierNotificationsProvider),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _handleAction(
    BuildContext context,
    WidgetRef ref,
    SupplierActionNotification notification,
  ) {
    switch (notification.actionType) {
      case SupplierActionNotificationActionType.continueListing:
        if (notification.priceRuleRequestId != null) {
          context.go(
            '/supplier/materials/new?priceRuleRequestId=${notification.priceRuleRequestId}',
          );
          return;
        }
        if (notification.categoryRequestId != null) {
          context.go(
            '/supplier/materials/new?categoryRequestId=${notification.categoryRequestId}',
          );
          return;
        }
        showSupplierErrorSnackBar(
          context,
          'Could not open listing. Try again from Notifications.',
        );
        return;
      case SupplierActionNotificationActionType.editListing:
        final id = notification.categoryRequestId;
        if (id == null) return;
        context.go('/supplier/materials/new?categoryRequestId=$id');
        return;
      case SupplierActionNotificationActionType.editPrice:
        final id = notification.priceRuleRequestId;
        if (id == null) return;
        context.go('/supplier/materials/new?priceRuleRequestId=$id');
        return;
      case SupplierActionNotificationActionType.reviewRequest:
        final id = notification.reservationId;
        final query = id == null ? 'tab=pending' : 'tab=pending&focus=$id';
        context.go('/supplier/reservations?$query');
        return;
      case null:
        showSupplierInfoSnackBar(context, 'No action available for this item.');
    }
  }
}

class _SummaryRow extends StatelessWidget {
  const _SummaryRow({required this.summary});

  final SupplierNotificationsSummary summary;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: AppSpacing.md,
      runSpacing: AppSpacing.xs,
      children: [
        _SummaryItem(
          label: 'Action needed',
          count: summary.actionNeededCount,
          color: const Color(0xFFF59E0B),
        ),
        _SummaryItem(
          label: 'Review updates',
          count: summary.reviewCount,
          color: const Color(0xFF2DD4BF),
        ),
        _SummaryItem(
          label: 'Reservations',
          count: summary.reservationCount,
          color: const Color(0xFF60A5FA),
        ),
      ],
    );
  }
}

class _SummaryItem extends StatelessWidget {
  const _SummaryItem({
    required this.label,
    required this.count,
    required this.color,
  });

  final String label;
  final int count;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Text.rich(
      TextSpan(
        style: AuthDarkTextStyles.body(
          context,
        ).copyWith(fontSize: 13, color: AuthDarkColors.textMuted),
        children: [
          TextSpan(
            text: '$label: ',
            style: const TextStyle(fontWeight: FontWeight.w500),
          ),
          TextSpan(
            text: '$count',
            style: TextStyle(color: color, fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.filter});

  final SupplierNotificationFilter filter;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.lg),
      child: Center(
        child: Text(
          filter == SupplierNotificationFilter.all
              ? 'No notifications yet.'
              : 'No ${filter.label.toLowerCase()} notifications.',
          textAlign: TextAlign.center,
          style: AuthDarkTextStyles.body(
            context,
          ).copyWith(color: AuthDarkColors.textMuted),
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
            'Loading notifications…',
            style: AuthDarkTextStyles.body(
              context,
            ).copyWith(color: AuthDarkColors.textMuted),
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
            'We could not load notifications.',
            style: AuthDarkTextStyles.body(
              context,
            ).copyWith(color: AuthDarkColors.textMuted),
          ),
          TextButton(onPressed: onRetry, child: const Text('Try again')),
        ],
      ),
    );
  }
}
