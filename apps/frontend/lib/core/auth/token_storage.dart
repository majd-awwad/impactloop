import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

abstract class TokenStorage {
  Future<void> saveRefreshToken(String refreshToken);
  Future<String?> readRefreshToken();
  Future<void> clearRefreshToken();
}

class WebCookieTokenStorage implements TokenStorage {
  @override
  Future<void> clearRefreshToken() async {}

  @override
  Future<String?> readRefreshToken() async => null;

  @override
  Future<void> saveRefreshToken(String refreshToken) async {}
}

class SecureTokenStorage implements TokenStorage {
  SecureTokenStorage(this._storage);

  static const _refreshTokenKey = 'impactloop_refresh_token';

  final FlutterSecureStorage _storage;

  @override
  Future<void> clearRefreshToken() {
    return _storage.delete(key: _refreshTokenKey);
  }

  @override
  Future<String?> readRefreshToken() {
    return _storage.read(key: _refreshTokenKey);
  }

  @override
  Future<void> saveRefreshToken(String refreshToken) {
    return _storage.write(key: _refreshTokenKey, value: refreshToken);
  }
}

TokenStorage createTokenStorage() {
  if (kIsWeb) {
    return WebCookieTokenStorage();
  }

  return SecureTokenStorage(
    const FlutterSecureStorage(
      aOptions: AndroidOptions(encryptedSharedPreferences: true),
    ),
  );
}
