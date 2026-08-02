import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/navigation_extensions.dart';
import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/widgets/entry_nav_bar.dart';
import '../../../../core/format/localized_formatters.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../auth/application/auth_controller.dart';
import '../../../auth/data/models/user.dart';
import '../../application/notification_display.dart';
import '../../application/notifications_provider.dart';
import '../../data/models/app_notification.dart';
import '../notification_visual_presentation.dart';
import '../notification_visuals.dart';

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
      homeRoute: homeRoute,
    );

    if (embeddedInShell) {
      return body;
    }

    final palette = MaterialsUiPalette.of(context);
    final hidePublicNav =
        user?.isDriverMode == true || user?.isSupplierMode == true;
    final isPhone = MediaQuery.sizeOf(context).width < 600;

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
              phoneTitle: isPhone ? context.l10n.notificationsTitle : null,
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
      return '/driver';
    }
    if (user.isSupplierMode && user.hasRole('SUPPLIER')) {
      return '/supplier/dashboard';
    }
    return '/home';
  }
}

class _NotificationsBody extends ConsumerStatefulWidget {
  const _NotificationsBody({
    required this.user,
    required this.embeddedInShell,
    required this.homeRoute,
  });

  final User? user;
  final bool embeddedInShell;
  final String homeRoute;

  @override
  ConsumerState<_NotificationsBody> createState() => _NotificationsBodyState();
}

class _NotificationsBodyState extends ConsumerState<_NotificationsBody> {
  bool _refreshInFlight = false;

