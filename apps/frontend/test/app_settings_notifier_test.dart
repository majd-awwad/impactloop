import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/app/application/app_settings_notifier.dart';
import 'package:frontend/app/application/app_settings_storage.dart';
import 'package:frontend/l10n/app_localizations.dart';

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

  test('missing and invalid stored languages bootstrap in Arabic', () async {
    final emptyStorage = MemoryAppSettingsStorage();
    expect((await loadInitialAppSettings(emptyStorage)).languageCode, 'ar');

    await emptyStorage.saveLanguageCode('fr');
    expect((await loadInitialAppSettings(emptyStorage)).languageCode, 'ar');
  });

  test('stored English is respected before the provider is created', () async {
    final storage = MemoryAppSettingsStorage();
    await storage.saveLanguageCode('en');
    await storage.saveThemeMode(ThemeMode.dark);

    final initial = await loadInitialAppSettings(storage);
    final container = ProviderContainer(
      overrides: [initialAppSettingsProvider.overrideWithValue(initial)],
    );
    addTearDown(container.dispose);

    expect(container.read(appSettingsProvider).languageCode, 'en');
    expect(container.read(appSettingsProvider).themeMode, ThemeMode.dark);
  });

  test('unsupported language updates are normalized to Arabic', () async {
    final storage = MemoryAppSettingsStorage();
    final container = ProviderContainer(
      overrides: [appSettingsStorageProvider.overrideWithValue(storage)],
    );
    addTearDown(container.dispose);

    container.read(appSettingsProvider.notifier).setLanguageCode('invalid');
    await Future<void>.delayed(Duration.zero);

    expect(container.read(appSettingsProvider).languageCode, 'ar');
    expect(await storage.readLanguageCode(), 'ar');
  });

  testWidgets('empty storage renders the first frame in Arabic and RTL', (
    tester,
  ) async {
    final storage = MemoryAppSettingsStorage();
    final initial = await loadInitialAppSettings(storage);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [initialAppSettingsProvider.overrideWithValue(initial)],
        child: const _SettingsProbeApp(),
      ),
    );

    final context = tester.element(find.byKey(const Key('settings-probe')));
    expect(Localizations.localeOf(context).languageCode, 'ar');
    expect(Directionality.of(context), TextDirection.rtl);
    expect(find.text('ImpactLoop'), findsOneWidget);
  });

  testWidgets('stored English renders the first frame in English and LTR', (
    tester,
  ) async {
    final storage = MemoryAppSettingsStorage();
    await storage.saveLanguageCode('en');
    final initial = await loadInitialAppSettings(storage);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [initialAppSettingsProvider.overrideWithValue(initial)],
        child: const _SettingsProbeApp(),
      ),
    );

    final context = tester.element(find.byKey(const Key('settings-probe')));
    expect(Localizations.localeOf(context).languageCode, 'en');
    expect(Directionality.of(context), TextDirection.ltr);
    expect(find.text('ImpactLoop'), findsOneWidget);
  });
}

class _SettingsProbeApp extends ConsumerWidget {
  const _SettingsProbeApp();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final settings = ref.watch(appSettingsProvider);
    return MaterialApp(
      locale: Locale(settings.languageCode),
      supportedLocales: const [Locale('ar'), Locale('en')],
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      home: Builder(
        builder: (context) => Scaffold(
          body: Text(
            AppLocalizations.of(context).appTitle,
            key: const Key('settings-probe'),
          ),
        ),
      ),
    );
  }
}
