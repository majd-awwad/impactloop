import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/supplier_decorations.dart';
import 'supplier_mobile_nav.dart';
import 'supplier_sidebar.dart';
import 'supplier_top_bar.dart';

class SupplierShell extends StatelessWidget {
  const SupplierShell({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    final compact =
        MediaQuery.sizeOf(context).width < AppSpacing.supplierLayoutBreakpoint;

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: DecoratedBox(
        decoration: SupplierDecorations.pageBackground,
        child: SafeArea(
          child: compact
              ? Column(
                  children: [
                    SupplierTopBar(currentLocation: location),
                    Expanded(child: child),
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
                          Expanded(child: child),
                        ],
                      ),
                    ),
                  ],
                ),
        ),
      ),
    );
  }
}
