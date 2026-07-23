import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../data/learner_home_api.dart';
import '../domain/learner_home_models.dart';

Duration? _noAutomaticLearnerHomeRetry(int retryCount, Object error) => null;

final learnerHomeApiProvider = Provider<LearnerHomeApi>((ref) {
  return LearnerHomeApi(ref.watch(apiClientProvider));
});

final learnerHomeFeedProvider = FutureProvider.autoDispose<LearnerHomeFeed>((
  ref,
) async {
  return ref.watch(learnerHomeApiProvider).fetchHomeFeed();
}, retry: _noAutomaticLearnerHomeRetry);

final learnerHomeSectionDetailsProvider = FutureProvider.autoDispose
    .family<LearnerHomeSectionDetails, LearnerHomeSectionKey>((
      ref,
      sectionKey,
    ) async {
      return ref.watch(learnerHomeApiProvider).fetchSectionDetails(sectionKey);
    }, retry: _noAutomaticLearnerHomeRetry);

void invalidateLearnerHomeProviders(Ref ref) {
  ref.invalidate(learnerHomeFeedProvider);
  ref.invalidate(learnerHomeSectionDetailsProvider);
}
