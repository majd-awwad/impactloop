/// Lightweight local format check for ImpactLoop supplier pickup handover QR payloads.
bool looksLikeImpactLoopSupplierPickupHandoverQr(String raw) {
  final trimmed = raw.trim();
  if (trimmed.isEmpty) return false;

  const prefix = 'impactloop://supplier-pickup-handover/';
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
