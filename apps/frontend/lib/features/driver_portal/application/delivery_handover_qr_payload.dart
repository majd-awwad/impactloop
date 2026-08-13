/// Lightweight local format check for ImpactLoop delivery handover QR payloads.
bool looksLikeImpactLoopDeliveryHandoverQr(String raw) {
  final trimmed = raw.trim();
  if (trimmed.isEmpty) return false;

  const prefix = 'impactloop://delivery-handover/';
  if (trimmed.toLowerCase().startsWith(prefix)) {
    final token = trimmed.substring(prefix.length).trim();
    return _isPlausibleOpaqueToken(token);
  }

  return _isPlausibleOpaqueToken(trimmed);
}

bool _isPlausibleOpaqueToken(String token) {
  if (token.length < 16 || token.length > 256) return false;
  if (RegExp(r'[/\\\s?]').hasMatch(token)) return false;
  return true;
}
