import '../../../auth/application/auth_route_helpers.dart';
import '../../../notifications/application/notifications_routes.dart';

bool isDriverActivePath(String path) =>
    path == '/driver/active' || path.startsWith('/driver/deliveries/');

bool isDriverHistoryPath(String path) =>
    path == '/driver/incidents' || path.startsWith('/driver/history');

bool isDriverMorePath(String path) =>
    path == '/driver/profile' ||
    isDriverNotificationsPath(path) ||
    path == accountSettingsRoute;

/// Bottom nav selected index for primary destinations (0–3), or 4 for More routes.
int driverMobileNavSelectedIndex(String path) {
  if (isDriverMorePath(path)) {
    return 4;
  }
  if (path == '/driver/jobs') {
    return 1;
  }
  if (isDriverActivePath(path)) {
    return 2;
  }
  if (isDriverHistoryPath(path)) {
    return 3;
  }
  return 0;
}
