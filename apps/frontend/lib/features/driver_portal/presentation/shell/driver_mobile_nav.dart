import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../l10n/l10n.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../widgets/driver_more_sheet.dart';
import 'driver_nav_helpers.dart';

class DriverMobileNav extends StatelessWidget {
  const DriverMobileNav({super.key, required this.currentPath});

  final String currentPath;

  static const _routes = [
    '/driver',
    '/driver/jobs',
    '/driver/active',
    '/driver/history',
  ];

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final l10n = context.l10n;
    final selectedIndex = driverMobileNavSelectedIndex(currentPath);

    final items = [
      (Icons.dashboard_outlined, l10n.driverNavHome),
      (Icons.work_outline_rounded, l10n.driverNavJobs),
      (Icons.local_shipping_outlined, l10n.driverNavActive),
      (Icons.history_rounded, l10n.driverNavHistory),
      (Icons.more_horiz_rounded, l10n.driverNavMore),
    ];

    return Material(
      color: palette.cardSurface,
      elevation: 8,
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: _driverMobileNavHeight(context),
          child: Row(
            children: [
              for (var index = 0; index < items.length; index++)
                Expanded(
                  child: Semantics(
                    button: true,
                    selected: selectedIndex == index,
                    label: items[index].$2,
                    child: InkWell(
                      key: ValueKey('driver-mobile-nav-$index'),
                      onTap: () => _onTap(context, index),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            items[index].$1,
                            color: selectedIndex == index
                                ? palette.mint
                                : palette.textSecondary,
                          ),
                          const SizedBox(height: 2),
                          Text(
                            items[index].$2,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            textAlign: TextAlign.center,
                            style: Theme.of(context).textTheme.labelSmall
                                ?.copyWith(
                                  color: selectedIndex == index
                                      ? palette.mint
                                      : palette.textSecondary,
                                  fontWeight: selectedIndex == index
                                      ? FontWeight.w600
                                      : FontWeight.w500,
                                ),
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

  void _onTap(BuildContext context, int index) {
    if (index == 4) {
      showDriverMoreSheet(context, currentPath: currentPath);
      return;
    }
    context.go(_routes[index]);
  }
}

double _driverMobileNavHeight(BuildContext context) {
  final textScale = MediaQuery.textScalerOf(context).scale(1);
  return kBottomNavigationBarHeight + ((textScale - 1).clamp(0, 0.8) * 28);
}
