import '../data/models/user.dart';

const supplierPortalRoute = '/supplier';
const homeRoute = '/home';

bool userHasRole(User? user, String role) {
  if (user == null) {
    return false;
  }

  final normalizedRole = role.trim().toUpperCase();
  return user.roles.any((item) => item.trim().toUpperCase() == normalizedRole);
}

bool userHasSupplierRole(User? user) => userHasRole(user, 'SUPPLIER');

String postAuthRouteForUser(User user) {
  return userHasSupplierRole(user) ? supplierPortalRoute : homeRoute;
}
