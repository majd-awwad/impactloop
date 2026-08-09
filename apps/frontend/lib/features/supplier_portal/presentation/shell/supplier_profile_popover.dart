import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/widgets/app_account_menu.dart';
import '../../../auth/application/auth_controller.dart';
import '../../../auth/application/auth_route_helpers.dart';
import '../../../auth/application/portal_navigation.dart';
import '../../../auth/presentation/widgets/portal_switch_menu.dart';
import '../../../profile/presentation/l10n/account_settings_l10n.dart';
import '../theme/supplier_theme_extension.dart';
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
    showAppAccountMenu(
      context: context,
      builder: (menuContext) {
        return SupplierProfilePopoverContent(
          displayName: displayName,
          email: email,
          supplierType: supplierType,
          verificationStatus: verificationStatus,
          showSettingsControls: showSettingsControls,
          onBeforePortalSwitch: () {
            Navigator.of(menuContext).pop();
          },
          onNavigate: (route) {
            Navigator.of(menuContext).pop();
            if (route == accountSettingsRoute) {
              context.push(route);
            } else {
              context.go(route);
            }
          },
          onLogout: () async {
            Navigator.of(menuContext).pop();
            await _logout(context, ref);
          },
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
    final style = AppAccountMenuStyle.supplier(context);
    final user = ref.watch(authControllerProvider).user;
    final subtitleLines = <String>[
      if (supplierType != null && supplierType!.isNotEmpty)
        context.s.supplierTypeLabel(supplierType!),
    ];

    final leadingActions = <Widget>[
      AppAccountMenuActionTile(
        style: style,
        action: AppAccountMenuAction(
          label: context.s.viewSupplierProfile,
          icon: Icons.person_outline,
          onTap: () => onNavigate('/supplier/profile'),
        ),
      ),
      AppAccountMenuActionTile(
        style: style,
        action: AppAccountMenuAction(
          label: AccountSettingsL10n.of(context).pageTitle,
          icon: Icons.manage_accounts_outlined,
          onTap: () => onNavigate(accountSettingsRoute),
        ),
      ),
      AppAccountMenuActionTile(
        style: style,
        action: AppAccountMenuAction(
          label: context.s.navMyMaterials,
          icon: Icons.inventory_2_outlined,
          onTap: () => onNavigate('/supplier/materials'),
        ),
      ),
      AppAccountMenuActionTile(
        style: style,
        action: AppAccountMenuAction(
          label: context.s.navIncomingRequests,
          icon: Icons.inbox_outlined,
          onTap: () => onNavigate('/supplier/reservations'),
        ),
      ),
      AppAccountMenuActionTile(
        style: style,
        action: AppAccountMenuAction(
          label: context.s.navNotifications,
          icon: Icons.notifications_none_rounded,
          onTap: () => onNavigate('/supplier/notifications'),
        ),
      ),
    ];

    final trailingSections = <Widget>[
      if (user != null)
        Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: PortalSwitchMenuItems.build(
            context: context,
            ref: ref,
            user: user,
            labelStyle: style.actionLabelStyle,
            noteStyle: style.secondaryStyle,
            onBeforeSwitch: onBeforePortalSwitch,
            iconColor: style.textPrimary,
            useListTileStyle: true,
          ),
        ),
    ];

    return AppAccountMenuPanel(
      style: style,
      avatar: SupplierPortalAvatar(
        displayName: displayName,
        size: 48,
        fontSize: 20,
      ),
      displayName: displayName,
      email: email,
      subtitleLines: subtitleLines,
      modeLabel: user != null
          ? activePortalModeLabel(user, context.l10n)
          : null,
      badge: SupplierVerificationBadge(status: verificationStatus),
      settingsControls: showSettingsControls
          ? const SupplierSettingsControls(compact: true)
          : null,
      leadingActions: leadingActions,
      trailingSections: trailingSections,
      logoutAction: AppAccountMenuAction(
        label: context.s.logout,
        icon: Icons.logout_rounded,
        onTap: onLogout,
        destructive: true,
      ),
    );
  }
}
