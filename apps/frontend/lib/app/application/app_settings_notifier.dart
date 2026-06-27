import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app_settings_storage.dart';

class AppSettings {
  const AppSettings({required this.themeMode, required this.languageCode});

  final ThemeMode themeMode;
  final String languageCode;

  AppSettings copyWith({ThemeMode? themeMode, String? languageCode}) {
    return AppSettings(
      themeMode: themeMode ?? this.themeMode,
      languageCode: languageCode ?? this.languageCode,
    );
  }
}

class AppSettingsNotifier extends Notifier<AppSettings> {
  bool _loadedSettings = false;

  @override
  AppSettings build() {
    if (!_loadedSettings && !_isWidgetTestBinding()) {
      _loadedSettings = true;
      unawaited(_loadSettings());
    }

    return const AppSettings(themeMode: ThemeMode.system, languageCode: 'en');
  }

  void setThemeMode(ThemeMode themeMode) {
    state = state.copyWith(themeMode: themeMode);
    unawaited(ref.read(appSettingsStorageProvider).saveThemeMode(themeMode));
  }

  void setLanguageCode(String languageCode) {
    state = state.copyWith(languageCode: languageCode);
    unawaited(
      ref.read(appSettingsStorageProvider).saveLanguageCode(languageCode),
    );
  }

  Future<void> _loadSettings() async {
    final storage = ref.read(appSettingsStorageProvider);
    final storedThemeMode = await storage.readThemeMode();
    final storedLanguage = await storage.readLanguageCode();

    state = state.copyWith(
      themeMode: storedThemeMode ?? state.themeMode,
      languageCode: storedLanguage ?? state.languageCode,
    );
  }
}

bool _isWidgetTestBinding() {
  return WidgetsBinding.instance.runtimeType.toString().contains('Test');
}

final appSettingsStorageProvider = Provider<AppSettingsStorage>((ref) {
  return createAppSettingsStorage();
});

final appSettingsProvider = NotifierProvider<AppSettingsNotifier, AppSettings>(
  AppSettingsNotifier.new,
);

String themeModeLabel(ThemeMode mode) {
  return switch (mode) {
    ThemeMode.system => 'System',
    ThemeMode.light => 'Light',
    ThemeMode.dark => 'Dark',
  };
}

IconData themeModeIcon(ThemeMode mode) {
  return switch (mode) {
    ThemeMode.system => Icons.brightness_auto_outlined,
    ThemeMode.light => Icons.light_mode_outlined,
    ThemeMode.dark => Icons.dark_mode_outlined,
  };
}

String languageLabel(String languageCode) {
  return switch (languageCode) {
    'en' => 'EN',
    'ar' => 'AR',
    _ => languageCode.toUpperCase(),
  };
}
