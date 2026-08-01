import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

abstract class AppSettingsStorage {
  Future<ThemeMode?> readThemeMode();
  Future<void> saveThemeMode(ThemeMode themeMode);
  Future<String?> readLanguageCode();
  Future<void> saveLanguageCode(String languageCode);
}

class SecureAppSettingsStorage implements AppSettingsStorage {
  SecureAppSettingsStorage(this._storage);

  static const _themeModeKey = 'impactloop_theme_mode';
  static const _languageCodeKey = 'impactloop_language_code';

  final FlutterSecureStorage _storage;

  @override
  Future<ThemeMode?> readThemeMode() async {
    try {
      final storedValue = await _storage.read(key: _themeModeKey);
      return switch (storedValue) {
        'light' => ThemeMode.light,
        'dark' => ThemeMode.dark,
        'system' => ThemeMode.system,
        _ => null,
      };
    } catch (_) {
      return null;
    }
  }

  @override
  Future<void> saveThemeMode(ThemeMode themeMode) async {
    try {
      await _storage.write(key: _themeModeKey, value: themeMode.name);
    } catch (_) {
      // Settings persistence is best-effort so tests and restricted platforms
      // can still use in-memory theme state.
    }
  }

  @override
  Future<String?> readLanguageCode() async {
    try {
      return await _storage.read(key: _languageCodeKey);
    } catch (_) {
      return null;
    }
  }

  @override
  Future<void> saveLanguageCode(String languageCode) async {
    try {
      await _storage.write(key: _languageCodeKey, value: languageCode);
    } catch (_) {}
  }
}

class MemoryAppSettingsStorage implements AppSettingsStorage {
  ThemeMode? _themeMode;
  String? _languageCode;

  @override
  Future<ThemeMode?> readThemeMode() async => _themeMode;

  @override
  Future<void> saveThemeMode(ThemeMode themeMode) async {
    _themeMode = themeMode;
  }

  @override
  Future<String?> readLanguageCode() async => _languageCode;

  @override
  Future<void> saveLanguageCode(String languageCode) async {
    _languageCode = languageCode;
  }
}

AppSettingsStorage createAppSettingsStorage() {
  final bindingName = WidgetsBinding.instance.runtimeType.toString();
  if (bindingName.contains('Test')) {
    return MemoryAppSettingsStorage();
  }

  if (kIsWeb) {
    return SecureAppSettingsStorage(const FlutterSecureStorage());
  }

  return SecureAppSettingsStorage(
    const FlutterSecureStorage(
      aOptions: AndroidOptions(encryptedSharedPreferences: true),
    ),
  );
}
