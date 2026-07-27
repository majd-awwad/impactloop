import '../../auth/data/models/user.dart';

const driverNotificationsRoute = '/driver/notifications';
const sharedNotificationsRoute = '/notifications';

String notificationsRouteForUser(User? user) {
  if (user != null && user.isDriverMode && user.hasRole('DRIVER')) {
    return driverNotificationsRoute;
  }

  return sharedNotificationsRoute;
}

bool isDriverNotificationsPath(String path) {
  return path == driverNotificationsRoute;
}
