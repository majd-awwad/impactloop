import '../data/models/user.dart';
import '../../supplier_portal/application/supplier_verification_gate.dart';
import 'auth_route_helpers.dart';
import 'portal_navigation.dart';

export 'auth_route_helpers.dart';
export 'portal_navigation.dart';

String postAuthRouteForUser(User user) {
  if (userHasAdminRole(user) && user.activeRole.trim().toUpperCase() == 'ADMIN') {
    return adminPortalRoute;
  }

  if (userHasDriverRole(user) && user.activeRole.trim().toUpperCase() == 'DRIVER') {
    return driverPortalRoute;
  }

  if (user.isSupplierMode && userHasSupplierRole(user)) {
    final gate = supplierVerificationGateRoute(
      supplierType: user.supplierProfile?.supplierType,
      verificationStatus: user.supplierProfile?.verificationStatus,
    );
    if (gate != null) {
      return gate;
    }
    return supplierOverviewRoute;
  }

  if (userHasRole(user, 'MODERATOR')) {
    return homeRoute;
  }

  return portalRouteForActiveRole(user);
}

String sanitizeRedirectTarget(String? from, {String fallback = rootRoute}) {
  final candidate = from?.trim();
  if (candidate == null || candidate.isEmpty) {
    return fallback;
  }

  if (!candidate.startsWith('/') || candidate.startsWith('//')) {
    return fallback;
  }

  final uri = Uri.tryParse(candidate);
  if (uri == null || uri.hasScheme || uri.host.isNotEmpty) {
    return fallback;
  }

  final path = uri.path;
  if (!path.startsWith('/') || path.isEmpty) {
    return fallback;
  }

  if (path == authCheckingRoute ||
      path == loginRoute ||
      path == registerRoute ||
      path == forgotPasswordRoute ||
      path == resetPasswordRoute) {
    return fallback;
  }

  return uri.toString();
}
