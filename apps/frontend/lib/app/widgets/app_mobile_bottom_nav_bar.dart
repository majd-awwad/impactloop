import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../theme/app_radius.dart';
import '../theme/app_spacing.dart';
import '../theme/app_text_styles.dart';
import '../theme/app_theme_colors.dart';
import '../../features/auth/application/auth_controller.dart';

const appMobileBottomNavReservedHeight = 96.0;

EdgeInsetsDirectional appMobileAwareScrollPadding(
  BuildContext context, {
  double start = AppSpacing.md,
  double top = AppSpacing.lg,
  double end = AppSpacing.md,
  double bottom = AppSpacing.xl,
}) {
  final extraBottom = MediaQuery.sizeOf(context).width < 600
      ? appMobileBottomNavReservedHeight
      : 0.0;

  return EdgeInsetsDirectional.fromSTEB(
    start,
    top,
    end,
    bottom + extraBottom,
  );
}

class AppMobileBottomNavBar extends ConsumerWidget {
  const AppMobileBottomNavBar({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final width = MediaQuery.sizeOf(context).width;
    if (width >= 600) {
      return const SizedBox.shrink();
    }

    final colors = AppThemeColors.of(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final authState = ref.watch(authControllerProvider);
    final user = authState.user;
    final profileRoute = user == null ? '/login' : '/profile';
    final currentPath = _currentPath(context);
    final items = [
      _MobileNavDestination(
        label: 'Home',
        icon: Icons.home_rounded,
        route: '/home',
        selected: currentPath == '/home',
      ),
      _MobileNavDestination(
        label: 'Materials',
        icon: Icons.inventory_2_rounded,
        route: '/materials',
        selected: currentPath == '/materials' ||
            currentPath.startsWith('/materials/'),
      ),
      _MobileNavDestination(
        label: 'Learning',
        icon: Icons.school_rounded,
        route: '/learning',
        selected:
            currentPath == '/learning' || currentPath.startsWith('/learning/'),
      ),
      _MobileNavDestination(
        label: 'Reservations',
        icon: Icons.receipt_long_rounded,
        route: '/learner/reservations',
        selected: currentPath == '/learner/reservations' ||
            currentPath.startsWith('/learner/deliveries/'),
      ),
      _MobileNavDestination(
        label: 'Profile',
        icon: Icons.person_rounded,
        route: profileRoute,
        selected: currentPath == '/profile' || currentPath.startsWith('/profile/'),
      ),
    ];

    return SafeArea(
      top: false,
      minimum: const EdgeInsets.fromLTRB(
        AppSpacing.md,
        0,
        AppSpacing.md,
        AppSpacing.sm,
      ),
      child: SizedBox(
        height: 72,
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 560),
            child: SizedBox(
              width: double.infinity,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: colors.surfaceElevated.withValues(
                    alpha: isDark ? 0.96 : 0.98,
                  ),
                  borderRadius: AppRadius.pillAll,
                  border: Border.all(color: colors.borderSubtle),
                  boxShadow: [
                    BoxShadow(
                      color: colors.shadow.withValues(
                        alpha: isDark ? 0.86 : 0.22,
                      ),
                      blurRadius: 24,
                      offset: const Offset(0, 10),
                    ),
                  ],
                ),
                child: Padding(
                  padding: const EdgeInsetsDirectional.symmetric(
                    horizontal: AppSpacing.xs,
                    vertical: AppSpacing.xs,
                  ),
                  child: Row(
                    children: [
                      for (final item in items)
                        Expanded(
                          child: _MobileBottomNavItem(
                            item: item,
                            onTap: () => context.go(item.route),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  String _currentPath(BuildContext context) {
    try {
      return GoRouterState.of(context).uri.path;
    } catch (_) {
      return '';
    }
  }
}

class AppMobileNavigationShell extends StatelessWidget {
  const AppMobileNavigationShell({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (MediaQuery.sizeOf(context).width >= 600) {
      return child;
    }

    return Scaffold(
      body: child,
      bottomNavigationBar: const AppMobileBottomNavBar(),
    );
  }
}

class _MobileNavDestination {
  const _MobileNavDestination({
    required this.label,
    required this.icon,
    required this.route,
    required this.selected,
  });

  final String label;
  final IconData icon;
  final String route;
  final bool selected;
}

class _MobileBottomNavItem extends StatelessWidget {
  const _MobileBottomNavItem({required this.item, required this.onTap});

  final _MobileNavDestination item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final selected = item.selected;
    final foreground = selected ? colors.primary : colors.textMuted;
    final background = selected
        ? colors.primary.withValues(
            alpha: Theme.of(context).brightness == Brightness.dark ? 0.18 : 0.1,
          )
        : Colors.transparent;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadius.pillAll,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 160),
          curve: Curves.easeOutCubic,
          padding: const EdgeInsetsDirectional.symmetric(
            horizontal: 4,
            vertical: 7,
          ),
          decoration: BoxDecoration(
            color: background,
            borderRadius: AppRadius.pillAll,
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(item.icon, color: foreground, size: selected ? 22 : 21),
              const SizedBox(height: 3),
              Text(
                item.label,
                style: AppTextStyles.label(context).copyWith(
                  color: foreground,
                  fontSize: 10.5,
                  fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
                  height: 1,
                  letterSpacing: 0,
                ),
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
