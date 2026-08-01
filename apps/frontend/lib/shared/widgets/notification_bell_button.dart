import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/theme/app_radius.dart';
import '../../app/theme/app_spacing.dart';
import '../../features/auth/application/auth_controller.dart';
import '../../features/auth/data/models/user.dart';
import '../../features/notifications/application/notifications_provider.dart';
import '../../features/notifications/application/notifications_routes.dart';
import '../../features/supplier_portal/presentation/controllers/supplier_notifications_providers.dart';
import '../../l10n/l10n.dart';
import '../widgets/materials/materials_ui_palette.dart';

String formatNotificationBadgeLabel(int count) {
  if (count <= 0) {
    return '';
  }
  if (count > 99) {
    return '99+';
  }
  return '$count';
}

String notificationRouteForBell(User? user) {
  return notificationInboxRouteForUser(user);
}

class NotificationBellButton extends ConsumerWidget {
  const NotificationBellButton({super.key, this.compact = false});

  final bool compact;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;
    if (!userSupportsNotificationInbox(user)) {
      return const SizedBox.shrink();
    }

    final palette = MaterialsUiPalette.of(context);
    final l10n = context.l10n;
    final isSupplier =
        user?.isSupplierMode == true && user?.hasRole('SUPPLIER') == true;
    final unreadAsync = isSupplier
        ? ref.watch(supplierNotificationsUnreadCountProvider)
        : ref.watch(myNotificationUnreadCountProvider);
    final unreadCount = unreadAsync.maybeWhen(
      data: (value) => value,
      orElse: () => 0,
    );
    final badgeLabel = formatNotificationBadgeLabel(unreadCount);
    final iconSize = compact ? 22.0 : 24.0;
    final buttonPadding = compact ? AppSpacing.xs : AppSpacing.sm;
    final tooltip = unreadCount > 0
        ? '${l10n.notificationsTitle} ($badgeLabel)'
        : l10n.notificationsTitle;

    return Tooltip(
      message: tooltip,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () {
            final route = notificationRouteForBell(user);
            final isDriverInPortal =
                user?.isDriverMode == true && user?.hasRole('DRIVER') == true;

            String currentPath = '';
            try {
              currentPath = GoRouterState.of(context).uri.path;
            } catch (_) {
              currentPath = '';
            }

            if (currentPath == route) {
              return;
            }

            if (isDriverInPortal) {
              context.go(route);
              return;
            }

            // Learners/suppliers: push so browser back / in-app back return to
            // the previous route (e.g. /profile/account → /notifications).
            context.push(route);
          },
          borderRadius: AppRadius.pillAll,
          child: Semantics(
            button: true,
            label: tooltip,
            child: Ink(
              padding: EdgeInsets.all(buttonPadding),
              decoration: BoxDecoration(
                color: palette.cardSurfaceAlt,
                borderRadius: AppRadius.pillAll,
                border: Border.all(color: palette.borderSubtle),
              ),
              child: SizedBox(
                width: iconSize + 4,
                height: iconSize + 4,
                child: Stack(
                  clipBehavior: Clip.none,
                  alignment: Alignment.center,
                  children: [
                    ExcludeSemantics(
                      child: Icon(
                        Icons.notifications_none_rounded,
                        size: iconSize,
                        color: palette.textPrimary,
                      ),
                    ),
                    if (badgeLabel.isNotEmpty)
                      Positioned.directional(
                        textDirection: Directionality.of(context),
                        end: -8,
                        top: -8,
                        child: _NotificationCountBadge(
                          label: badgeLabel,
                          backgroundColor: palette.mint,
                          foregroundColor: palette.ctaForeground,
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _NotificationCountBadge extends StatelessWidget {
  const _NotificationCountBadge({
    required this.label,
    required this.backgroundColor,
    required this.foregroundColor,
  });

  final String label;
  final Color backgroundColor;
  final Color foregroundColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minWidth: 18, minHeight: 18),
      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: backgroundColor),
      ),
      alignment: Alignment.center,
      child: Text(
        label,
        style: TextStyle(
          color: foregroundColor,
          fontSize: 10,
          fontWeight: FontWeight.w700,
          height: 1,
        ),
      ),
    );
  }
}
