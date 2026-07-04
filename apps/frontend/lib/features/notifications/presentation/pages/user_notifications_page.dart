import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/widgets/entry_nav_bar.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../auth/application/auth_controller.dart';
import '../../application/notifications_provider.dart';
import '../../data/models/app_notification.dart';

class UserNotificationsPage extends ConsumerWidget {
  const UserNotificationsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = MaterialsUiPalette.of(context);
    final notificationsAsync = ref.watch(myNotificationsProvider);

    return Scaffold(
      backgroundColor: palette.pageBackground,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const EntryNavBar(
              showSignIn: false,
              showCreateAccount: false,
              homeRoute: '/home',
            ),
            Padding(
              padding: const EdgeInsetsDirectional.fromSTEB(
                AppSpacing.md,
                AppSpacing.lg,
                AppSpacing.md,
                AppSpacing.sm,
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      'Notifications',
                      style: AppTextStyles.display(
                        context,
                      ).copyWith(color: palette.textPrimary),
                    ),
                  ),
                  TextButton(
                    onPressed: () async {
                      await markAllNotificationsRead(ref);
                    },
                    child: const Text('Mark all read'),
                  ),
                ],
              ),
            ),
            Expanded(
              child: notificationsAsync.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (_, _) => Center(
                  child: TextButton(
                    onPressed: () => ref.invalidate(myNotificationsProvider),
                    child: const Text('Try again'),
                  ),
                ),
                data: (page) {
                  if (page.items.isEmpty) {
                    return Center(
                      child: Text(
                        'No notifications yet.',
                        style: AppTextStyles.body(
                          context,
                        ).copyWith(color: palette.textSecondary),
                      ),
                    );
                  }

                  return ListView.separated(
                    padding: const EdgeInsetsDirectional.all(AppSpacing.md),
                    itemCount: page.items.length,
                    separatorBuilder: (_, _) =>
                        const SizedBox(height: AppSpacing.sm),
                    itemBuilder: (context, index) {
                      final notification = page.items[index];
                      return _NotificationTile(
                        notification: notification,
                        onOpen: () => _handleOpen(context, ref, notification),
                      );
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _handleOpen(
    BuildContext context,
    WidgetRef ref,
    AppNotification notification,
  ) async {
    if (!notification.isRead) {
      await markNotificationRead(ref, notification.id);
    }

    if (!context.mounted) {
      return;
    }

    if (notification.relatedEntityType == 'RESERVATION' &&
        notification.relatedEntityId != null &&
        notification.relatedEntityId!.isNotEmpty) {
      final user = ref.read(authControllerProvider).user;
      final reservationId = notification.relatedEntityId!;

      if (user?.hasRole('SUPPLIER') == true) {
        context.go(
          '/supplier/reservations?tab=pending&focus=$reservationId',
        );
        return;
      }

      context.go('/learner/reservations/$reservationId');
    }
  }
}

class _NotificationTile extends StatelessWidget {
  const _NotificationTile({
    required this.notification,
    required this.onOpen,
  });

  final AppNotification notification;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Material(
      color: notification.isRead
          ? palette.panelSurface
          : palette.inputSurface,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onOpen,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsetsDirectional.all(AppSpacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                notification.title,
                style: AppTextStyles.title(
                  context,
                ).copyWith(color: palette.textPrimary),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                notification.body,
                style: AppTextStyles.body(
                  context,
                ).copyWith(color: palette.textSecondary),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                _formatTimestamp(notification.createdAt),
                style: AppTextStyles.label(
                  context,
                ).copyWith(color: palette.textMuted),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _formatTimestamp(DateTime value) {
    final local = value.toLocal();
    return '${local.year}-${local.month.toString().padLeft(2, '0')}-'
        '${local.day.toString().padLeft(2, '0')} '
        '${local.hour.toString().padLeft(2, '0')}:'
        '${local.minute.toString().padLeft(2, '0')}';
  }
}
