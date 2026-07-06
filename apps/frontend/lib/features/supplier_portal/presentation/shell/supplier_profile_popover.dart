import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import 'package:frontend/features/supplier_portal/presentation/theme/supplier_theme_extension.dart';
import '../../../auth/application/auth_controller.dart';
import '../../../auth/application/portal_navigation.dart';
import '../../../auth/presentation/widgets/portal_switch_menu.dart';
import 'supplier_settings_controls.dart';
import '../widgets/supplier_feedback.dart';
import '../widgets/supplier_portal_avatar.dart';
import '../widgets/supplier_verification_badge.dart';

class SupplierProfileButton extends ConsumerWidget {
  const SupplierProfileButton({
    super.key,
    required this.displayName,
    this.email,
    this.supplierType,
    required this.verificationStatus,
    this.showSettingsControls = false,
  });

  final String displayName;
  final String? email;
  final String? supplierType;
  final String verificationStatus;
  final bool showSettingsControls;

  void _openPopover(BuildContext context, WidgetRef ref) {
    final compact =
        MediaQuery.sizeOf(context).width < AppSpacing.supplierLayoutBreakpoint;

    if (compact) {
      showModalBottomSheet<void>(
        context: context,
        backgroundColor: Colors.transparent,
        builder: (sheetContext) {
          return Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: SupplierProfilePopoverContent(
              displayName: displayName,
              email: email,
              supplierType: supplierType,
              verificationStatus: verificationStatus,
              showSettingsControls: showSettingsControls,
              onBeforePortalSwitch: () {
                Navigator.of(sheetContext).pop();
              },
              onNavigate: (route) {
                Navigator.of(sheetContext).pop();
                context.go(route);
              },
              onLogout: () async {
                Navigator.of(sheetContext).pop();
                await _logout(context, ref);
              },
            ),
          );
        },
      );
      return;
    }

    showDialog<void>(
      context: context,
      builder: (dialogContext) {
        return Dialog(
          backgroundColor: Colors.transparent,
          insetPadding: const EdgeInsets.only(top: 72, right: 24),
          alignment: AlignmentDirectional.topEnd,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 320),
            child: SupplierProfilePopoverContent(
              displayName: displayName,
              email: email,
              supplierType: supplierType,
              verificationStatus: verificationStatus,
              showSettingsControls: showSettingsControls,
              onBeforePortalSwitch: () {
                Navigator.of(dialogContext).pop();
              },
              onNavigate: (route) {
                Navigator.of(dialogContext).pop();
                context.go(route);
              },
              onLogout: () async {
                Navigator.of(dialogContext).pop();
                await _logout(context, ref);
              },
            ),
          ),
        );
      },
    );
  }

  Future<void> _logout(BuildContext context, WidgetRef ref) async {
    final logoutError = await ref
        .read(authControllerProvider.notifier)
        .logout();

    if (!context.mounted) {
      return;
    }

    context.go('/login');

    if (logoutError != null) {
      showSupplierInfoSnackBar(context, context.s.signedOutLocallyMessage);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return InkWell(
      onTap: () => _openPopover(context, ref),
      borderRadius: AppRadius.pillAll,
      child: SupplierPortalAvatar(displayName: displayName, size: 40),
    );
  }
}

class SupplierProfilePopoverContent extends ConsumerWidget {
  const SupplierProfilePopoverContent({
    super.key,
    required this.displayName,
    this.email,
    this.supplierType,
    required this.verificationStatus,
    this.showSettingsControls = false,
    this.onBeforePortalSwitch,
    required this.onNavigate,
    required this.onLogout,
  });

  final String displayName;
  final String? email;
  final String? supplierType;
  final String verificationStatus;
  final bool showSettingsControls;
  final VoidCallback? onBeforePortalSwitch;
  final ValueChanged<String> onNavigate;
  final VoidCallback onLogout;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.supplierColors;
    final decorations = context.supplierDecorations;
    final user = ref.watch(authControllerProvider).user;

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.sizeOf(context).height * 0.85,
      ),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: decorations.dashboardCard,
      child: SingleChildScrollView(
        primary: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
          Row(
            children: [
              SupplierPortalAvatar(
                displayName: displayName,
                size: 48,
                fontSize: 20,
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      displayName,
                      style: context.supplierLabel().copyWith(
                        color: colors.textPrimary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    if (email != null)
                      Text(email!, style: context.supplierBody()),
                    if (supplierType != null && supplierType!.isNotEmpty)
                      Text(
                        context.s.supplierTypeLabel(supplierType!),
                        style: context.supplierBody(),
                      ),
                    if (user != null)
                      Text(
                        activePortalModeLabel(user),
                        style: context.supplierBody().copyWith(
                          color: colors.accent,
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          SupplierVerificationBadge(status: verificationStatus),
          if (showSettingsControls) ...[
            const SizedBox(height: AppSpacing.md),
            const SupplierSettingsControls(compact: true),
          ],
          Divider(color: colors.border, height: 24),
          _PopoverAction(
            label: context.s.viewSupplierProfile,
            icon: Icons.person_outline,
            onTap: () => onNavigate('/supplier/profile'),
          ),
          _PopoverAction(
            label: context.s.navMyMaterials,
            icon: Icons.inventory_2_outlined,
            onTap: () => onNavigate('/supplier/materials'),
          ),
          _PopoverAction(
            label: context.s.navIncomingRequests,
            icon: Icons.inbox_outlined,
            onTap: () => onNavigate('/supplier/reservations'),
          ),
          _PopoverAction(
            label: context.s.navNotifications,
            icon: Icons.notifications_none_rounded,
            onTap: () => onNavigate('/supplier/notifications'),
          ),
          if (user != null) ...[
            Divider(color: colors.border, height: 24),
            ...PortalSwitchMenuItems.build(
              context: context,
              ref: ref,
              user: user,
              labelStyle: context.supplierLabel().copyWith(
                color: colors.textPrimary,
              ),
              noteStyle: context.supplierBody(),
              onBeforeSwitch: onBeforePortalSwitch,
              iconColor: colors.textPrimary,
              useListTileStyle: true,
            ),
          ],
          Divider(color: colors.border, height: 24),
          _PopoverAction(
            label: context.s.logout,
            icon: Icons.logout_rounded,
            onTap: onLogout,
            destructive: true,
          ),
        ],
        ),
      ),
    );
  }
}

class _PopoverAction extends StatelessWidget {
  const _PopoverAction({
    required this.label,
    required this.icon,
    required this.onTap,
    this.destructive = false,
  });

  final String label;
  final IconData icon;
  final VoidCallback onTap;
  final bool destructive;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    final color = destructive ? colors.error : colors.textPrimary;

    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Icon(icon, color: color, size: 20),
      title: Text(label, style: context.supplierLabel().copyWith(color: color)),
      onTap: onTap,
      dense: true,
      visualDensity: VisualDensity.compact,
    );
  }
}
