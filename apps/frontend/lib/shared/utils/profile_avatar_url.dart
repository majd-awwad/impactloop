/// Helpers for user/supplier profile avatar URLs.
///
/// Seed/demo data may store DiceBear placeholder URLs. Those should not be
/// fetched on the client; use local initials avatars instead.
bool isGeneratedProfileAvatarUrl(String? url) {
  final trimmed = url?.trim() ?? '';
  if (trimmed.isEmpty) {
    return false;
  }

  final lower = trimmed.toLowerCase();
  if (lower.contains('api.dicebear.com')) {
    return true;
  }

  final host = Uri.tryParse(trimmed)?.host.toLowerCase() ?? '';
  return host.contains('dicebear.com');
}

/// Returns a trimmed profile image URL when it points to a real uploaded image.
String? effectiveProfileAvatarUrl(String? url) {
  final trimmed = url?.trim() ?? '';
  if (trimmed.isEmpty || isGeneratedProfileAvatarUrl(trimmed)) {
    return null;
  }

  return trimmed;
}
