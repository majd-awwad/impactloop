import 'package:flutter/material.dart';

class SupplierNavItem {
  const SupplierNavItem({
    required this.label,
    required this.route,
    required this.icon,
    this.mobileLabel,
  });

  final String label;
  final String route;
  final IconData icon;
  final String? mobileLabel;
}

const supplierNavItems = [
  SupplierNavItem(
    label: 'Overview',
    route: '/supplier',
    icon: Icons.dashboard_outlined,
    mobileLabel: 'Home',
  ),
  SupplierNavItem(
    label: 'My Materials',
    route: '/supplier/materials',
    icon: Icons.inventory_2_outlined,
    mobileLabel: 'Materials',
  ),
  SupplierNavItem(
    label: 'Add Material',
    route: '/supplier/materials/new',
    icon: Icons.add_circle_outline,
    mobileLabel: 'Add',
  ),
  SupplierNavItem(
    label: 'Incoming Requests',
    route: '/supplier/reservations',
    icon: Icons.inbox_outlined,
    mobileLabel: 'Requests',
  ),
  SupplierNavItem(
    label: 'Pickup Schedule',
    route: '/supplier/pickup-schedule',
    icon: Icons.local_shipping_outlined,
  ),
  SupplierNavItem(
    label: 'Browse Materials',
    route: '/materials',
    icon: Icons.search,
  ),
  SupplierNavItem(
    label: 'Notifications',
    route: '/supplier/notifications',
    icon: Icons.notifications_none_rounded,
  ),
  SupplierNavItem(
    label: 'Profile',
    route: '/supplier/profile',
    icon: Icons.person_outline,
    mobileLabel: 'Profile',
  ),
];

final supplierMobileNavItems = [
  supplierNavItems[0],
  supplierNavItems[1],
  supplierNavItems[2],
  supplierNavItems[3],
  supplierNavItems[7],
];

String supplierPageTitle(String location) {
  if (location == '/supplier' || location == '/supplier/') {
    return 'Overview';
  }

  if (location == '/supplier/profile') {
    return 'Supplier Profile';
  }

  for (final item in supplierNavItems) {
    if (location == item.route || location.startsWith('${item.route}/')) {
      return item.label;
    }
  }

  return 'Supplier Portal';
}

String supplierPageSubtitle(String location) {
  if (location == '/supplier' || location == '/supplier/') {
    return 'Track materials, requests, and impact.';
  }

  if (location == '/supplier/profile') {
    return 'Manage public supplier details and pickup location.';
  }

  for (final item in supplierNavItems) {
    if (location == item.route || location.startsWith('${item.route}/')) {
      return 'Coming soon in the Supplier Portal.';
    }
  }

  return 'Manage your supplier activity.';
}

bool isSupplierNavActive(String currentLocation, String route) {
  if (route == '/supplier') {
    return currentLocation == '/supplier' || currentLocation == '/supplier/';
  }

  return currentLocation == route || currentLocation.startsWith('$route/');
}
