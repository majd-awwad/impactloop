import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/application/app_settings_notifier.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../auth/application/auth_controller.dart';
import '../theme/supplier_locale_scope.dart';
import '../theme/supplier_theme_extension.dart';
import 'supplier_mobile_nav.dart';
import 'supplier_sidebar.dart';
import 'supplier_top_bar.dart';

class SupplierShell extends ConsumerStatefulWidget {
  const SupplierShell({super.key, required this.child});

  final Widget child;

  @override
  ConsumerState<SupplierShell> createState() => _SupplierShellState();
}

class _SupplierShellState extends ConsumerState<SupplierShell> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!ref.read(authControllerProvider).isAuthenticated) {
        return;
      }
      try {
        await ref.read(authControllerProvider.notifier).refreshCurrentUser();
      } catch (_) {
        // Keep the current session if refresh fails.
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    final compact =
        MediaQuery.sizeOf(context).width < AppSpacing.supplierLayoutBreakpoint;
    final languageCode = ref.watch(appSettingsProvider).languageCode;
    final direction =
        languageCode == 'ar' ? TextDirection.rtl : TextDirection.ltr;

    return SupplierLocaleScope(
      languageCode: languageCode,
      child: Directionality(
        textDirection: direction,
        child: Scaffold(
          backgroundColor: Colors.transparent,
          body: DecoratedBox(
            decoration: context.supplierDecorations.pageBackground,
            child: SafeArea(
              child: compact
                  ? Column(
                      children: [
                        SupplierTopBar(currentLocation: location),
                        Expanded(child: widget.child),
                        SupplierMobileNav(currentLocation: location),
                      ],
                    )
                  : Row(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        SupplierSidebar(currentLocation: location),
                        Expanded(
                          child: Column(
                            children: [
                              SupplierTopBar(currentLocation: location),
                              Expanded(child: widget.child),
                            ],
                          ),
                        ),
                      ],
                    ),
            ),
          ),
        ),
      ),
    );
  }
}
