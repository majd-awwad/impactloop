import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/theme/app_radius.dart';
import '../../app/theme/app_spacing.dart';
import '../../features/auth/application/auth_controller.dart';
import '../../features/notifications/application/notifications_provider.dart';
import '../../features/notifications/application/notifications_routes.dart';
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

class NotificationBellButton extends ConsumerWidget {
  const NotificationBellButton({super.key, this.compact = false});

  final bool compact;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = MaterialsUiPalette.of(context);
    final user = ref.watch(authControllerProvider).user;
    final unreadAsync = ref.watch(myNotificationUnreadCountProvider);
    final unreadCount = unreadAsync.maybeWhen(
      data: (value) => value,
      orElse: () => 0,
    );
    final badgeLabel = formatNotificationBadgeLabel(unreadCount);
    final iconSize = compact ? 22.0 : 24.0;
    final buttonPadding = compact ? AppSpacing.xs : AppSpacing.sm;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () {
          final route = notificationsRouteForUser(user);
          final isDriverInPortal =
              user?.isDriverMode == true && user?.hasRole('DRIVER') == true;

          if (isDriverInPortal) {
            context.go(route);
            return;
          }

          context.push(route);
        },
        borderRadius: AppRadius.pillAll,
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
                Icon(
                  Icons.notifications_none_rounded,
                  size: iconSize,
                  color: palette.textPrimary,
                ),
                if (badgeLabel.isNotEmpty)
                  Positioned(
                    right: -8,
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
