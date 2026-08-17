import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:frontend/l10n/app_localizations.dart';

import 'application/app_settings_notifier.dart';
import 'router/app_router.dart';
import 'theme/app_theme.dart';
import '../features/auth/application/auth_controller.dart';
import '../features/auth/application/auth_providers.dart';
import '../features/notifications/application/notifications_provider.dart';

class ImpactLoopApp extends ConsumerStatefulWidget {
  const ImpactLoopApp({super.key});

  static const supportedLocales = [Locale('ar'), Locale('en')];

  static const localizationsDelegates = [
    AppLocalizations.delegate,
    GlobalMaterialLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
  ];

  @override
  ConsumerState<ImpactLoopApp> createState() => _ImpactLoopAppState();
}

class _ImpactLoopAppState extends ConsumerState<ImpactLoopApp>
    with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed) {
      return;
    }
    final auth = ref.read(authControllerProvider);
    if (auth.status != AuthStatus.authenticated) {
      return;
    }
    // Inbox page already reconciles the list (and badge via setCount).
    // Skip the separate unread GET to avoid a resume burst.
    if (ref.read(notificationsListPageVisibleProvider) > 0) {
      return;
    }
    // Lifecycle reconcile for the bell — replaces permanent unread polling.
    ref.invalidate(myNotificationUnreadCountProvider);
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(authNetworkBootstrapProvider);
    final router = ref.watch(appRouterProvider);
    final settings = ref.watch(appSettingsProvider);

    return MaterialApp.router(
      onGenerateTitle: (context) => AppLocalizations.of(context).appTitle,
      theme: AppTheme.lightFor(settings.languageCode),
      darkTheme: AppTheme.darkFor(settings.languageCode),
      themeMode: settings.themeMode,
      locale: Locale(settings.languageCode),
      supportedLocales: ImpactLoopApp.supportedLocales,
      localizationsDelegates: ImpactLoopApp.localizationsDelegates,
      routerConfig: router,
      builder: (context, child) {
        final mediaQuery = MediaQuery.of(context);
        return MediaQuery(
          data: mediaQuery.copyWith(
            textScaler: AppTheme.textScalerFor(
              incoming: mediaQuery.textScaler,
              languageCode: settings.languageCode,
            ),
          ),
          child: child ?? const SizedBox.shrink(),
        );
      },
    );
  }
}
