import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

abstract class AppSettingsStorage {
  Future<ThemeMode?> readThemeMode();
  Future<void> saveThemeMode(ThemeMode themeMode);
}

class SecureAppSettingsStorage implements AppSettingsStorage {
  SecureAppSettingsStorage(this._storage);

  static const _themeModeKey = 'impactloop_theme_mode';

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
}

class MemoryAppSettingsStorage implements AppSettingsStorage {
  ThemeMode? _themeMode;

  @override
  Future<ThemeMode?> readThemeMode() async => _themeMode;

  @override
  Future<void> saveThemeMode(ThemeMode themeMode) async {
    _themeMode = themeMode;
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
