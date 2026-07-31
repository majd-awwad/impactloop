import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/app/application/app_settings_notifier.dart';
import 'package:frontend/app/application/app_settings_storage.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('theme and language setters update state and device storage', () async {
    final storage = MemoryAppSettingsStorage();
    final container = ProviderContainer(
      overrides: [appSettingsStorageProvider.overrideWithValue(storage)],
    );
    addTearDown(container.dispose);

    container.read(appSettingsProvider.notifier).setThemeMode(ThemeMode.dark);
    container.read(appSettingsProvider.notifier).setLanguageCode('ar');
    await Future<void>.delayed(Duration.zero);

    final settings = container.read(appSettingsProvider);
    expect(settings.themeMode, ThemeMode.dark);
    expect(settings.languageCode, 'ar');
    expect(await storage.readThemeMode(), ThemeMode.dark);
    expect(await storage.readLanguageCode(), 'ar');
  });

  test('memory storage round-trips supported local values', () async {
    final storage = MemoryAppSettingsStorage();

    expect(await storage.readThemeMode(), isNull);
    expect(await storage.readLanguageCode(), isNull);

    await storage.saveThemeMode(ThemeMode.light);
    await storage.saveLanguageCode('en');

    expect(await storage.readThemeMode(), ThemeMode.light);
    expect(await storage.readLanguageCode(), 'en');
  });
}
