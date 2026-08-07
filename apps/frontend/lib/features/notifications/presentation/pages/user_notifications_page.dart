import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/navigation_extensions.dart';
import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../app/widgets/entry_nav_bar.dart';
import '../../../../core/format/localized_formatters.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../auth/application/auth_controller.dart';
import '../../../auth/application/auth_route_helpers.dart';
import '../../../auth/data/models/user.dart';
import '../../application/notification_display.dart';
import '../../application/notifications_provider.dart';
import '../../application/payment_notification_presentation.dart';
import '../../data/models/app_notification.dart';
import '../notification_visual_presentation.dart';
import '../notification_visuals.dart';
import '../widgets/payment_notification_detail_sheet.dart';

const _notificationsPollInterval = Duration(seconds: 30);

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
  Timer? _pollTimer;

  @override
  void initState() {
    super.initState();
    _pollTimer = Timer.periodic(_notificationsPollInterval, (_) {
      if (!mounted || _refreshInFlight) {
        return;
      }
      unawaited(refreshNotifications(ref));
    });
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

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
    final categoryFilter = ref.watch(notificationCategoryFilterProvider);
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
                          minimumSize: const Size(44, 44),
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
                    isRefreshing: _refreshInFlight ||
                        listAsync.maybeWhen(
                          data: (state) => state.isBackgroundRefreshing,
                          orElse: () => listAsync.isLoading,
                        ),
                    onMarkAllRead: () => markAllNotificationsRead(ref),
                    onRefresh: _handleRefresh,
                  ),
                  const SizedBox(height: AppSpacing.md),
                  _NotificationCategoryFilterBar(
                    selected: categoryFilter,
                    onSelected: (filter) =>
                        setNotificationCategoryFilter(ref, filter),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  _NotificationReadFilterBar(
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
            skipLoadingOnRefresh: true,
            loading: () => Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(
                  maxWidth: notificationsContentMaxWidth,
                ),
                child: Padding(
                  padding: const EdgeInsetsDirectional.symmetric(
                    horizontal: AppSpacing.md,
                  ),
                  child: _NotificationsSkeletonList(bottomPadding: bottomPadding),
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
                      child: _NotificationsSkeletonList(
                        bottomPadding: bottomPadding,
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
              final visible = state.visibleItems;
              if (visible.isEmpty) {
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
                    visibleItems: visible,
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
    final isSupplierMode =
        currentUser?.isSupplierMode == true &&
        currentUser?.hasRole('SUPPLIER') == true;
    final isDriverMode =
        currentUser?.isDriverMode == true &&
        currentUser?.hasRole('DRIVER') == true;

    final route = notificationOpenRoute(
      notification,
      isSupplierMode: isSupplierMode,
      isDriverMode: isDriverMode,
    );

    if (route == null) {
      return;
    }

    final isPayment =
        !isSupplierMode && !isDriverMode && isPaymentNotification(notification);

    if (isPayment) {
      final reservationId = paymentNotificationReservationId(notification);
      invalidateCachesAfterPaymentNotificationOpen(
        ref,
        reservationId: reservationId,
      );

      final secondaryRoute = reservationId == null
          ? null
          : learnerReservationDetailRoute(reservationId, focus: 'payment');

      await showPaymentNotificationDetailSheet(
        context: context,
        notification: notification,
        onPrimaryAction: () {
          if (!context.mounted) {
            return;
          }
          if (_isDriverDeliveryRoute(route)) {
            context.go(route);
            return;
          }
          context.push(route);
        },
        onSecondaryAction:
            secondaryRoute != null &&
                secondaryRoute != route &&
                paymentNotificationShouldOpenCheckout(notification)
            ? () {
                if (!context.mounted) {
                  return;
                }
                context.push(secondaryRoute);
              }
            : null,
      );
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
    required this.visibleItems,
    required this.bottomPadding,
    required this.isSupplierMode,
    required this.isDriverMode,
    required this.onOpen,
    required this.onLoadMore,
  });

  final NotificationsListState state;
  final List<AppNotification> visibleItems;
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
      itemCount: visibleItems.length + footerCount,
      separatorBuilder: (context, index) {
        if (index >= visibleItems.length - 1) {
          return const SizedBox.shrink();
        }
        return const SizedBox(height: AppSpacing.sm);
      },
      itemBuilder: (context, index) {
        if (index < visibleItems.length) {
          return _NotificationTile(
            notification: visibleItems[index],
            isSupplierMode: isSupplierMode,
            isDriverMode: isDriverMode,
            onOpen: () => onOpen(visibleItems[index]),
          );
        }

        var footerIndex = index - visibleItems.length;

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
            l10n.notificationCount(visibleItems.length, state.total),
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

class _NotificationCategoryFilterBar extends StatelessWidget {
  const _NotificationCategoryFilterBar({
    required this.selected,
    required this.onSelected,
  });

  final PaymentNotificationCategoryFilter selected;
  final ValueChanged<PaymentNotificationCategoryFilter> onSelected;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final palette = MaterialsUiPalette.of(context);

    Widget chip(PaymentNotificationCategoryFilter value, String label) {
      final isSelected = selected == value;
      return FilterChip(
        key: Key('notifications-category-${value.name}'),
        selected: isSelected,
        showCheckmark: false,
        label: Text(label),
        onSelected: (_) => onSelected(value),
        selectedColor: palette.mint.withValues(alpha: 0.18),
        side: BorderSide(
          color: isSelected ? palette.mint : palette.borderSubtle,
        ),
        labelStyle: AppTextStyles.label(context).copyWith(
          color: isSelected ? palette.textPrimary : palette.textSecondary,
          fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
        ),
        padding: const EdgeInsetsDirectional.symmetric(
          horizontal: AppSpacing.sm,
          vertical: AppSpacing.xs,
        ),
        materialTapTargetSize: MaterialTapTargetSize.padded,
      );
    }

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          chip(PaymentNotificationCategoryFilter.all, l10n.filterAll),
          const SizedBox(width: AppSpacing.sm),
          chip(
            PaymentNotificationCategoryFilter.payments,
            l10n.notificationsFilterPayments,
          ),
          const SizedBox(width: AppSpacing.sm),
          chip(
            PaymentNotificationCategoryFilter.delivery,
            l10n.notificationsFilterDelivery,
          ),
          const SizedBox(width: AppSpacing.sm),
          chip(
            PaymentNotificationCategoryFilter.refunds,
            l10n.notificationsFilterRefunds,
          ),
        ],
      ),
    );
  }
}

class _NotificationReadFilterBar extends StatelessWidget {
  const _NotificationReadFilterBar({
    required this.selected,
    required this.onSelected,
  });

  final NotificationReadFilter selected;
  final ValueChanged<NotificationReadFilter> onSelected;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return SegmentedButton<NotificationReadFilter>(
      key: const Key('notifications-read-filter-bar'),
      segments: [
        ButtonSegment(
          value: NotificationReadFilter.all,
          label: Text(
            l10n.filterAll,
            key: const Key('notifications-read-filter-all'),
          ),
        ),
        ButtonSegment(
          value: NotificationReadFilter.unread,
          label: Text(
            l10n.filterUnread,
            key: const Key('notifications-read-filter-unread'),
          ),
        ),
        ButtonSegment(
          value: NotificationReadFilter.read,
          label: Text(
            l10n.filterRead,
            key: const Key('notifications-read-filter-read'),
          ),
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
              if (unreadCount > 0) ...[
                const SizedBox(height: AppSpacing.sm),
                AppStatusBadge(
                  label: l10n.notificationsUnreadCount(unreadCount),
                  tone: AppStatusTone.info,
                ),
              ],
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

class _NotificationsSkeletonList extends StatelessWidget {
  const _NotificationsSkeletonList({required this.bottomPadding});

  final double bottomPadding;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    return ListView.separated(
      padding: EdgeInsetsDirectional.fromSTEB(
        0,
        0,
        0,
        bottomPadding,
      ),
      itemCount: 4,
      separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
      itemBuilder: (context, index) {
        return Container(
          height: 96,
          decoration: BoxDecoration(
            color: palette.panelSurface,
            borderRadius: AppRadius.mdAll,
            border: Border.all(color: palette.borderSubtle),
          ),
        );
      },
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
    final themeColors = AppThemeColors.of(context);
    final l10n = context.l10n;
    final isPayment =
        !isSupplierMode && !isDriverMode && isPaymentNotification(notification);
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
    final tone = toneForNotification(notification);
    final accent = isPayment
        ? paymentNotificationAccent(notification)
        : AppStatusStyle.of(context, tone).foreground;
    final isCompact = MediaQuery.sizeOf(context).width < 600;
    final relativeTime = LocalizedFormatters(
      l10n,
    ).relativeTime(notification.createdAt);
    final amount = isPayment
        ? formatPaymentNotificationAmount(notification, l10n)
        : null;
    final reservationLabel = isPayment
        ? paymentNotificationReservationLabel(notification)
        : '';
    final materialTitle = isPayment
        ? paymentNotificationMaterialTitle(notification)
        : null;

    final typeIcon = ExcludeSemantics(
      child: Container(
        key: Key('notification-type-icon-${notification.id}'),
        width: isCompact ? 40 : 44,
        height: isCompact ? 40 : 44,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: accent.withValues(alpha: 0.12),
          borderRadius: AppRadius.mdAll,
          border: Border.all(color: accent.withValues(alpha: 0.35)),
        ),
        child: Icon(
          iconForNotification(notification),
          size: isCompact ? 20 : 22,
          color: accent,
        ),
      ),
    );

    final unreadDot = !notification.isRead
        ? Container(
            key: Key('notification-unread-dot-${notification.id}'),
            width: 10,
            height: 10,
            decoration: BoxDecoration(
              color: themeColors.info,
              shape: BoxShape.circle,
            ),
          )
        : null;

    final title = Text(
      copy.title,
      style: AppTextStyles.body(context).copyWith(
        color: palette.textPrimary,
        fontSize: isCompact ? 15 : 16,
        fontWeight: notification.isRead ? FontWeight.w600 : FontWeight.w800,
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
              color: isPayment ? accent : palette.mint,
              fontWeight: FontWeight.w700,
              fontSize: 12,
            ),
          )
        : null;

    final metaRow = Wrap(
      spacing: AppSpacing.sm,
      runSpacing: AppSpacing.xs,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        if (reservationLabel.isNotEmpty)
          Text(
            reservationLabel,
            style: AppTextStyles.label(context).copyWith(
              color: palette.textMuted,
              fontWeight: FontWeight.w600,
            ),
          ),
        if (amount != null)
          Text(
            amount,
            key: Key('notification-amount-${notification.id}'),
            style: AppTextStyles.label(context).copyWith(
              color: palette.textPrimary,
              fontWeight: FontWeight.w800,
            ),
          ),
        if (materialTitle != null)
          Text(
            materialTitle,
            style: AppTextStyles.label(context).copyWith(
              color: palette.textSecondary,
            ),
          ),
      ],
    );

    return Material(
      color: notification.isRead
          ? palette.panelSurface
          : Color.alphaBlend(
              themeColors.info.withValues(alpha: 0.08),
              palette.cardSurface,
            ),
      borderRadius: AppRadius.mdAll,
      child: InkWell(
        onTap: onOpen,
        borderRadius: AppRadius.mdAll,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 72),
          child: Container(
            decoration: BoxDecoration(
              borderRadius: AppRadius.mdAll,
              border: Border.all(
                color: notification.isRead
                    ? palette.borderSubtle
                    : themeColors.info.withValues(alpha: 0.45),
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
                            child: AppStatusBadge(
                              label: chipLabel,
                              tone: tone,
                            ),
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
                      if (isPayment) ...[
                        const SizedBox(height: AppSpacing.sm),
                        metaRow,
                      ],
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
                            if (isPayment) ...[
                              const SizedBox(height: AppSpacing.sm),
                              metaRow,
                            ],
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
      ),
    );
  }
}
