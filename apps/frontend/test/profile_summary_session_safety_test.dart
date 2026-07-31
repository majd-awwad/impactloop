import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/profile/application/profile_providers.dart';
import 'package:frontend/features/profile/data/models/learner_profile_summary.dart';
import 'package:frontend/features/profile/data/profile_api.dart';
import 'package:frontend/features/profile/data/profile_repository.dart';

void main() {
  test(
    'pending response cannot cross into another user family instance',
    () async {
      final first = Completer<LearnerProfileSummary>();
      final second = Completer<LearnerProfileSummary>();
      final repository = _QueuedSummaryRepository([
        first.future,
        second.future,
      ]);
      final container = ProviderContainer(
        overrides: [profileRepositoryProvider.overrideWithValue(repository)],
      );
      addTearDown(container.dispose);

      final firstProvider = learnerProfileSummaryProvider('learner-a');
      final secondProvider = learnerProfileSummaryProvider('learner-b');
      final firstSubscription = container.listen(firstProvider, (_, _) {});
      final secondSubscription = container.listen(secondProvider, (_, _) {});
      addTearDown(firstSubscription.close);
      addTearDown(secondSubscription.close);

      expect(container.read(firstProvider), isA<AsyncLoading>());
      expect(container.read(secondProvider), isA<AsyncLoading>());
      expect(repository.calls, 2);

      second.complete(_summary(25));
      expect(
        (await container.read(secondProvider.future))
            .profileCompletion
            .percentage,
        25,
      );

      first.complete(_summary(75));
      await container.read(firstProvider.future);

      expect(
        container
            .read(secondProvider)
            .requireValue
            .profileCompletion
            .percentage,
        25,
      );
    },
  );

  test(
    'completed caches and invalidation stay scoped to their user id',
    () async {
      final repository = _QueuedSummaryRepository([
        Future.value(_summary(40)),
        Future.value(_summary(60)),
        Future.value(_summary(80)),
      ]);
      final container = ProviderContainer(
        overrides: [profileRepositoryProvider.overrideWithValue(repository)],
      );
      addTearDown(container.dispose);

      final firstProvider = learnerProfileSummaryProvider('learner-a');
      final secondProvider = learnerProfileSummaryProvider('learner-b');
      final firstSubscription = container.listen(firstProvider, (_, _) {});
      final secondSubscription = container.listen(secondProvider, (_, _) {});
      addTearDown(firstSubscription.close);
      addTearDown(secondSubscription.close);

      expect(
        (await container.read(firstProvider.future))
            .profileCompletion
            .percentage,
        40,
      );
      expect(
        (await container.read(secondProvider.future))
            .profileCompletion
            .percentage,
        60,
      );

      container.invalidate(firstProvider);
      expect(
        (await container.read(firstProvider.future))
            .profileCompletion
            .percentage,
        80,
      );
      expect(
        container
            .read(secondProvider)
            .requireValue
            .profileCompletion
            .percentage,
        60,
      );
      expect(repository.calls, 3);
    },
  );
}

class _QueuedSummaryRepository extends ProfileRepository {
  _QueuedSummaryRepository(this.responses) : super(api: ProfileApi(Dio()));

  final List<Future<LearnerProfileSummary>> responses;
  int calls = 0;

  @override
  Future<LearnerProfileSummary> fetchLearnerProfileSummary() {
    final response = responses[calls];
    calls += 1;
    return response;
  }
}

LearnerProfileSummary _summary(int percentage) {
  return LearnerProfileSummary.fromJson({
    'profileCompletion': {
      'completedSteps': percentage == 0 ? 0 : 1,
      'totalSteps': 4,
      'percentage': percentage,
      'missingSteps': const <String>[],
    },
    'journey': {
      'activeReservationsCount': 0,
      'completedReservationsCount': 0,
      'likedMaterialsCount': 0,
      'savedProjectsCount': 0,
      'followedProjectsCount': 0,
      'activeBuildsCount': 0,
      'completedBuildsCount': 0,
    },
    'continueProject': null,
  });
}
