import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/widgets/entry_nav_bar.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../auth/application/auth_controller.dart';
import '../../../notifications/application/notifications_routes.dart';

class DriverPortalShell extends ConsumerWidget {
  const DriverPortalShell({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = MaterialsUiPalette.of(context);
    final l10n = context.l10n;
    final user = ref.watch(authControllerProvider).user;
    final path = GoRouterState.of(context).matchedLocation;

    return LayoutBuilder(
      builder: (context, constraints) {
        final useSidebar = constraints.maxWidth >= 820;

        return Scaffold(
          backgroundColor: palette.pageBackground,
          body: SafeArea(
            bottom: useSidebar,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                EntryNavBar(
                  showSignIn: false,
                  showCreateAccount: false,
                  homeRoute: '/driver',
                  phoneTitle: l10n.driver,
                  showPublicNavLinks: false,
                ),
                Expanded(
                  child: useSidebar
                      ? Row(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            _DriverSidebar(
                              currentPath: path,
                              driverName: user?.displayName ?? l10n.driver,
                              email: user?.email ?? '',
                            ),
                            Expanded(child: child),
                          ],
                        )
                      : child,
                ),
              ],
            ),
          ),
          bottomNavigationBar: useSidebar
              ? null
              : _DriverBottomNav(currentPath: path),
        );
      },
    );
  }
}

class _DriverSidebar extends StatelessWidget {
  const _DriverSidebar({
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
      margin: const EdgeInsetsDirectional.fromSTEB(
        AppSpacing.md,
        AppSpacing.lg,
        0,
        AppSpacing.lg,
      ),
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: palette.cardSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderStrong),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            l10n.driverPortal,
            style: AppTextStyles.title(
              context,
            ).copyWith(color: palette.textPrimary),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            l10n.driverInternalDelivery,
            style: AppTextStyles.body(
              context,
            ).copyWith(color: palette.textSecondary),
          ),
          const SizedBox(height: AppSpacing.lg),
          _DriverNavButton(
            icon: Icons.dashboard_outlined,
            label: l10n.driverPortal,
            route: '/driver',
            selected: currentPath == '/driver',
          ),
          const SizedBox(height: AppSpacing.xs),
          _DriverNavButton(
            icon: Icons.work_outline_rounded,
            label: l10n.driverAvailableNearbyJobs,
            route: '/driver/jobs',
            selected: currentPath == '/driver/jobs',
          ),
          const SizedBox(height: AppSpacing.xs),
          _DriverNavButton(
            icon: Icons.local_shipping_outlined,
            label: l10n.driverMyActiveDeliveries,
            route: '/driver/active',
            selected: _isActivePath(currentPath),
          ),
          const SizedBox(height: AppSpacing.xs),
          _DriverNavButton(
            icon: Icons.notifications_none_rounded,
            label: l10n.notificationsTitle,
            route: driverNotificationsRoute,
            selected: isDriverNotificationsPath(currentPath),
          ),
          const Spacer(),
          InkWell(
            onTap: () => context.go('/profile/account'),
            borderRadius: AppRadius.mdAll,
            child: _DriverProfileSummary(name: driverName, email: email),
          ),
        ],
      ),
    );
  }
}

class _DriverBottomNav extends StatelessWidget {
  const _DriverBottomNav({required this.currentPath});

  final String currentPath;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final l10n = context.l10n;
    final selectedIndex = isDriverNotificationsPath(currentPath)
        ? 3
        : currentPath == '/driver/jobs'
        ? 1
        : _isActivePath(currentPath)
        ? 2
        : 0;

    return Material(
      color: palette.cardSurface,
      elevation: 8,
      child: SafeArea(
        top: false,
        child: NavigationBar(
          selectedIndex: selectedIndex,
          onDestinationSelected: (index) {
            switch (index) {
              case 0:
                context.go('/driver');
              case 1:
                context.go('/driver/jobs');
              case 2:
                context.go('/driver/active');
              default:
                context.go(driverNotificationsRoute);
            }
          },
          destinations: [
            NavigationDestination(
              icon: const Icon(Icons.dashboard_outlined),
              label: l10n.driverPortal,
            ),
            NavigationDestination(
              icon: const Icon(Icons.work_outline_rounded),
              label: l10n.driverJobs,
            ),
            NavigationDestination(
              icon: const Icon(Icons.local_shipping_outlined),
              label: l10n.driverMyActiveDeliveries,
            ),
            NavigationDestination(
              icon: const Icon(Icons.notifications_none_rounded),
              label: l10n.notificationsTitle,
            ),
          ],
        ),
      ),
    );
  }
}

bool _isActivePath(String path) =>
    path == '/driver/active' || path.startsWith('/driver/deliveries/');

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

    return TextButton.icon(
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
      icon: Icon(icon),
      label: Text(label),
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
        color: palette.cardSurfaceAlt,
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Row(
        children: [
          CircleAvatar(child: Text(initial)),
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
