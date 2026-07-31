import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/widgets/entry_nav_bar.dart';
import '../../../../core/format/localized_formatters.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../../shared/widgets/notification_bell_button.dart';
import '../../../auth/application/auth_controller.dart';
import '../../../auth/data/models/user.dart';
import '../../application/notification_display.dart';
import '../../application/notifications_provider.dart';
import '../../data/models/app_notification.dart';
import '../notification_visual_presentation.dart';

class UserNotificationsPage extends ConsumerWidget {
  const UserNotificationsPage({super.key, this.embeddedInShell = false});

  final bool embeddedInShell;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;
    final homeRoute = _homeRouteForUser(user);
    final body = _NotificationsBody(
      user: user,
      embeddedInShell: embeddedInShell,
    );

    if (embeddedInShell) {
      return body;
    }

    final palette = MaterialsUiPalette.of(context);
    final hidePublicNav =
        user?.isDriverMode == true || user?.isSupplierMode == true;

    return Scaffold(
      backgroundColor: palette.pageBackground,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            EntryNavBar(
              showSignIn: false,
              showCreateAccount: false,
              homeRoute: homeRoute,
              showPublicNavLinks: !hidePublicNav,
              trailingActions: const [NotificationBellButton(compact: true)],
            ),
            Expanded(child: body),
          ],
        ),
      ),
    );
  }

  String _homeRouteForUser(User? user) {
    if (user == null) {
      return '/home';
    }
    if (user.isDriverMode && user.hasRole('DRIVER')) {
      return '/driver/jobs';
    }
    if (user.isSupplierMode && user.hasRole('SUPPLIER')) {
      return '/supplier/dashboard';
    }
    return '/home';
  }
}

class _NotificationsBody extends ConsumerWidget {
  const _NotificationsBody({required this.user, required this.embeddedInShell});

