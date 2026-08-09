import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/widgets/app_account_menu.dart';
import '../../../auth/application/auth_controller.dart';
import '../../../auth/application/auth_route_helpers.dart';
import '../../../auth/application/portal_navigation.dart';
import '../../../profile/presentation/l10n/account_settings_l10n.dart';
import '../theme/admin_decoration_set.dart';
import 'admin_settings_controls.dart';

class AdminProfileButton extends ConsumerWidget {
  const AdminProfileButton({
    super.key,
    required this.displayName,
    this.email,
    this.showSettingsControls = false,
  });

  final String displayName;
  final String? email;
  final bool showSettingsControls;

  String get _initial {
    final trimmed = displayName.trim();
    return trimmed.isEmpty ? 'A' : trimmed.characters.first.toUpperCase();
  }

  Future<void> _logout(BuildContext context, WidgetRef ref) async {
    await ref.read(authControllerProvider.notifier).logout();
    if (context.mounted) {
      context.go('/login');
    }
  }

  void _openMenu(BuildContext context, WidgetRef ref) {
    final user = ref.read(authControllerProvider).user;

    showAppAccountMenu(
      context: context,
      builder: (menuContext) {
        final style = AppAccountMenuStyle.admin(context);
        final l10n = context.l10n;
        final decorations = context.adminDecorations;
        final palette = context.adminPalette;

        void navigate(String route) {
          Navigator.of(menuContext).pop();
          context.go(route);
        }

        return AppAccountMenuPanel(
          style: style,
          avatar: Container(
            width: 48,
            height: 48,
            alignment: Alignment.center,
            decoration: decorations.avatarCircle,
            child: Text(
              _initial,
              style: TextStyle(
                color: palette.primaryTeal,
                fontWeight: FontWeight.w800,
                fontSize: 20,
              ),
            ),
          ),
          displayName: displayName,
          email: email,
          modeLabel: user != null
              ? activePortalModeLabel(user, l10n)
              : l10n.adminMode,
          settingsControls: showSettingsControls
              ? const AdminSettingsControls(compact: true)
              : null,
          leadingActions: [
            AppAccountMenuActionTile(
              style: style,
              action: AppAccountMenuAction(
                label: AccountSettingsL10n.of(context).pageTitle,
                icon: Icons.manage_accounts_outlined,
                onTap: () => navigate(accountSettingsRoute),
              ),
            ),
          ],
          logoutAction: AppAccountMenuAction(
            label: l10n.logout,
            icon: Icons.logout_rounded,
            onTap: () {
              Navigator.of(menuContext).pop();
              _logout(context, ref);
            },
            destructive: true,
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = context.adminPalette;
    final decorations = context.adminDecorations;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => _openMenu(context, ref),
        borderRadius: AppRadius.pillAll,
        child: Ink(
          padding: const EdgeInsetsDirectional.fromSTEB(6, 6, 10, 6),
          decoration: decorations.topBarPill,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 32,
                height: 32,
                alignment: Alignment.center,
                decoration: decorations.avatarCircle,
                child: Text(
                  _initial,
                  style: TextStyle(
                    color: palette.primaryTeal,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              if (!showSettingsControls) ...[
                const SizedBox(width: 8),
                ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 120),
                  child: Text(
                    displayName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: palette.textPrimary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
