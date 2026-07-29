import '../../auth/data/models/user.dart';

const driverNotificationsRoute = '/driver/notifications';
const supplierNotificationsRoute = '/supplier/notifications';
const sharedNotificationsRoute = '/notifications';

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
