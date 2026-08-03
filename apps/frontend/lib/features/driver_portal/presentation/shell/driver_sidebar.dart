import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../notifications/application/notifications_routes.dart';
import '../widgets/driver_asset_image.dart';
import 'driver_nav_helpers.dart';

class DriverSidebar extends StatelessWidget {
  const DriverSidebar({
    super.key,
    required this.currentPath,
    required this.driverName,
    required this.email,
  });

  final String currentPath;
  final String driverName;
  final String email;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final l10n = context.l10n;

    return Container(
      width: 248,
      decoration: BoxDecoration(
        color: palette.cardSurfaceAlt.withValues(alpha: 0.45),
        border: BorderDirectional(end: BorderSide(color: palette.borderSubtle)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsetsDirectional.fromSTEB(
                AppSpacing.md,
                AppSpacing.lg,
                AppSpacing.md,
                AppSpacing.sm,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _NavGroup(
                    header: l10n.driverNavGroupOverview,
                    children: [
                      _DriverNavButton(
                        icon: Icons.dashboard_outlined,
                        label: l10n.driverNavHome,
                        route: '/driver',
                        selected: currentPath == '/driver',
                      ),
                    ],
                  ),
                  _NavGroup(
                    header: l10n.driverNavGroupWork,
                    children: [
                      _DriverNavButton(
                        icon: Icons.work_outline_rounded,
                        label: l10n.driverNavJobs,
                        route: '/driver/jobs',
                        selected: currentPath == '/driver/jobs',
                      ),
                      _DriverNavButton(
                        icon: Icons.local_shipping_outlined,
                        label: l10n.driverNavActive,
                        route: '/driver/active',
                        selected: isDriverActivePath(currentPath),
                      ),
                    ],
                  ),
                  _NavGroup(
                    header: l10n.driverNavGroupHistory,
                    children: [
                      _DriverNavButton(
                        icon: Icons.history_rounded,
                        label: l10n.driverNavHistory,
                        route: '/driver/history',
                        selected: isDriverHistoryPath(currentPath),
                      ),
                    ],
                  ),
                  _NavGroup(
                    header: l10n.driverNavGroupAccount,
                    children: [
                      _DriverNavButton(
                        icon: Icons.notifications_none_rounded,
                        label: l10n.driverMoreNotifications,
                        route: driverNotificationsRoute,
                        selected: isDriverNotificationsPath(currentPath),
                      ),
                      _DriverNavButton(
                        icon: Icons.badge_outlined,
                        label: l10n.driverProfileTitle,
                        route: '/driver/profile',
                        selected: currentPath == '/driver/profile',
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsetsDirectional.fromSTEB(
              AppSpacing.md,
              0,
              AppSpacing.md,
              AppSpacing.sm,
            ),
            child: DriverAssetImage(
              assetPath: DriverAssetPaths.sidebarRoute,
              height: 84,
              excludeFromSemantics: true,
            ),
          ),
          Padding(
            padding: const EdgeInsetsDirectional.fromSTEB(
              AppSpacing.md,
              0,
              AppSpacing.md,
              AppSpacing.md,
            ),
            child: InkWell(
              onTap: () => context.go('/driver/profile'),
              borderRadius: AppRadius.mdAll,
              child: _DriverProfileSummary(name: driverName, email: email),
            ),
          ),
        ],
      ),
    );
  }
}

class _NavGroup extends StatelessWidget {
  const _NavGroup({required this.header, required this.children});

  final String header;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsetsDirectional.fromSTEB(
              AppSpacing.sm,
              0,
              AppSpacing.sm,
              AppSpacing.xs,
            ),
            child: Text(
              header,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTextStyles.body(context).copyWith(
                color: palette.textMuted,
                fontSize: 11,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.3,
              ),
            ),
          ),
          ...children,
        ],
      ),
    );
  }
}

class _DriverNavButton extends StatelessWidget {
  const _DriverNavButton({
    required this.icon,
    required this.label,
    required this.route,
    required this.selected,
  });

  final IconData icon;
  final String label;
  final String route;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Semantics(
      button: true,
      selected: selected,
      label: label,
      child: TextButton.icon(
        onPressed: () => context.go(route),
        style: TextButton.styleFrom(
          alignment: AlignmentDirectional.centerStart,
          foregroundColor: selected ? palette.mint : palette.textSecondary,
          backgroundColor: selected
              ? palette.mint.withValues(alpha: 0.12)
              : Colors.transparent,
          padding: const EdgeInsetsDirectional.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.sm,
          ),
          shape: RoundedRectangleBorder(borderRadius: AppRadius.mdAll),
        ),
        icon: Icon(icon, size: 20),
        label: Text(
          label,
          maxLines: 2,
          softWrap: true,
          overflow: TextOverflow.ellipsis,
        ),
      ),
    );
  }
}

class _DriverProfileSummary extends StatelessWidget {
  const _DriverProfileSummary({required this.name, required this.email});

  final String name;
  final String email;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final initial = name.trim().isEmpty
        ? 'D'
        : name.characters.first.toUpperCase();

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: palette.cardSurface,
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 18,
            backgroundColor: palette.mint.withValues(alpha: 0.14),
            foregroundColor: palette.mint,
            child: Text(
              initial,
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.label(
                    context,
                  ).copyWith(color: palette.textPrimary),
                ),
                if (email.isNotEmpty)
                  Text(
                    email,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTextStyles.body(
                      context,
                    ).copyWith(color: palette.textMuted, fontSize: 12),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
