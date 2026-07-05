import '../data/models/user.dart';
import '../../supplier_portal/application/supplier_verification_gate.dart';
import 'auth_route_helpers.dart';

String portalRouteForActiveRole(User user) {
  final activeRole = user.activeRole.trim().toUpperCase();

  if (activeRole == 'ADMIN' && user.hasRole('ADMIN')) {
    return adminPortalRoute;
  }

  if (activeRole == 'DRIVER' && user.hasRole('DRIVER')) {
    return driverPortalRoute;
  }

  if (activeRole == 'SUPPLIER' && user.hasRole('SUPPLIER')) {
    return supplierOverviewRoute;
  }

  if (user.defaultPortalRoute.trim().isNotEmpty) {
    return user.defaultPortalRoute;
  }

  return homeRoute;
}

String oppositePortalSwitchRoute(User user, String targetRole) {
  final normalized = targetRole.trim().toUpperCase();
  if (normalized == 'SUPPLIER') {
    return supplierOverviewRoute;
  }
  return homeRoute;
}

String activePortalModeLabel(User user) {
  return user.isSupplierMode ? 'Supplier mode' : 'Learner mode';
}

bool shouldShowSwitchToLearner(User user) =>
    user.isSupplierMode && user.canSwitchToLearner;

bool shouldShowSwitchToSupplier(User user) =>
    user.isLearnerMode && user.canSwitchToSupplier;

bool isOrganizationSupplierWithoutLearnerSwitch(User user) {
  if (user.canSwitchToLearner) {
    return false;
  }

  if (!user.isSupplierMode || !user.hasRole('SUPPLIER')) {
    return false;
  }

  return isOrganizationSupplierType(user.supplierProfile?.supplierType);
}
