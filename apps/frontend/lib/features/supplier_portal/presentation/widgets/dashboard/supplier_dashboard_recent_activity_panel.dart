import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../../app/theme/app_radius.dart';
import '../../../../../app/theme/app_spacing.dart';
import '../../../data/models/supplier_dashboard_activity.dart';
import '../../../data/models/supplier_dashboard_pickup.dart';
import '../../../data/models/supplier_dashboard_stats.dart';
import '../../theme/supplier_theme_extension.dart';
import 'supplier_dashboard_colors.dart';

class SupplierDashboardRecentActivityPanel extends StatelessWidget {
  const SupplierDashboardRecentActivityPanel({
    super.key,
    required this.activity,
    required this.upcomingPickups,
    required this.stats,
  });

  static const _maxItems = 3;

  final List<SupplierDashboardActivity> activity;
  final List<SupplierDashboardPickup> upcomingPickups;
  final SupplierDashboardStats stats;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    final items = _buildCuratedItems(context);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: context.supplierDecorations.dashboardCard,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(context.s.recentActivity, style: context.supplierSectionTitle()),
          const SizedBox(height: AppSpacing.xs),
          Text(
            context.s.recentActivitySubtitle,
            style: context.supplierBody().copyWith(
              color: colors.textSecondary,
              fontSize: 13,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          if (items.isEmpty)
            const _EmptyActivityState()
          else
            ...items.map(
              (item) => Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                child: _ActivityTile(item: item),
              ),
            ),
          const SizedBox(height: AppSpacing.sm),
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              onPressed: () => context.push(_footerRoute),
              icon: Icon(
                _footerRoute == '/supplier/reservations'
                    ? Icons.inbox_outlined
                    : Icons.history_rounded,
                size: 16,
              ),
              label: Text(_footerLabel(context)),
              style: TextButton.styleFrom(
                foregroundColor: colors.accent,
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.sm,
                  vertical: AppSpacing.xs,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  String get _footerRoute {
    if (stats.reservations.pending > 0) {
      return '/supplier/reservations';
    }
    if (upcomingPickups.isNotEmpty) {
      return '/supplier/pickup-schedule';
    }
    return '/supplier/reservations';
  }

  String _footerLabel(BuildContext context) {
    if (stats.reservations.pending > 0) {
      return context.s.reviewRequests;
    }
    return context.s.viewAllActivity;
  }

  List<_CuratedActivityItem> _buildCuratedItems(BuildContext context) {
    final items = <_CuratedActivityItem>[];

    if (stats.reservations.pending > 0) {
      final pendingActivity = _findActivity(
        predicate: (item) =>
            item.type.toUpperCase() == 'RESERVATION' && _looksPending(item),
      );

      items.add(
        _CuratedActivityItem(
          icon: Icons.inbox_outlined,
          title: pendingActivity?.title ?? context.s.recentActivityPendingTitle,
          body:
              pendingActivity?.body ??
              context.s.pendingRequestsNeedResponse(stats.reservations.pending),
          accent: SupplierDashboardColors.pending,
          chip: context.s.tabPending,
          timestamp: pendingActivity?.createdAt,
        ),
      );
    }

    if (upcomingPickups.isNotEmpty && items.length < _maxItems) {
      final pickup = upcomingPickups.first;
      items.add(
        _CuratedActivityItem(
          icon: Icons.local_shipping_outlined,
          title: context.s.recentActivityNextPickup,
          body: pickup.materialTitle.isNotEmpty
              ? '${pickup.materialTitle} · ${pickup.requesterName}'
              : context.s.recentActivityAcceptedPickup(pickup.requesterName),
          accent: SupplierDashboardColors.accepted,
          chip: context.s.pickupChip,
          timestamp: pickup.pickupWindowStart,
        ),
      );
    }

    if (items.length < _maxItems) {
      final completedActivity = _findActivity(
        predicate: (item) => _looksCompleted(item),
      );

      if (completedActivity != null) {
        items.add(
          _CuratedActivityItem(
            icon: Icons.check_circle_outline,
            title: completedActivity.title,
            body: completedActivity.body,
            accent: SupplierDashboardColors.completed,
            chip: context.s.tabCompleted,
            timestamp: completedActivity.createdAt,
          ),
        );
      } else if (stats.reservations.completed > 0) {
        items.add(
          _CuratedActivityItem(
            icon: Icons.recycling_outlined,
            title: context.s.recentActivityLatestReuse,
            body: context.s.completedReservationsSummary(
              stats.reservations.completed,
            ),
            accent: SupplierDashboardColors.reused,
            chip: context.s.tabCompleted,
          ),
        );
      }
    }

    return items.take(_maxItems).toList();
  }

  SupplierDashboardActivity? _findActivity({
    required bool Function(SupplierDashboardActivity item) predicate,
  }) {
    for (final item in activity) {
      if (predicate(item)) {
        return item;
      }
    }
    return null;
  }

  bool _looksPending(SupplierDashboardActivity item) {
    final text = '${item.title} ${item.body}'.toLowerCase();
    return text.contains('pending') ||
        text.contains('waiting') ||
        text.contains('request');
  }

  bool _looksCompleted(SupplierDashboardActivity item) {
    final text = '${item.title} ${item.body}'.toLowerCase();
    return text.contains('completed') ||
        text.contains('reused') ||
        text.contains('picked up');
  }
}

class _CuratedActivityItem {
  const _CuratedActivityItem({
    required this.icon,
    required this.title,
    required this.body,
    required this.accent,
    this.chip,
    this.timestamp,
  });

  final IconData icon;
  final String title;
  final String body;
  final Color accent;
  final String? chip;
  final DateTime? timestamp;
}

class _ActivityTile extends StatelessWidget {
  const _ActivityTile({required this.item});

  final _CuratedActivityItem item;

  String? get _timeLabel {
    final timestamp = item.timestamp;
    if (timestamp == null || timestamp.millisecondsSinceEpoch == 0) {
      return null;
    }

    final now = DateTime.now();
    final diff = now.difference(timestamp);
    if (diff.inDays == 0) {
      final hour = timestamp.hour % 12 == 0 ? 12 : timestamp.hour % 12;
      final minute = timestamp.minute.toString().padLeft(2, '0');
      final period = timestamp.hour >= 12 ? 'PM' : 'AM';
      return '$hour:$minute $period';
    }
    if (diff.inDays < 7) {
      const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      return weekdays[timestamp.weekday - 1];
    }
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return '${months[timestamp.month - 1]} ${timestamp.day}';
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: colors.backgroundElevated.withValues(alpha: 0.38),
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: colors.border.withValues(alpha: 0.22)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Container(
            width: 32,
            height: 32,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: item.accent.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(item.icon, color: item.accent, size: 17),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        item.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: context.supplierLabel().copyWith(
                          color: colors.textPrimary,
                          fontWeight: FontWeight.w600,
                          fontSize: 13,
                        ),
                      ),
                    ),
                    if (item.chip != null) ...[
                      const SizedBox(width: AppSpacing.xs),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 7,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: item.accent.withValues(alpha: 0.14),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          item.chip!,
                          style: context.supplierChip().copyWith(
                            color: item.accent,
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  item.body,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: context.supplierBody().copyWith(
                    fontSize: 12,
                    color: colors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          if (_timeLabel != null) ...[
            const SizedBox(width: AppSpacing.xs),
            Text(
              _timeLabel!,
              style: context.supplierBody().copyWith(
                fontSize: 10,
                color: colors.textMuted,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _EmptyActivityState extends StatelessWidget {
  const _EmptyActivityState();

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.lg,
        vertical: AppSpacing.lg,
      ),
      decoration: BoxDecoration(
        color: colors.backgroundElevated.withValues(alpha: 0.4),
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: colors.border.withValues(alpha: 0.22)),
      ),
      child: Row(
        children: [
          Icon(
            Icons.auto_graph_outlined,
            color: SupplierDashboardColors.neutral,
            size: 28,
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Text(
              'Activity will appear as learners request and collect your materials.',
              style: context.supplierBody().copyWith(
                color: colors.textSecondary,
                fontSize: 13,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
