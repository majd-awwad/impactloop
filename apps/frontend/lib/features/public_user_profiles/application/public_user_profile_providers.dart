import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../learning_hub/domain/learning_projects_result.dart';
import '../data/public_user_profile_models.dart';
import '../data/public_users_api.dart';

final publicUsersApiProvider = Provider<PublicUsersApi>(
  (ref) => PublicUsersApi(ref.watch(apiClientProvider)),
);

final publicUserProfileProvider = FutureProvider.autoDispose
    .family<PublicUserProfileBundle, String>((ref, userId) async {
      final api = ref.read(publicUsersApiProvider);
      final results = await Future.wait<Object>([
        api.fetchProfile(userId),
        api.fetchPublishedProjects(userId),
      ]);
      return (
        profile: results[0] as PublicUserProfile,
        projects: results[1] as LearningProjectsResult,
      );
    });
