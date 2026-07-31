import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:frontend/l10n/app_localizations.dart';

import 'application/app_settings_notifier.dart';
import 'router/app_router.dart';
import 'theme/app_theme.dart';
import '../features/auth/application/auth_providers.dart';

class ImpactLoopApp extends ConsumerWidget {
  const ImpactLoopApp({super.key});

  static const supportedLocales = [Locale('ar'), Locale('en')];

  static const localizationsDelegates = [
    AppLocalizations.delegate,
    GlobalMaterialLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(authNetworkBootstrapProvider);
    final router = ref.watch(appRouterProvider);
    final settings = ref.watch(appSettingsProvider);

    return MaterialApp.router(
      onGenerateTitle: (context) => AppLocalizations.of(context).appTitle,
      theme: AppTheme.lightFor(settings.languageCode),
      darkTheme: AppTheme.darkFor(settings.languageCode),
      themeMode: settings.themeMode,
      locale: Locale(settings.languageCode),
      supportedLocales: supportedLocales,
      localizationsDelegates: localizationsDelegates,
      routerConfig: router,
    );
  }
}
