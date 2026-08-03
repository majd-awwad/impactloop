import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../auth/application/auth_route_helpers.dart';
import '../../../notifications/application/notifications_routes.dart';
import 'driver_settings_controls.dart';

void showDriverMoreSheet(BuildContext context, {required String currentPath}) {
  showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    builder: (sheetContext) => DriverMoreSheet(
      key: const Key('driver-more-sheet'),
      currentPath: currentPath,
    ),
  );
}

class DriverMoreSheet extends ConsumerWidget {
  const DriverMoreSheet({super.key, required this.currentPath});

  final String currentPath;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = MaterialsUiPalette.of(context);
    final l10n = context.l10n;

    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsetsDirectional.fromSTEB(
          AppSpacing.md,
          AppSpacing.xs,
          AppSpacing.md,
          AppSpacing.md,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              l10n.driverMoreTitle,
              style: AppTextStyles.title(
                context,
              ).copyWith(color: palette.textPrimary, fontSize: 18),
            ),
            const SizedBox(height: AppSpacing.sm),
            _MoreSheetTile(
              icon: Icons.badge_outlined,
              label: l10n.driverMoreProfile,
              selected: currentPath == '/driver/profile',
              onTap: () => _navigateFromSheet(context, '/driver/profile'),
            ),
            _MoreSheetTile(
              icon: Icons.notifications_none_rounded,
              label: l10n.driverMoreNotifications,
              selected: isDriverNotificationsPath(currentPath),
              onTap: () =>
                  _navigateFromSheet(context, driverNotificationsRoute),
            ),
            _MoreSheetTile(
              icon: Icons.manage_accounts_outlined,
              label: l10n.driverMoreAccountSettings,
              selected: currentPath == accountSettingsRoute,
              onTap: () {
                Navigator.of(context).pop();
                context.push(accountSettingsRoute);
              },
            ),
            const SizedBox(height: AppSpacing.md),
            Text(
              l10n.settings,
              style: AppTextStyles.label(context).copyWith(
                color: palette.textMuted,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            const DriverSettingsControls(),
          ],
        ),
      ),
    );
  }

  void _navigateFromSheet(BuildContext context, String route) {
    Navigator.of(context).pop();
    context.go(route);
  }
}

class _MoreSheetTile extends StatelessWidget {
  const _MoreSheetTile({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Semantics(
      button: true,
      selected: selected,
      label: label,
      child: ListTile(
        onTap: onTap,
        leading: Icon(
          icon,
          color: selected ? palette.mint : palette.textSecondary,
        ),
        title: Text(
          label,
          style: AppTextStyles.body(context).copyWith(
            color: selected ? palette.mint : palette.textPrimary,
            fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
          ),
        ),
        selected: selected,
        selectedTileColor: palette.mint.withValues(alpha: 0.12),
        shape: RoundedRectangleBorder(borderRadius: AppRadius.mdAll),
        contentPadding: const EdgeInsetsDirectional.symmetric(
          horizontal: AppSpacing.sm,
        ),
      ),
    );
  }
}
