import '../data/models/user.dart';
import '../../supplier_portal/application/supplier_verification_access.dart';

const rootRoute = '/';
const loginRoute = '/login';
const registerRoute = '/register';
const authCheckingRoute = '/auth/checking';
const supplierPortalRoute = '/supplier';
const driverPortalRoute = '/driver/jobs';
const adminPortalRoute = '/admin';
const inviteAcceptRoute = '/invite/accept';
const homeRoute = '/home';

bool userHasRole(User? user, String role) {
  if (user == null) {
    return false;
  }

  final normalizedRole = role.trim().toUpperCase();
  return user.roles.any((item) => item.trim().toUpperCase() == normalizedRole);
}

bool userHasSupplierRole(User? user) => userHasRole(user, 'SUPPLIER');

bool userHasDriverRole(User? user) => userHasRole(user, 'DRIVER');

bool userHasAdminRole(User? user) => userHasRole(user, 'ADMIN');

String postAuthRouteForUser(User user) {
  if (userHasAdminRole(user)) {
    return adminPortalRoute;
  }

  if (userHasSupplierRole(user)) {
    final gate = supplierVerificationGateRoute(
      supplierType: user.supplierProfile?.supplierType,
      verificationStatus: user.supplierProfile?.verificationStatus,
    );
    if (gate != null) {
      return gate;
    }
    return supplierPortalRoute;
  }

  if (userHasDriverRole(user)) {
    return driverPortalRoute;
  }

  if (userHasRole(user, 'MODERATOR')) {
    return homeRoute;
  }

  return homeRoute;
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
      path == registerRoute) {
    return fallback;
  }

  return uri.toString();
}
