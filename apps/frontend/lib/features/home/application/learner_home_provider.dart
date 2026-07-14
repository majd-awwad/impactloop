import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../data/learner_home_api.dart';
import '../domain/learner_home_models.dart';

final learnerHomeApiProvider = Provider<LearnerHomeApi>((ref) {
  return LearnerHomeApi(ref.watch(apiClientProvider));
});

final learnerHomeFeedProvider = FutureProvider.autoDispose<LearnerHomeFeed>((
  ref,
) async {
  return ref.watch(learnerHomeApiProvider).fetchHomeFeed();
});

final learnerHomeSectionDetailsProvider = FutureProvider.autoDispose
    .family<LearnerHomeSectionDetails, LearnerHomeSectionKey>((
      ref,
      sectionKey,
    ) async {
      return ref
          .watch(learnerHomeApiProvider)
          .fetchSectionDetails(sectionKey);
    });