  final User? user;
  final bool embeddedInShell;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final listAsync = ref.watch(notificationsListProvider);
    final selectedFilter = ref.watch(notificationReadFilterProvider);
    final isCompactMobile = MediaQuery.sizeOf(context).width < 820;
    final bottomPadding = embeddedInShell && isCompactMobile
        ? kBottomNavigationBarHeight +
              MediaQuery.paddingOf(context).bottom +
              AppSpacing.lg
        : AppSpacing.xl;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsetsDirectional.fromSTEB(
            AppSpacing.md,
            AppSpacing.lg,
            AppSpacing.md,
            0,
          ),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 1120),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _NotificationsHeaderCard(
                    listAsync: listAsync,
                    onMarkAllRead: () => markAllNotificationsRead(ref),
                    onRefresh: () => refreshNotifications(ref),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  _NotificationFilterBar(
                    selected: selectedFilter,
                    onSelected: (filter) =>
                        setNotificationReadFilter(ref, filter),
                  ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        Expanded(
          child: listAsync.when(
            skipLoadingOnReload: true,
            loading: () => Center(
              child: _NotificationsStateCard(
                icon: Icons.hourglass_top_outlined,
                title: l10n.notificationsLoading,
                subtitle: l10n.notificationsLoadingSubtitle,
              ),
            ),
            error: (error, _) {
              if (isAuthPendingNotificationError(error) ||
                  isCancelledNotificationError(error)) {
                return Center(
                  child: _NotificationsStateCard(
                    icon: Icons.hourglass_top_outlined,
                    title: l10n.notificationsLoading,
                    subtitle: l10n.notificationsLoadingSubtitle,
                  ),
                );
              }

              return Center(
                child: _NotificationsStateCard(
                  icon: Icons.cloud_off_outlined,
                  title: l10n.notificationsLoadError,
                  subtitle: kDebugMode && l10n.localeName == 'en'
                      ? '$error'
                      : l10n.tryAgain,
                  actionLabel: l10n.retry,
                  onAction: () => refreshNotifications(ref),
                ),
              );
            },
            data: (state) {
              if (state.items.isEmpty) {
                final empty = _emptyCopyForFilter(selectedFilter, l10n);
                return Center(
                  child: _NotificationsStateCard(
                    icon: Icons.notifications_none_outlined,
                    title: empty.title,
                    subtitle: empty.subtitle,
                  ),
                );
              }

              return Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 1120),
                  child: _NotificationsListView(
                    state: state,
                    bottomPadding: bottomPadding,
                    onOpen: (notification) =>
                        _handleOpen(context, ref, notification),
                    onLoadMore: () =>
                        ref.read(notificationsListProvider.notifier).loadMore(),
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  ({String title, String subtitle}) _emptyCopyForFilter(
    NotificationReadFilter filter,
    AppLocalizations l10n,
  ) {
    switch (filter) {
      case NotificationReadFilter.unread:
        return (title: l10n.noUnreadNotifications, subtitle: l10n.allCaughtUp);
      case NotificationReadFilter.read:
        return (
          title: l10n.noReadNotifications,
          subtitle: l10n.openedNotificationsAppearHere,
        );
      case NotificationReadFilter.all:
        return (
          title: l10n.noNotifications,
          subtitle: l10n.notificationsAppearHere,
        );
    }
  }

  Future<void> _handleOpen(
    BuildContext context,
    WidgetRef ref,
    AppNotification notification,
  ) async {
    if (!notification.isRead) {
      if (ref.exists(notificationsListProvider)) {
        await markNotificationRead(ref, notification.id);
      } else {
        await markNotificationReadWithoutList(ref, notification.id);
      }
    }

    if (!context.mounted) {
      return;
    }

    final currentUser = ref.read(authControllerProvider).user;

    if (notification.relatedEntityType == 'RESERVATION' &&
        notification.relatedEntityId != null &&
        notification.relatedEntityId!.isNotEmpty) {
      final reservationId = notification.relatedEntityId!;

      if (currentUser?.isSupplierMode == true &&
          currentUser?.hasRole('SUPPLIER') == true) {
        context.push('/supplier/reservations?tab=pending&focus=$reservationId');
        return;
      }

      context.push('/learner/reservations/$reservationId');
      return;
    }

    if (notification.relatedEntityType == 'DELIVERY' &&
        notification.relatedEntityId != null &&
        notification.relatedEntityId!.isNotEmpty) {
      if (currentUser?.isDriverMode == true &&
          currentUser?.hasRole('DRIVER') == true) {
        final route = driverDeliveryNotificationRoute(notification);
        if (route != null) {
          context.go(route);
        }
        return;
      }
    }

    if (notification.relatedEntityType == 'LEARNING_PROJECT' &&
        notification.relatedEntityId != null &&
        notification.relatedEntityId!.isNotEmpty) {
      context.push('/learning/submissions/${notification.relatedEntityId}');
    }
  }
}

class _NotificationsListView extends StatelessWidget {
  const _NotificationsListView({
    required this.state,
    required this.bottomPadding,
    required this.onOpen,
    required this.onLoadMore,
  });

  final NotificationsListState state;
  final double bottomPadding;
  final ValueChanged<AppNotification> onOpen;
  final VoidCallback onLoadMore;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final palette = MaterialsUiPalette.of(context);
    final footerCount = (state.hasMore ? 1 : 0) + (state.total > 0 ? 1 : 0);

    return ListView.separated(
      padding: EdgeInsetsDirectional.fromSTEB(
        AppSpacing.md,
        0,
        AppSpacing.md,
        bottomPadding,
      ),
      itemCount: state.items.length + footerCount,
      separatorBuilder: (context, index) {
        if (index >= state.items.length - 1) {
          return const SizedBox.shrink();
        }
        return const SizedBox(height: AppSpacing.sm);
      },
      itemBuilder: (context, index) {
        if (index < state.items.length) {
          return _NotificationTile(
            notification: state.items[index],
            onOpen: () => onOpen(state.items[index]),
          );
        }

        var footerIndex = index - state.items.length;

        if (state.hasMore) {
          if (footerIndex == 0) {
            return Center(
              child: state.isLoadingMore
                  ? const Padding(
                      padding: EdgeInsets.all(AppSpacing.md),
                      child: SizedBox(
                        width: 24,
                        height: 24,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                    )
                  : OutlinedButton.icon(
                      onPressed: onLoadMore,
                      style: AppStatusButtonStyle.outlined(
                        context,
                        AppStatusTone.neutral,
                      ),
                      icon: const Icon(Icons.expand_more_rounded),
                      label: Text(l10n.loadMore),
                    ),
            );
          }
          footerIndex -= 1;
        }

        return Text(
          l10n.notificationCount(state.items.length, state.total),
          textAlign: TextAlign.center,
          style: AppTextStyles.label(
            context,
          ).copyWith(color: palette.textMuted),
        );
      },
    );
  }
}

class _NotificationFilterBar extends StatelessWidget {
  const _NotificationFilterBar({
    required this.selected,
    required this.onSelected,
  });

  final NotificationReadFilter selected;
  final ValueChanged<NotificationReadFilter> onSelected;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return SegmentedButton<NotificationReadFilter>(
      segments: [
        ButtonSegment(
          value: NotificationReadFilter.all,
          label: Text(l10n.filterAll),
        ),
        ButtonSegment(
          value: NotificationReadFilter.unread,
          label: Text(l10n.filterUnread),
        ),
        ButtonSegment(
          value: NotificationReadFilter.read,
          label: Text(l10n.filterRead),
        ),
      ],
      selected: {selected},
      onSelectionChanged: (selection) => onSelected(selection.first),
    );
  }
}

class _NotificationsHeaderCard extends StatelessWidget {
  const _NotificationsHeaderCard({
    required this.listAsync,
    required this.onMarkAllRead,
    required this.onRefresh,
  });

  final AsyncValue<NotificationsListState> listAsync;
  final VoidCallback onMarkAllRead;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final palette = MaterialsUiPalette.of(context);
    final unreadCount = listAsync.maybeWhen(
      data: (state) => state.unreadCount,
      orElse: () => 0,
    );

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: palette.cardSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderStrong),
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final title = Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                l10n.notificationsTitle,
                style: AppTextStyles.display(
                  context,
                ).copyWith(color: palette.textPrimary),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                l10n.notificationsSubtitle,
                style: AppTextStyles.body(
                  context,
                ).copyWith(color: palette.textSecondary),
              ),
            ],
          );
          final actions = Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              IconButton(
                tooltip: l10n.refresh,
                onPressed: onRefresh,
                style: AppStatusButtonStyle.text(context, AppStatusTone.info),
                icon: const Icon(Icons.refresh_rounded),
              ),
              if (unreadCount > 0)
                FilledButton(
                  onPressed: onMarkAllRead,
                  style: AppStatusButtonStyle.filled(
                    context,
                    AppStatusTone.info,
                  ),
                  child: Text(l10n.markAllRead),
                ),
            ],
          );

          if (constraints.maxWidth < 640) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                title,
                const SizedBox(height: AppSpacing.md),
                Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: actions,
                ),
              ],
            );
          }

          return Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: title),
              const SizedBox(width: AppSpacing.md),
              actions,
            ],
          );
        },
      ),
    );
  }
}

