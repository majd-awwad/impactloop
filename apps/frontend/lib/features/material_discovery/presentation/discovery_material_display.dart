import '../../../shared/models/localized_text.dart';

/// Defensive display helpers for discovery materials.
class DiscoveryMaterialDisplay {
  const DiscoveryMaterialDisplay._();

  static bool isInternalDescriptionLine(String line) {
    final trimmed = line.trim();
    if (trimmed.isEmpty) {
      return true;
    }

    final lower = trimmed.toLowerCase();
    if (lower.startsWith('[my-materials-seed]')) {
      return true;
    }
    if (RegExp(r'^key:\s*', caseSensitive: false).hasMatch(trimmed)) {
      return true;
    }
    if (lower.startsWith('[seed]') || lower.startsWith('[seed-')) {
      return true;
    }

    return false;
  }

  static String sanitizePublicDescription(String raw) {
    final cleaned = <String>[];

    for (final line in raw.split('\n')) {
      if (isInternalDescriptionLine(line)) {
        continue;
      }

      final normalized = line.trim();
      if (normalized.isNotEmpty) {
        cleaned.add(normalized);
      }
    }

    return cleaned.join('\n').trim();
  }

  static String sanitizedDescriptionOrFallback(
    String raw, {
    String fallback = 'No description available.',
  }) {
    final cleaned = sanitizePublicDescription(raw);
    return cleaned.isEmpty ? fallback : cleaned;
  }

  static LocalizedText displayDescription(LocalizedText description) {
    return LocalizedText(
      en: sanitizedDescriptionOrFallback(description.en),
      ar: sanitizedDescriptionOrFallback(description.ar),
    );
  }

  static bool hasDisplayDescription(LocalizedText description) {
    return sanitizePublicDescription(description.en).isNotEmpty ||
        sanitizePublicDescription(description.ar).isNotEmpty;
  }
}
