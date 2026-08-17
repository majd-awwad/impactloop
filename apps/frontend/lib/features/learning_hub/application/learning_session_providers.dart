import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/models/learning_session.dart';
import 'learning_hub_providers.dart';

final buildLearningSessionProvider = FutureProvider.autoDispose
    .family<LearningSessionBundle, String>((ref, projectId) async {
      return ref
          .watch(learningHubRepositoryProvider)
          .fetchLearningSession(projectId);
    });