class _NotificationsStateCard extends StatelessWidget {
  const _NotificationsStateCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    this.actionLabel,
    this.onAction,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Container(
      width: double.infinity,
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: palette.cardSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderStrong),
      ),
      child: Column(
        children: [
          Icon(icon, size: 40, color: palette.mint),
          const SizedBox(height: AppSpacing.md),
          Text(
            title,
            textAlign: TextAlign.center,
            style: AppTextStyles.title(
              context,
            ).copyWith(color: palette.textPrimary),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            subtitle,
            textAlign: TextAlign.center,
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

class _NotificationTile extends StatelessWidget {
  const _NotificationTile({required this.notification, required this.onOpen});

  final AppNotification notification;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final l10n = context.l10n;
    final category = categoryForNotification(notification);
    final chipLabel = notificationTypeChipLabel(category, l10n: l10n);
    final actionLabel = notificationActionLabel(notification, l10n: l10n);
    final copy = localizedNotificationCopy(notification, l10n);
    final hasTarget = notificationHasNavigationTarget(notification);
    final tone = notificationVisualTone(category);
    final accent = AppStatusStyle.of(context, tone).foreground;

    return Material(
      color: notification.isRead ? palette.panelSurface : palette.inputSurface,
      borderRadius: AppRadius.mdAll,
      child: InkWell(
        onTap: onOpen,
        borderRadius: AppRadius.mdAll,
        child: Container(
          decoration: BoxDecoration(
            borderRadius: AppRadius.mdAll,
            border: Border.all(
              color: notification.isRead
                  ? palette.borderSubtle
                  : palette.borderStrong,
            ),
          ),
          padding: const EdgeInsetsDirectional.all(AppSpacing.md),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: accent.withValues(alpha: 0.12),
                  borderRadius: AppRadius.mdAll,
                  border: Border.all(color: accent.withValues(alpha: 0.35)),
                ),
                child: Icon(
                  _iconForNotification(notification),
                  size: 20,
                  color: accent,
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Wrap(
                      spacing: AppSpacing.xs,
                      runSpacing: AppSpacing.xs,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        AppStatusBadge(label: chipLabel, tone: tone),
                        if (!notification.isRead)
                          Container(
                            width: 8,
                            height: 8,
                            decoration: BoxDecoration(
                              color: palette.mint,
                              shape: BoxShape.circle,
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      copy.title,
                      style: AppTextStyles.title(context).copyWith(
                        color: palette.textPrimary,
                        fontWeight: notification.isRead
                            ? FontWeight.w600
                            : FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      copy.body,
                      style: AppTextStyles.body(
                        context,
                      ).copyWith(color: palette.textSecondary),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Wrap(
                      spacing: AppSpacing.sm,
                      runSpacing: AppSpacing.xs,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Text(
                          LocalizedFormatters(
                            l10n,
                          ).relativeTime(notification.createdAt),
                          style: AppTextStyles.label(
                            context,
                          ).copyWith(color: palette.textMuted),
                        ),
                        if (hasTarget)
                          Text(
                            actionLabel,
                            style: AppTextStyles.label(context).copyWith(
                              color: palette.mint,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                      ],
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

  IconData _iconForNotification(AppNotification notification) {
    switch (notification.notificationType) {
      case 'DRIVER_NEW_JOB':
        return Icons.local_shipping_outlined;
      case 'DRIVER_DELIVERY_REQUEST_CREATED':
        return Icons.local_shipping_outlined;
      case 'DRIVER_DELIVERY_ACCEPTED':
      case 'DRIVER_DELIVERY_NEXT_STEP':
      case 'DRIVER_DELIVERY_MOVED_TO_ADMIN_REVIEW':
        return Icons.admin_panel_settings_outlined;
      case 'DRIVER_PICKUP_TIME':
      case 'DRIVER_PICKUP_REMINDER':
      case 'DRIVER_PICKUP_STARTING_SOON':
      case 'DRIVER_PICKUP_WINDOW_STARTED':
      case 'DRIVER_PICKUP_OVERDUE':
        return Icons.schedule_outlined;
      case 'DRIVER_DROPOFF_TIME':
      case 'DRIVER_DROPOFF_REMINDER':
      case 'DRIVER_DROPOFF_STARTING_SOON':
      case 'DRIVER_DROPOFF_WINDOW_STARTED':
      case 'DRIVER_DROPOFF_OVERDUE':
        return Icons.place_outlined;
      default:
        return Icons.notifications_none_outlined;
    }
  }
}
