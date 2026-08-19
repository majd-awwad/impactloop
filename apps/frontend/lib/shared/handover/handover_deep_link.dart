import '../../features/auth/application/auth_route_helpers.dart';
import '../../features/auth/data/models/user.dart';
import 'handover_qr_payload.dart';

const handoverEntryRoute = '/handover-entry';

String handoverEntryLocation(ParsedHandoverQr parsed) {
  return Uri(
    path: handoverEntryRoute,
    queryParameters: {
      'type': handoverQrTypeQueryValue(parsed.type),
      'token': parsed.token,
    },
  ).toString();
}

/// Rewrites an external custom-scheme URI onto a controlled app location.
///
/// Returns null when [uri] is not an ImpactLoop handover custom scheme.
String? normalizeHandoverDeepLink(Uri uri) {
  if (uri.scheme.toLowerCase() != handoverQrScheme) {
    return null;
  }

  final parsed = parseHandoverQrUri(uri);
  if (parsed == null) {
    return handoverEntryRoute;
  }
  return handoverEntryLocation(parsed);
}

ParsedHandoverQr? parsedHandoverQrFromUri(Uri uri) {
  final fromScheme = parseHandoverQrUri(uri);
  if (fromScheme != null) return fromScheme;
  if (uri.path == handoverEntryRoute) {
    return parseHandoverQrFromQuery(uri.queryParameters);
  }
  return null;
}

bool userCanProcessHandoverQr(User? user, HandoverQrType type) {
  if (user == null) return false;
  switch (type) {
    case HandoverQrType.reservationPickup:
      return userHasSupplierRole(user);
    case HandoverQrType.deliveryHandover:
    case HandoverQrType.supplierDriverPickup:
      return userHasDriverRole(user);
  }
}

String handoverCloseFallbackRoute(HandoverQrType type) {
  switch (type) {
    case HandoverQrType.reservationPickup:
      return supplierOverviewRoute;
    case HandoverQrType.deliveryHandover:
    case HandoverQrType.supplierDriverPickup:
      return driverPortalRoute;
  }
}

String handoverManualCodeFallbackRoute(HandoverQrType type) {
  switch (type) {
    case HandoverQrType.reservationPickup:
      return '/supplier/reservations';
    case HandoverQrType.deliveryHandover:
    case HandoverQrType.supplierDriverPickup:
      return '/driver/active';
  }
}

bool isHandoverEntryPath(String path) => path == handoverEntryRoute;
