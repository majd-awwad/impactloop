import 'package:flutter/material.dart';
import 'package:flutter_web_plugins/url_strategy.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app/app.dart';
import 'core/network/api_client.dart';
import 'features/learning_hub/application/learning_hub_providers.dart';
import 'features/learning_hub/data/api_learning_hub_repository.dart';
import 'features/materials/data/material_listing_data_providers.dart';

void main() {
  usePathUrlStrategy();
  runApp(
    ProviderScope(
      overrides: [
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
