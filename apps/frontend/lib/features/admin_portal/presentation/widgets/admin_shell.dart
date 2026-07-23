import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/application/app_settings_notifier.dart';
import '../../../../app/theme/app_spacing.dart';
import '../l10n/admin_l10n.dart';
import '../theme/admin_decoration_set.dart';
import 'admin_sidebar.dart';
import 'admin_top_bar.dart';

class AdminShell extends ConsumerWidget {
  const AdminShell({super.key, required this.child});

  final Widget child;

  static const _mobileBreakpoint = 920.0;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final settings = ref.watch(appSettingsProvider);
    final languageCode = settings.languageCode;
    final direction = languageCode == 'ar'
        ? TextDirection.rtl
        : TextDirection.ltr;
    final location = GoRouterState.of(context).matchedLocation;
    final compact = MediaQuery.sizeOf(context).width < _mobileBreakpoint;
    final l = AdminL10n.of(context);
    final decorations = context.adminDecorations;

    return Directionality(
      textDirection: direction,
      child: Scaffold(
        backgroundColor: Colors.transparent,
        drawer: compact
            ? Drawer(
                backgroundColor: context.adminPalette.sidebarBackground,
                child: SafeArea(
                  child: AdminSidebar(
                    currentLocation: location,
                    compact: true,
                    onNavigate: () => Navigator.of(context).maybePop(),
                  ),
                ),
              )
            : null,
        body: DecoratedBox(
          decoration: decorations.pageBackground,
          child: SafeArea(
            child: compact
                ? Column(
                    children: [
                      Builder(
                        builder: (scaffoldContext) => AdminTopBar(
                          currentLocation: location,
                          title: adminPageTitle(l, location),
                          subtitle: adminPageSubtitle(l, location),
                          onOpenMenu: () =>
                              Scaffold.of(scaffoldContext).openDrawer(),
                        ),
                      ),
                      Expanded(child: child),
                    ],
                  )
                : Row(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      AdminSidebar(
                        currentLocation: location,
                        direction: direction,
                      ),
                      Expanded(
                        child: Column(
                          children: [
                            AdminTopBar(
                              currentLocation: location,
                              title: adminPageTitle(l, location),
                              subtitle: adminPageSubtitle(l, location),
                            ),
                            Expanded(
                              child: Padding(
                                padding: const EdgeInsetsDirectional.only(
                                  start: AppSpacing.lg,
                                  end: AppSpacing.lg,
                                  bottom: AppSpacing.lg,
                                ),
                                child: child,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
          ),
        ),
      ),
    );
  }
}
