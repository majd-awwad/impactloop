import 'package:flutter/foundation.dart';

import 'external_document.dart';

class ApiConfig {
  const ApiConfig._();

  static const _configuredBaseUrl = String.fromEnvironment('API_BASE_URL');

  /// Web release builds may omit [API_BASE_URL] when the API is served from the
  /// same origin via a reverse proxy (e.g. nginx proxies `/api` to the backend).
  static const _useSameOriginApi = bool.fromEnvironment(
    'API_USE_SAME_ORIGIN',
    defaultValue: false,
  );

  static String get baseUrl {
    final configured = _configuredBaseUrl.trim();
    if (configured.isNotEmpty) {
      return _stripTrailingSlash(configured);
    }

    if (kReleaseMode) {
      if (kIsWeb && _useSameOriginApi) {
        return _webSameOriginBaseUrl();
      }

      throw StateError(
        'API_BASE_URL must be set for release builds. '
        'Example: flutter build web --dart-define=API_BASE_URL=https://api.example.com. '
        'For same-origin reverse-proxy web deployments, pass '
        '--dart-define=API_USE_SAME_ORIGIN=true instead.',
      );
    }

    if (kIsWeb) {
      final currentUri = Uri.base;
      final scheme = currentUri.scheme.isNotEmpty ? currentUri.scheme : 'http';
      final host = currentUri.host.isNotEmpty ? currentUri.host : 'localhost';

      return '$scheme://$host:4000';
    }

    if (defaultTargetPlatform == TargetPlatform.android) {
      return 'http://10.0.2.2:4000';
    }

    return 'http://localhost:4000';
  }

  /// Scheme + host + port of [baseUrl], without an `/api` path prefix.
  ///
  /// Static assets such as `/demo-assets/...` and `/uploads/...` are served
  /// from the backend origin, not under the API prefix.
  static Uri get backendOrigin => backendOriginFrom(baseUrl);

  static String _webSameOriginBaseUrl() {
    final origin = Uri.base.origin;
    if (origin.isEmpty || Uri.base.host.isEmpty) {
      throw StateError(
        'Cannot resolve same-origin API base URL: page origin is empty.',
      );
    }

    return origin;
  }

  static String _stripTrailingSlash(String url) {
    return url.endsWith('/') ? url.substring(0, url.length - 1) : url;
  }

  @visibleForTesting
  static Uri backendOriginFrom(String baseUrl) {
    final apiUri = Uri.parse(_stripTrailingSlash(baseUrl.trim()));
    return Uri(
      scheme: apiUri.scheme,
      host: apiUri.host,
      port: apiUri.hasPort ? apiUri.port : null,
    );
  }

  /// Converts a backend-provided asset path into a URL [Image.network] can load.
  ///
  /// Returns `null` for null/blank values so callers can show a fallback.
  static String? resolveApiAssetUrl(String? value) {
    final trimmed = value?.trim();
    if (trimmed == null || trimmed.isEmpty) {
      return null;
    }
    return resolveMediaUrl(trimmed);
  }

  static String resolveMediaUrl(String url) {
    return resolveMediaUrlAgainst(baseUrl, url);
  }

  @visibleForTesting
  static String resolveMediaUrlAgainst(String baseUrl, String url) {
    final trimmed = url.trim();
    if (trimmed.isEmpty) {
      return trimmed;
    }

    final parsed = Uri.tryParse(trimmed);
    if (parsed != null &&
        parsed.hasScheme &&
        (parsed.scheme == 'http' || parsed.scheme == 'https') &&
        parsed.host.isNotEmpty) {
      return trimmed;
    }

    final path = trimmed.startsWith('/') ? trimmed : '/$trimmed';
    return backendOriginFrom(baseUrl).resolve(path).toString();
  }

  static void openExternalDocument(String url) {
    final resolved = resolveMediaUrl(url);

    if (kIsWeb) {
      openExternalDocumentUrl(resolved);
    }
  }
}
