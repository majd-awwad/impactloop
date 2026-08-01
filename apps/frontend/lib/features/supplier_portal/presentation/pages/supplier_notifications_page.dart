import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../data/models/supplier_action_notification.dart';
import '../controllers/supplier_notifications_providers.dart';
import '../theme/supplier_theme_extension.dart';
import '../widgets/supplier_feedback.dart';
import '../widgets/supplier_notification_card.dart';
import '../widgets/supplier_notification_filter_chips.dart';

const _contentMaxWidth = 960.0;

class SupplierNotificationsPage extends ConsumerStatefulWidget {
  const SupplierNotificationsPage({super.key});

  @override
  ConsumerState<SupplierNotificationsPage> createState() =>
      _SupplierNotificationsPageState();
}

class _SupplierNotificationsPageState
    extends ConsumerState<SupplierNotificationsPage> {
  @override
  void initState() {
    super.initState();
  }

  @override
  Widget build(BuildContext context) {
    final filter = ref.watch(supplierNotificationFilterProvider);
    final query = const SupplierNotificationsQuery().forFilter(filter);
    final notificationsAsync = ref.watch(supplierNotificationsProvider(query));
    final compact =
        MediaQuery.sizeOf(context).width < AppSpacing.supplierLayoutBreakpoint;
    final l = context.s;
    final colors = context.supplierColors;

    return Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: _contentMaxWidth),
        child: SingleChildScrollView(
          padding: EdgeInsetsDirectional.fromSTEB(
            compact ? AppSpacing.md : AppSpacing.lg,
            compact ? AppSpacing.sm : AppSpacing.md,
            compact ? AppSpacing.md : AppSpacing.lg,
            compact ? AppSpacing.md : AppSpacing.lg,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                l.notificationsTitle,
                style: context.supplierSectionTitle().copyWith(
                  fontSize: 18,
                  color: colors.textPrimary,
                ),
              ),
              Align(
                alignment: AlignmentDirectional.centerEnd,
                child: TextButton(
                  onPressed: () => _markAllRead(context, ref, query),
                  child: Text(l.t('Mark all as read', 'وضع الكل كمقروء')),
                ),
              ),
              const SizedBox(height: 4),
              Text(
                l.subtitleNotifications,
                style: context.supplierBody().copyWith(
                  color: colors.textMuted,
                  fontSize: 14,
                ),
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
                  final filtered = result.items;

                  if (filtered.isEmpty) {
                    return _EmptyState(filter: filter);
                  }

                  return Column(
                    children: [
                      for (var i = 0; i < filtered.length; i++) ...[
                        if (i > 0) const SizedBox(height: AppSpacing.sm),
                        SupplierNotificationCard(
                          notification: filtered[i],
                          onAction: !filtered[i].action.canNavigate
                              ? null
                              : () => _handleAction(
                                  context,
                                  ref,
                                  filtered[i],
                                  query,
                                ),
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
    SupplierNotificationsQuery query,
  ) {
    () async {
      try {
        await markSupplierNotificationRead(ref, notification, query: query);
        if (!context.mounted) return;
        final l = context.s;
        final route = notification.destinationRoute;
        if (route == null) {
          showSupplierInfoSnackBar(context, l.noActionAvailable);
          return;
        }
        context.push(route);
      } catch (_) {
        if (context.mounted) {
          showSupplierErrorSnackBar(context, context.s.notificationsLoadError);
        }
      }
    }();
  }

  void _markAllRead(
    BuildContext context,
    WidgetRef ref,
    SupplierNotificationsQuery query,
  ) {
    () async {
      try {
        await markAllSupplierNotificationsRead(ref, query: query);
      } catch (_) {
        if (context.mounted) {
          showSupplierErrorSnackBar(context, context.s.notificationsLoadError);
        }
      }
    }();
  }
}

class _SummaryRow extends StatelessWidget {
  const _SummaryRow({required this.summary});

  final SupplierNotificationsSummary summary;

  @override
  Widget build(BuildContext context) {
    final l = context.s;
    final colors = context.supplierColors;

    return Wrap(
      spacing: AppSpacing.md,
      runSpacing: AppSpacing.xs,
      children: [
        _SummaryItem(
          label: l.actionNeeded,
          count: summary.canonicalNeedsAction,
          color: colors.amberAccent,
        ),
        _SummaryItem(
          label: l.filterReservations,
          count: summary.canonicalReservations,
          color: colors.blueAccent,
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
    final colors = context.supplierColors;

    return Text.rich(
      TextSpan(
        style: context.supplierBody().copyWith(
          fontSize: 13,
          color: colors.textMuted,
        ),
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
    final l = context.s;
    final colors = context.supplierColors;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.lg),
      child: Center(
        child: Text(
          filter == SupplierNotificationFilter.all
              ? l.noNotificationsYet
              : l.noFilterNotifications(l.notificationFilterLabel(filter)),
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
          SizedBox(
            width: 18,
            height: 18,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: colors.accent,
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Text(
            context.s.loadingNotifications,
            style: context.supplierBody().copyWith(color: colors.textMuted),
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
            l.notificationsLoadError,
            style: context.supplierBody().copyWith(color: colors.textMuted),
          ),
          TextButton(onPressed: onRetry, child: Text(l.tryAgain)),
        ],
      ),
    );
  }
}