  Future<void> _handleRefresh() async {
    if (_refreshInFlight) {
      return;
    }

    setState(() => _refreshInFlight = true);
    try {
      await refreshNotifications(ref);
      if (ref.exists(notificationsListProvider)) {
        await ref.read(notificationsListProvider.future);
      }
    } catch (_) {
      // List error UI is handled by the async provider state.
    } finally {
      if (mounted) {
        setState(() => _refreshInFlight = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final listAsync = ref.watch(notificationsListProvider);
    final selectedFilter = ref.watch(notificationReadFilterProvider);
    final viewportWidth = MediaQuery.sizeOf(context).width;
    final isCompactMobile = viewportWidth < 820;
    final showPageBack = !widget.embeddedInShell && viewportWidth < 900;
    final safeBottom = MediaQuery.paddingOf(context).bottom;
    final bottomPadding = widget.embeddedInShell && isCompactMobile
        ? kBottomNavigationBarHeight + safeBottom + AppSpacing.xl
        : AppSpacing.xl + safeBottom + AppSpacing.md;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsetsDirectional.fromSTEB(
            AppSpacing.md,
            AppSpacing.md,
            AppSpacing.md,
            0,
          ),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(
                maxWidth: notificationsContentMaxWidth,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (showPageBack) ...[
                    Align(
                      alignment: AlignmentDirectional.centerStart,
                      child: TextButton.icon(
                        key: const Key('notifications-back-button'),
                        onPressed: () => context.popOrGo(widget.homeRoute),
                        icon: const Icon(Icons.arrow_back_rounded, size: 18),
                        label: Text(l10n.notificationsBack),
                        style: TextButton.styleFrom(
                          padding: const EdgeInsetsDirectional.symmetric(
                            horizontal: AppSpacing.sm,
                          ),
                          visualDensity: VisualDensity.compact,
                        ),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                  ],
                  _NotificationsHeaderCard(
                    listAsync: listAsync,
                    isRefreshing: _refreshInFlight || listAsync.isLoading,
                    onMarkAllRead: () => markAllNotificationsRead(ref),
                    onRefresh: _handleRefresh,
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
        const SizedBox(height: AppSpacing.md),
        Expanded(
          child: listAsync.when(
            skipLoadingOnReload: true,
            loading: () => Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(
                  maxWidth: notificationsContentMaxWidth,
                ),
                child: Padding(
                  padding: const EdgeInsetsDirectional.symmetric(
                    horizontal: AppSpacing.md,
                  ),
                  child: _NotificationsStateCard(
                    icon: Icons.hourglass_top_outlined,
                    title: l10n.notificationsLoading,
                    subtitle: l10n.notificationsLoadingSubtitle,
                  ),
                ),
              ),
            ),
            error: (error, _) {
              if (isAuthPendingNotificationError(error) ||
                  isCancelledNotificationError(error)) {
                return Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(
                      maxWidth: notificationsContentMaxWidth,
                    ),
                    child: Padding(
                      padding: const EdgeInsetsDirectional.symmetric(
                        horizontal: AppSpacing.md,
                      ),
                      child: _NotificationsStateCard(
                        icon: Icons.hourglass_top_outlined,
                        title: l10n.notificationsLoading,
                        subtitle: l10n.notificationsLoadingSubtitle,
                      ),
                    ),
                  ),
                );
              }

              return Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(
                    maxWidth: notificationsContentMaxWidth,
                  ),
                  child: Padding(
                    padding: const EdgeInsetsDirectional.symmetric(
                      horizontal: AppSpacing.md,
                    ),
                    child: _NotificationsStateCard(
                      icon: Icons.cloud_off_outlined,
                      title: l10n.notificationsLoadError,
                      subtitle: kDebugMode && l10n.localeName == 'en'
                          ? '$error'
                          : l10n.tryAgain,
                      actionLabel: l10n.retry,
                      onAction: _handleRefresh,
                    ),
                  ),
                ),
              );
            },
            data: (state) {
              if (state.items.isEmpty) {
                final empty = _emptyCopyForFilter(selectedFilter, l10n);
                return Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(
                      maxWidth: notificationsContentMaxWidth,
                    ),
                    child: Padding(
                      padding: const EdgeInsetsDirectional.symmetric(
                        horizontal: AppSpacing.md,
                      ),
                      child: _NotificationsStateCard(
                        icon: Icons.notifications_none_outlined,
                        title: empty.title,
                        subtitle: empty.subtitle,
                      ),
                    ),
                  ),
                );
              }

              return Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(
                    maxWidth: notificationsContentMaxWidth,
                  ),
                  child: _NotificationsListView(
                    state: state,
                    bottomPadding: bottomPadding,
                    isSupplierMode:
                        widget.user?.isSupplierMode == true &&
                        widget.user?.hasRole('SUPPLIER') == true,
                    isDriverMode:
                        widget.user?.isDriverMode == true &&
                        widget.user?.hasRole('DRIVER') == true,
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
    final route = notificationOpenRoute(
      notification,
      isSupplierMode:
          currentUser?.isSupplierMode == true &&
          currentUser?.hasRole('SUPPLIER') == true,
      isDriverMode:
          currentUser?.isDriverMode == true &&
          currentUser?.hasRole('DRIVER') == true,
    );

    if (route == null) {
      return;
    }

    if (_isDriverDeliveryRoute(route)) {
      context.go(route);
      return;
    }

    context.push(route);
  }
}

bool _isDriverDeliveryRoute(String route) {
  return route == '/driver' || route.startsWith('/driver/');
}

class _NotificationsListView extends StatelessWidget {
  const _NotificationsListView({
    required this.state,
    required this.bottomPadding,
    required this.isSupplierMode,
    required this.isDriverMode,
    required this.onOpen,
    required this.onLoadMore,
  });

  final NotificationsListState state;
  final double bottomPadding;
  final bool isSupplierMode;
  final bool isDriverMode;
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
            isSupplierMode: isSupplierMode,
            isDriverMode: isDriverMode,
            onOpen: () => onOpen(state.items[index]),
          );
        }

        var footerIndex = index - state.items.length;

        if (state.hasMore) {
          if (footerIndex == 0) {
            return Padding(
              padding: const EdgeInsetsDirectional.only(top: AppSpacing.sm),
              child: Center(
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
              ),
            );
          }
          footerIndex -= 1;
        }

        return Padding(
          padding: const EdgeInsetsDirectional.fromSTEB(
            AppSpacing.sm,
            AppSpacing.md,
            AppSpacing.sm,
            AppSpacing.sm,
          ),
          child: Text(
            l10n.notificationCount(state.items.length, state.total),
            textAlign: TextAlign.center,
            style: AppTextStyles.label(
              context,
            ).copyWith(color: palette.textMuted, height: 1.35),
          ),
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
    required this.isRefreshing,
    required this.onMarkAllRead,
    required this.onRefresh,
  });

  final AsyncValue<NotificationsListState> listAsync;
  final bool isRefreshing;
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
    final refreshLabel = l10n.refreshNotifications;

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
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
                style: AppTextStyles.title(context).copyWith(
                  color: palette.textPrimary,
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                ),
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

