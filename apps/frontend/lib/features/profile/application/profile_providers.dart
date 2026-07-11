import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../data/models/learner_interest_options.dart';
import '../data/profile_api.dart';
import '../data/profile_repository.dart';

final profileApiProvider = Provider<ProfileApi>((ref) {
  return ProfileApi(ref.watch(apiClientProvider));
});

final profileRepositoryProvider = Provider<ProfileRepository>((ref) {
  return ProfileRepository(api: ref.watch(profileApiProvider));
});

final learnerInterestOptionsProvider =
    FutureProvider<LearnerInterestOptionsResponse>((ref) async {
  try {
    return await ref.watch(profileApiProvider).getLearnerInterestOptions();
  } catch (_) {
    return fallbackLearnerInterestOptions;
  }
});
