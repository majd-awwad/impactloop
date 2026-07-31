import 'package:flutter/material.dart';
import 'package:flutter_web_plugins/url_strategy.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app/app.dart';
import 'app/application/app_settings_notifier.dart';
import 'app/application/app_settings_storage.dart';
import 'core/network/api_client.dart';
import 'features/learning_hub/application/learning_hub_providers.dart';
import 'features/learning_hub/data/api_learning_hub_repository.dart';
import 'features/materials/data/material_listing_data_providers.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  usePathUrlStrategy();

  final settingsStorage = createAppSettingsStorage();
  final initialSettings = await loadInitialAppSettings(settingsStorage);

  runApp(
    ProviderScope(
      overrides: [
        appSettingsStorageProvider.overrideWithValue(settingsStorage),
        initialAppSettingsProvider.overrideWithValue(initialSettings),
        learningHubRepositoryProvider.overrideWith(
          (ref) => ApiLearningHubRepository(
            client: ref.watch(apiClientProvider),
            categoriesApi: ref.watch(categoriesApiProvider),
          ),
        ),
      ],
      child: const ImpactLoopApp(),
    ),
  );
}
