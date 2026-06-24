import '../data/models/user.dart';

const rootRoute = '/';
const loginRoute = '/login';
const registerRoute = '/register';
const authCheckingRoute = '/auth/checking';
const supplierPortalRoute = '/supplier';
const adminPortalRoute = '/admin';
const homeRoute = '/home';

bool userHasRole(User? user, String role) {
  if (user == null) {
    return false;
  }

  final normalizedRole = role.trim().toUpperCase();
  return user.roles.any((item) => item.trim().toUpperCase() == normalizedRole);
}

bool userHasSupplierRole(User? user) => userHasRole(user, 'SUPPLIER');

bool userHasAdminRole(User? user) => userHasRole(user, 'ADMIN');

String postAuthRouteForUser(User user) {
  if (userHasAdminRole(user)) {
    return adminPortalRoute;
  }

  if (userHasSupplierRole(user)) {
    return supplierPortalRoute;
  }

  if (userHasRole(user, 'DRIVER')) {
    return homeRoute;
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
