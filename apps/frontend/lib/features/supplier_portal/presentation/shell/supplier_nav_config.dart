import 'package:flutter/material.dart';

import '../theme/supplier_theme_extension.dart';

class SupplierNavItem {
  const SupplierNavItem({
    required this.labelKey,
    required this.route,
    required this.icon,
    this.mobileLabelKey,
  });

  final SupplierNavLabelKey labelKey;
  final String route;
  final IconData icon;
  final SupplierNavLabelKey? mobileLabelKey;

  String label(BuildContext context) => labelKey.resolve(context);
  String? mobileLabel(BuildContext context) => mobileLabelKey?.resolve(context);
}

enum SupplierNavLabelKey {
  overview,
  home,
  myMaterials,
  materialsShort,
  addMaterial,
  addShort,
  incomingRequests,
  requestsShort,
  pickupSchedule,
  browseMaterials,
  notifications,
  profile;

  String resolve(BuildContext context) {
    final l = context.s;
    return switch (this) {
      SupplierNavLabelKey.overview => l.navOverview,
      SupplierNavLabelKey.home => l.navHome,
      SupplierNavLabelKey.myMaterials => l.navMyMaterials,
      SupplierNavLabelKey.materialsShort => l.navMaterialsShort,
      SupplierNavLabelKey.addMaterial => l.navAddMaterial,
      SupplierNavLabelKey.addShort => l.navAddShort,
      SupplierNavLabelKey.incomingRequests => l.navIncomingRequests,
      SupplierNavLabelKey.requestsShort => l.navRequestsShort,
      SupplierNavLabelKey.pickupSchedule => l.navPickupSchedule,
      SupplierNavLabelKey.browseMaterials => l.navBrowseMaterials,
      SupplierNavLabelKey.notifications => l.navNotifications,
      SupplierNavLabelKey.profile => l.navProfile,
    };
  }
}

const supplierNavItems = [
  SupplierNavItem(
    labelKey: SupplierNavLabelKey.overview,
    route: '/supplier',
    icon: Icons.dashboard_outlined,
    mobileLabelKey: SupplierNavLabelKey.home,
  ),
  SupplierNavItem(
    labelKey: SupplierNavLabelKey.myMaterials,
    route: '/supplier/materials',
    icon: Icons.inventory_2_outlined,
    mobileLabelKey: SupplierNavLabelKey.materialsShort,
  ),
  SupplierNavItem(
    labelKey: SupplierNavLabelKey.addMaterial,
    route: '/supplier/materials/new',
    icon: Icons.add_circle_outline,
    mobileLabelKey: SupplierNavLabelKey.addShort,
  ),
  SupplierNavItem(
    labelKey: SupplierNavLabelKey.incomingRequests,
    route: '/supplier/reservations',
    icon: Icons.inbox_outlined,
    mobileLabelKey: SupplierNavLabelKey.requestsShort,
  ),
  SupplierNavItem(
    labelKey: SupplierNavLabelKey.pickupSchedule,
    route: '/supplier/pickup-schedule',
    icon: Icons.local_shipping_outlined,
  ),
  SupplierNavItem(
    labelKey: SupplierNavLabelKey.browseMaterials,
    route: '/materials',
    icon: Icons.search,
  ),
  SupplierNavItem(
    labelKey: SupplierNavLabelKey.notifications,
    route: '/supplier/notifications',
    icon: Icons.notifications_none_rounded,
  ),
  SupplierNavItem(
    labelKey: SupplierNavLabelKey.profile,
    route: '/supplier/profile',
    icon: Icons.person_outline,
    mobileLabelKey: SupplierNavLabelKey.profile,
  ),
];

final supplierMobileNavItems = [
  supplierNavItems[0],
  supplierNavItems[1],
  supplierNavItems[2],
  supplierNavItems[3],
  supplierNavItems[7],
];

String supplierPageTitle(BuildContext context, String location) =>
    context.s.pageTitle(location);

String supplierPageSubtitle(BuildContext context, String location) =>
    context.s.pageSubtitle(location);

bool isSupplierNavActive(String currentLocation, String route) {
  if (route == '/supplier/materials/new') {
    return currentLocation == '/supplier/materials/new';
  }

  if (route == '/supplier/materials') {
    return currentLocation == '/supplier/materials' ||
        (currentLocation.startsWith('/supplier/materials/') &&
            !currentLocation.startsWith('/supplier/materials/new'));
  }

  if (route == '/supplier') {
    return currentLocation == '/supplier' || currentLocation == '/supplier/';
  }

  return currentLocation == route || currentLocation.startsWith('$route/');
}
