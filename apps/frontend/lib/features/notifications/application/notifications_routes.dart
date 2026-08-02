import '../../auth/data/models/user.dart';

const driverNotificationsRoute = '/driver/notifications';
const supplierNotificationsRoute = '/supplier/notifications';
const sharedNotificationsRoute = '/notifications';

/// Roles that have a supported notification inbox in the product.
bool userSupportsNotificationInbox(User? user) {
  if (user == null) {
    return false;
  }

  if (user.isSupplierMode && user.hasRole('SUPPLIER')) {
    return true;
  }

  if (user.isDriverMode && user.hasRole('DRIVER')) {
    return true;
  }

  if (user.isLearnerMode && user.hasRole('LEARNER')) {
    return true;
  }

  return false;
}

String notificationInboxRouteForUser(User? user) {
  if (user != null && user.isSupplierMode && user.hasRole('SUPPLIER')) {
    return supplierNotificationsRoute;
  }

  if (user != null && user.isDriverMode && user.hasRole('DRIVER')) {
    return driverNotificationsRoute;
  }

  return sharedNotificationsRoute;
}

String notificationsRouteForUser(User? user) =>
    notificationInboxRouteForUser(user);

bool isDriverNotificationsPath(String path) {
  return path == driverNotificationsRoute;
}
