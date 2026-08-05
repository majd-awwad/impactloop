import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/widgets/entry_nav_bar.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../auth/application/auth_controller.dart';
import 'driver_mobile_nav.dart';
import 'driver_sidebar.dart';

class DriverPortalShell extends ConsumerWidget {
  const DriverPortalShell({super.key, required this.child});

  final Widget child;

  static const _sidebarBreakpoint = 820.0;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = MaterialsUiPalette.of(context);
    final l10n = context.l10n;
    final user = ref.watch(authControllerProvider).user;
    final path = GoRouterState.of(context).matchedLocation;

    return LayoutBuilder(
      builder: (context, constraints) {
        final useSidebar = constraints.maxWidth >= _sidebarBreakpoint;

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
                            DriverSidebar(
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
              : DriverMobileNav(currentPath: path),
        );
      },
    );
  }
}