          final refreshControl = constraints.maxWidth < 520
              ? IconButton(
                  key: const Key('notifications-refresh-button'),
                  tooltip: refreshLabel,
                  onPressed: isRefreshing ? null : onRefresh,
                  style: AppStatusButtonStyle.text(context, AppStatusTone.info),
                  icon: isRefreshing
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.refresh_rounded),
                )
              : Tooltip(
                  message: refreshLabel,
                  child: OutlinedButton.icon(
                    key: const Key('notifications-refresh-button'),
                    onPressed: isRefreshing ? null : onRefresh,
                    style: AppStatusButtonStyle.outlined(
                      context,
                      AppStatusTone.info,
                    ),
                    icon: isRefreshing
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.refresh_rounded, size: 18),
                    label: Text(l10n.refresh),
                  ),
                );

          final actions = Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              refreshControl,
              if (unreadCount > 0)
                FilledButton(
                  key: const Key('notifications-mark-all-read'),
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
        mainAxisSize: MainAxisSize.min,
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
  const _NotificationTile({
    required this.notification,
    required this.isSupplierMode,
    required this.isDriverMode,
    required this.onOpen,
  });

  final AppNotification notification;
  final bool isSupplierMode;
  final bool isDriverMode;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final l10n = context.l10n;
    final category = categoryForNotification(notification);
    final chipLabel = notificationTypeChipLabel(category, l10n: l10n);
    final actionLabel = notificationActionLabel(
      notification,
      l10n: l10n,
      isSupplierMode: isSupplierMode,
      isDriverMode: isDriverMode,
    );
    final copy = localizedNotificationCopy(notification, l10n);
    final hasTarget = notificationHasNavigationTarget(
      notification,
      isSupplierMode: isSupplierMode,
      isDriverMode: isDriverMode,
    );
    final tone = notificationVisualTone(category);
    final accent = AppStatusStyle.of(context, tone).foreground;
    final isCompact = MediaQuery.sizeOf(context).width < 600;
    final relativeTime = LocalizedFormatters(
      l10n,
    ).relativeTime(notification.createdAt);

    final typeIcon = ExcludeSemantics(
      child: Container(
        key: Key('notification-type-icon-${notification.id}'),
        width: isCompact ? 36 : 40,
        height: isCompact ? 36 : 40,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: accent.withValues(alpha: 0.12),
          borderRadius: AppRadius.mdAll,
          border: Border.all(color: accent.withValues(alpha: 0.35)),
        ),
        child: Icon(
          iconForNotification(notification),
          size: isCompact ? 18 : 20,
          color: accent,
        ),
      ),
    );

    final unreadDot = !notification.isRead
        ? Container(
            key: Key('notification-unread-dot-${notification.id}'),
            width: 8,
            height: 8,
            decoration: BoxDecoration(
              color: palette.mint,
              shape: BoxShape.circle,
            ),
          )
        : null;

    final title = Text(
      copy.title,
      style: AppTextStyles.body(context).copyWith(
        color: palette.textPrimary,
        fontSize: isCompact ? 15 : 16,
        fontWeight: notification.isRead ? FontWeight.w600 : FontWeight.w700,
        height: 1.3,
      ),
    );

    final body = Text(
      copy.body,
      style: AppTextStyles.body(
        context,
      ).copyWith(color: palette.textSecondary, fontSize: 14, height: 1.35),
    );

    final timestamp = Text(
      relativeTime,
      style: AppTextStyles.label(
        context,
      ).copyWith(color: palette.textMuted, fontSize: 12),
    );

    final action = hasTarget
        ? Text(
            actionLabel,
            style: AppTextStyles.label(context).copyWith(
              color: palette.mint,
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ),
          )
        : null;

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
          padding: EdgeInsetsDirectional.all(
            isCompact ? AppSpacing.sm + 2 : AppSpacing.md,
          ),
          child: isCompact
              ? Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      children: [
                        if (unreadDot != null) ...[
                          unreadDot,
                          const SizedBox(width: AppSpacing.xs),
                        ],
                        Flexible(
                          child: AppStatusBadge(label: chipLabel, tone: tone),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        timestamp,
                      ],
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        typeIcon,
                        const SizedBox(width: AppSpacing.sm),
                        Expanded(child: title),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    body,
                    if (action != null) ...[
                      const SizedBox(height: AppSpacing.sm),
                      action,
                    ],
                  ],
                )
              : Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    typeIcon,
                    const SizedBox(width: AppSpacing.md),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Wrap(
                            spacing: AppSpacing.xs,
                            runSpacing: AppSpacing.xs,
                            crossAxisAlignment: WrapCrossAlignment.center,
                            children: [
                              AppStatusBadge(label: chipLabel, tone: tone),
                              ?unreadDot,
                            ],
                          ),
                          const SizedBox(height: AppSpacing.xs),
                          title,
                          const SizedBox(height: AppSpacing.xs),
                          body,
                          const SizedBox(height: AppSpacing.sm),
                          Wrap(
                            spacing: AppSpacing.sm,
                            runSpacing: AppSpacing.xs,
                            crossAxisAlignment: WrapCrossAlignment.center,
                            children: [timestamp, ?action],
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
