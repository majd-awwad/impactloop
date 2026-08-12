/// Lightweight local format check for ImpactLoop pickup QR payloads.
///
/// Cryptographic validation remains on the backend.
bool looksLikeImpactLoopPickupQr(String raw) {
  final trimmed = raw.trim();
  if (trimmed.isEmpty) return false;

  const prefix = 'impactloop://handover/';
  if (trimmed.toLowerCase().startsWith(prefix)) {
    final token = trimmed.substring(prefix.length).trim();
    return _isPlausibleOpaqueToken(token);
  }

  // Raw opaque token (without URI prefix) is also accepted by the backend.
  return _isPlausibleOpaqueToken(trimmed);
}

bool _isPlausibleOpaqueToken(String token) {
  if (token.length < 16 || token.length > 256) return false;
  if (RegExp(r'[/\\\s?]').hasMatch(token)) return false;
  return true;
}
