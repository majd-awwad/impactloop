import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'application/app_settings_notifier.dart';
import 'router/app_router.dart';
import 'theme/app_theme.dart';
import '../features/auth/application/auth_providers.dart';

class ImpactLoopApp extends ConsumerWidget {
  const ImpactLoopApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(authNetworkBootstrapProvider);
    final router = ref.watch(appRouterProvider);
    final settings = ref.watch(appSettingsProvider);

    return MaterialApp.router(
      title: 'ImpactLoop',
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode: settings.themeMode,
      locale: Locale(settings.languageCode),
      supportedLocales: const [
        Locale('en'),
        Locale('ar'),
      ],
      routerConfig: router,
    );
  }
}
