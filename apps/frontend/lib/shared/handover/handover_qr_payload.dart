/// Shared URI parser for ImpactLoop handover QR payloads.
///
/// Local parsing is format validation only. Server verification remains
/// authoritative, and this type never logs the raw token.
enum HandoverQrType {
  reservationPickup,
  deliveryHandover,
  supplierDriverPickup,
}

class ParsedHandoverQr {
  const ParsedHandoverQr({
    required this.type,
    required this.token,
    required this.rawPayload,
  });

  final HandoverQrType type;
  final String token;
  final String rawPayload;

  String get host => handoverQrHostForType(type);
}

const handoverQrScheme = 'impactloop';

const handoverQrHostReservationPickup = 'handover';
const handoverQrHostDeliveryHandover = 'delivery-handover';
const handoverQrHostSupplierDriverPickup = 'supplier-pickup-handover';

const handoverQrTypeQueryReservationPickup = 'reservationPickup';
const handoverQrTypeQueryDeliveryHandover = 'deliveryHandover';
const handoverQrTypeQuerySupplierDriverPickup = 'supplierDriverPickup';

String handoverQrHostForType(HandoverQrType type) {
  switch (type) {
    case HandoverQrType.reservationPickup:
      return handoverQrHostReservationPickup;
    case HandoverQrType.deliveryHandover:
      return handoverQrHostDeliveryHandover;
    case HandoverQrType.supplierDriverPickup:
      return handoverQrHostSupplierDriverPickup;
  }
}

String handoverQrTypeQueryValue(HandoverQrType type) {
  switch (type) {
    case HandoverQrType.reservationPickup:
      return handoverQrTypeQueryReservationPickup;
    case HandoverQrType.deliveryHandover:
      return handoverQrTypeQueryDeliveryHandover;
    case HandoverQrType.supplierDriverPickup:
      return handoverQrTypeQuerySupplierDriverPickup;
  }
}

HandoverQrType? handoverQrTypeFromHost(String host) {
  switch (host.trim().toLowerCase()) {
    case handoverQrHostReservationPickup:
      return HandoverQrType.reservationPickup;
    case handoverQrHostDeliveryHandover:
      return HandoverQrType.deliveryHandover;
    case handoverQrHostSupplierDriverPickup:
      return HandoverQrType.supplierDriverPickup;
    default:
      return null;
  }
}

HandoverQrType? handoverQrTypeFromQueryValue(String? value) {
  switch (value?.trim()) {
    case handoverQrTypeQueryReservationPickup:
      return HandoverQrType.reservationPickup;
    case handoverQrTypeQueryDeliveryHandover:
      return HandoverQrType.deliveryHandover;
    case handoverQrTypeQuerySupplierDriverPickup:
      return HandoverQrType.supplierDriverPickup;
    default:
      return null;
  }
}

String buildHandoverQrPayload(HandoverQrType type, String token) {
  return '$handoverQrScheme://${handoverQrHostForType(type)}/$token';
}

/// Opaque-token plausibility used by in-app scanners.
///
/// Deep-link URI parsing is separate and only checks structure.
bool isPlausibleHandoverQrToken(String token) {
  if (token.length < 16 || token.length > 256) return false;
  if (RegExp(r'[/\\\s?]').hasMatch(token)) return false;
  return true;
}

ParsedHandoverQr? parseHandoverQr(String raw) {
  final trimmed = raw.trim();
  if (trimmed.isEmpty) return null;
  final uri = Uri.tryParse(trimmed);
  if (uri == null) return null;
  return parseHandoverQrUri(uri, rawPayload: trimmed);
}

ParsedHandoverQr? parseHandoverQrUri(Uri uri, {String? rawPayload}) {
  if (uri.scheme.toLowerCase() != handoverQrScheme) return null;
  if (uri.hasPort || uri.userInfo.isNotEmpty) return null;
  if (uri.hasQuery || uri.hasFragment) return null;

  final type = handoverQrTypeFromHost(uri.host);
  if (type == null) return null;

  final path = uri.path;
  if (!path.startsWith('/') || path.length < 2) return null;

  final token = path.substring(1);
  if (token.isEmpty || token.contains('/')) return null;

  return ParsedHandoverQr(
    type: type,
    token: token,
    rawPayload: rawPayload ?? uri.toString(),
  );
}

ParsedHandoverQr? parseHandoverQrFromQuery(Map<String, String> query) {
  final type = handoverQrTypeFromQueryValue(query['type']);
  final token = query['token'] ?? '';
  if (type == null || token.isEmpty) return null;
  if (token.contains('/')) return null;
  return ParsedHandoverQr(
    type: type,
    token: token,
    rawPayload: buildHandoverQrPayload(type, token),
  );
}

bool looksLikeHandoverQr({
  required String raw,
  required HandoverQrType type,
}) {
  final trimmed = raw.trim();
  if (trimmed.isEmpty) return false;

  final parsed = parseHandoverQr(trimmed);
  if (parsed != null) {
    return parsed.type == type && isPlausibleHandoverQrToken(parsed.token);
  }

  return isPlausibleHandoverQrToken(trimmed);
}
