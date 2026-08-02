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
          const SizedBox(height: AppSpacing.xs),
          _DriverNavButton(
            icon: Icons.history_rounded,
            label: l10n.driverHistoryNav,
            route: '/driver/history',
            selected: _isHistoryPath(currentPath),
          ),
          const SizedBox(height: AppSpacing.xs),
          _DriverNavButton(
            icon: Icons.badge_outlined,
            label: l10n.driverProfileTitle,
            route: '/driver/profile',
            selected: currentPath == '/driver/profile',
          ),
          const Spacer(),
          InkWell(
            onTap: () => context.go('/driver/profile'),
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
    if (currentPath == '/driver/profile') {
      return _UnselectedDriverBottomNav(currentPath: currentPath);
    }
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

class _UnselectedDriverBottomNav extends StatelessWidget {
  const _UnselectedDriverBottomNav({required this.currentPath});

  final String currentPath;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final l10n = context.l10n;
    final textScale = MediaQuery.textScalerOf(context).scale(1);
    final items = [
      (Icons.dashboard_outlined, l10n.driverPortal, '/driver'),
      (Icons.work_outline_rounded, l10n.driverJobs, '/driver/jobs'),
      (
        Icons.local_shipping_outlined,
        l10n.driverMyActiveDeliveries,
        '/driver/active',
      ),
      (
        Icons.notifications_none_rounded,
        l10n.notificationsTitle,
        driverNotificationsRoute,
      ),
    ];

    return Material(
      key: const ValueKey('driver-unselected-bottom-nav'),
      color: palette.cardSurface,
      elevation: 8,
      child: SafeArea(
        top: false,
        child: SizedBox(
          height:
              kBottomNavigationBarHeight + ((textScale - 1).clamp(0, 0.8) * 24),
          child: Row(
            children: [
              for (var index = 0; index < items.length; index++)
                Expanded(
                  child: Semantics(
                    button: true,
                    selected: false,
                    label: items[index].$2,
                    child: InkWell(
                      key: ValueKey('driver-mobile-nav-$index'),
                      onTap: () => context.go(items[index].$3),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(items[index].$1, color: palette.textSecondary),
                          const SizedBox(height: 2),
                          Text(
                            items[index].$2,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.labelSmall
                                ?.copyWith(color: palette.textSecondary),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

bool _isActivePath(String path) =>
    path == '/driver/active' || path.startsWith('/driver/deliveries/');

bool _isHistoryPath(String path) =>
    path == '/driver/incidents' || path.startsWith('/driver/history');

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
