import '../data/models/user.dart';
import '../../supplier_portal/application/supplier_verification_gate.dart';
import '../../../l10n/app_localizations.dart';
import 'auth_route_helpers.dart';

bool userHasRestrictedStaffRole(User user) {
  return user.hasRole('ADMIN') ||
      user.hasRole('MODERATOR') ||
      user.hasRole('DRIVER');
}

bool shouldShowBecomeSupplier(User user) {
  if (userHasRestrictedStaffRole(user)) {
    return false;
  }

  if (!user.hasRole('LEARNER')) {
    return false;
  }

  if (user.hasRole('SUPPLIER') || user.supplierProfile != null) {
    return false;
  }

  return user.isLearnerMode;
}

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

String profileRouteForActiveRole(User user) {
  if (user.isLearnerMode && user.hasRole('LEARNER')) {
    return profileRoute;
  }

  if (user.isSupplierMode && user.hasRole('SUPPLIER')) {
    return supplierEntryRouteForUser(user);
  }

  return portalRouteForActiveRole(user);
}

String? activeLearnerProfileRedirect(User user) {
  if (user.isLearnerMode && user.hasRole('LEARNER')) {
    return null;
  }

  return profileRouteForActiveRole(user);
}

String oppositePortalSwitchRoute(User user, String targetRole) {
  final normalized = targetRole.trim().toUpperCase();
  if (normalized == 'SUPPLIER') {
    return supplierOverviewRoute;
  }
  return homeRoute;
}

String activePortalModeLabel(User user, AppLocalizations l10n) {
  final role = user.activeRole.trim().toUpperCase();
  switch (role) {
    case 'SUPPLIER':
      return l10n.supplierMode;
    case 'DRIVER':
      return l10n.driverMode;
    case 'ADMIN':
      return l10n.adminMode;
    case 'MODERATOR':
      return l10n.moderatorMode;
    case 'LEARNER':
    default:
      return l10n.learnerMode;
  }
}

bool shouldShowSwitchToLearner(User user) =>
    user.isSupplierMode && user.canSwitchToLearner;

bool shouldShowBecomeLearner(User user) =>
    user.isSupplierMode && user.canBecomeLearner;

bool shouldShowSwitchToSupplier(User user) =>
    user.isLearnerMode && user.canSwitchToSupplier;

/// Centralized supplier-entry policy used by learner home and other portals.
enum SupplierEntryDestination {
  /// Learner lacks supplier role/profile — send to become-supplier / register.
  onboarding,

  /// Supplier-capable but currently in learner mode — switch portal first.
  switchToSupplierPortal,

  /// Already in supplier mode — open supplier overview.
  supplierOverview,
}

SupplierEntryDestination resolveSupplierEntryDestination(User? user) {
  if (user != null &&
      (user.hasRole('SUPPLIER') || user.supplierProfile != null)) {
    if (user.isSupplierMode) {
      return SupplierEntryDestination.supplierOverview;
    }
    return SupplierEntryDestination.switchToSupplierPortal;
  }

  return SupplierEntryDestination.onboarding;
}

bool isOrganizationSupplierWithoutLearnerSwitch(User user) {
  if (user.canSwitchToLearner || user.canBecomeLearner) {
    return false;
  }

  if (!user.isSupplierMode || !user.hasRole('SUPPLIER')) {
    return false;
  }

  return isOrganizationSupplierType(user.supplierProfile?.supplierType);
}
