import 'package:flutter/foundation.dart';

import 'external_document.dart';

class ApiConfig {
  const ApiConfig._();

  static const _configuredBaseUrl = String.fromEnvironment('API_BASE_URL');

  static String get baseUrl {
    if (_configuredBaseUrl.isNotEmpty) {
      return _configuredBaseUrl;
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

  static String resolveMediaUrl(String url) {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }

    if (url.startsWith('/')) {
      return '$baseUrl$url';
    }

    return '$baseUrl/$url';
  }

  static void openExternalDocument(String url) {
    final resolved = resolveMediaUrl(url);

    if (kIsWeb) {
      openExternalDocumentUrl(resolved);
    }
  }
}
