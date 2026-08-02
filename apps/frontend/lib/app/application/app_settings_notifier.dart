import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../l10n/app_localizations.dart';
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

const supportedLanguageCodes = {'ar', 'en'};

String normalizeLanguageCode(String? languageCode) {
  return supportedLanguageCodes.contains(languageCode) ? languageCode! : 'ar';
}

Future<AppSettings> loadInitialAppSettings(AppSettingsStorage storage) async {
  final values = await Future.wait<Object?>([
    storage.readThemeMode(),
    storage.readLanguageCode(),
  ]);

  return AppSettings(
    themeMode: values[0] as ThemeMode? ?? ThemeMode.system,
    languageCode: normalizeLanguageCode(values[1] as String?),
  );
}

final initialAppSettingsProvider = Provider<AppSettings>((ref) {
  return const AppSettings(themeMode: ThemeMode.system, languageCode: 'ar');
});

class AppSettingsNotifier extends Notifier<AppSettings> {
  @override
  AppSettings build() => ref.watch(initialAppSettingsProvider);

  void setThemeMode(ThemeMode themeMode) {
    state = state.copyWith(themeMode: themeMode);
    unawaited(ref.read(appSettingsStorageProvider).saveThemeMode(themeMode));
  }

  void setLanguageCode(String languageCode) {
    final normalizedLanguageCode = normalizeLanguageCode(languageCode);
    state = state.copyWith(languageCode: normalizedLanguageCode);
    unawaited(
      ref
          .read(appSettingsStorageProvider)
          .saveLanguageCode(normalizedLanguageCode),
    );
  }
}

final appSettingsStorageProvider = Provider<AppSettingsStorage>((ref) {
  return createAppSettingsStorage();
});

final appSettingsProvider = NotifierProvider<AppSettingsNotifier, AppSettings>(
  AppSettingsNotifier.new,
);

String themeModeLabel(ThemeMode mode, {AppLocalizations? l10n}) {
  return switch (mode) {
    ThemeMode.system => l10n?.themeSystem ?? 'System',
    ThemeMode.light => l10n?.themeLight ?? 'Light',
    ThemeMode.dark => l10n?.themeDark ?? 'Dark',
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
