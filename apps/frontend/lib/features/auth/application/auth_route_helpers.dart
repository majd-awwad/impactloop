import '../data/models/user.dart';

const rootRoute = '/';
const loginRoute = '/login';
const registerRoute = '/register';
const forgotPasswordRoute = '/forgot-password';
const resetPasswordRoute = '/reset-password';
const authCheckingRoute = '/auth/checking';
const supplierPortalRoute = '/supplier';
const supplierOverviewRoute = '/supplier/overview';
const learningHubRoute = '/learning';
const becomeSupplierRoute = '/become-supplier';
const becomeLearnerRoute = '/become-learner';
const supplierOnboardingRoute = becomeSupplierRoute;
const driverPortalRoute = '/driver/jobs';
const adminPortalRoute = '/admin';
const inviteAcceptRoute = '/invite/accept';
const homeRoute = '/home';
const profileRoute = '/profile';
const accountSettingsRoute = '/profile/account';
const learningProfileRoute = '/profile/learning';
const learnerProfileEditRoute = '/profile/learner/edit';
const learnerReservationsRoute = '/learner/reservations';
const learnerPaymentCheckoutRoutePrefix = '/learner/checkout';

/// Primary PAY-05D entry: reservation-scoped checkout.
String learnerReservationCheckoutRoute(String reservationId) =>
    '$learnerPaymentCheckoutRoutePrefix/reservation/$reservationId';

/// Legacy order-scoped path — prefer [learnerReservationCheckoutRoute].
String learnerPaymentCheckoutRoute(String orderId) =>
    '$learnerPaymentCheckoutRoutePrefix/$orderId';

String learnerReservationDetailRoute(
  String reservationId, {
  bool focusPayment = false,
  String? checkoutableOrderId,
}) {
  final q = <String, String>{};
  if (focusPayment) q['focus'] = 'payment';
  if (checkoutableOrderId != null && checkoutableOrderId.isNotEmpty) {
    q['orderId'] = checkoutableOrderId;
  }
  final uri = Uri(
    path: '/learner/reservations/$reservationId',
    queryParameters: q.isEmpty ? null : q,
  );
  return uri.toString();
}

const supplierProfileRoute = '/supplier/profile';

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

/// Route for the supplier entry CTA from home, onboarding, or public surfaces.
String supplierEntryRouteForUser(User? user) {
  if (user == null) {
    return '$registerRoute?intent=supplier';
  }

  if (userHasSupplierRole(user)) {
    return supplierProfileRoute;
  }

  return supplierOnboardingRoute;
}
