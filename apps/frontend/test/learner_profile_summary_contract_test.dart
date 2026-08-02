import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/features/profile/application/profile_providers.dart';
import 'package:frontend/features/profile/data/models/learner_profile_summary.dart';
import 'package:frontend/features/profile/data/profile_api.dart';
import 'package:frontend/features/profile/data/profile_repository.dart';

void main() {
  test('ProfileApi requests and parses the locked summary contract', () async {
    final api = ProfileApi(
      _dioWithHandler((options) {
        expect(options.method, 'GET');
        expect(options.path, '/api/learner/profile-summary');
        return {'success': true, 'data': _summaryJson()};
      }),
    );

    final summary = await api.fetchLearnerProfileSummary();

    expect(summary.profileCompletion.completedSteps, 4);
    expect(summary.profileCompletion.totalSteps, 6);
    expect(summary.profileCompletion.percentage, 67);
    expect(summary.profileCompletion.missingSteps, const [
      'phone',
      'saved_location',
    ]);
    expect(summary.journey.activeReservationsCount, 3);
    expect(summary.journey.likedMaterialsCount, 8);
    expect(summary.journey.completedBuildsCount, 4);
    expect(summary.continueProject?.projectId, 'project-1');
    expect(summary.continueProject?.imageUrl, isNull);
    expect(summary.continueProject?.lastActivityAt, DateTime.utc(2026, 7, 29));
    expect(summary.continueProject?.progress.percentage, 40);
  });

  test('parsing accepts zero counts, null continuation, and extra fields', () {
    final json = _summaryJson()
      ..['continueProject'] = null
      ..['futureField'] = {'ignored': true};
    final journey = Map<String, dynamic>.from(json['journey'] as Map)
      ..updateAll((key, value) => 0)
      ..['futureCount'] = 99;
    json['journey'] = journey;

    final summary = LearnerProfileSummary.fromJson(json);

    expect(summary.continueProject, isNull);
    expect(summary.journey.activeReservationsCount, 0);
    expect(summary.journey.completedReservationsCount, 0);
  });

  test('parsing rejects missing required contract fields', () {
    final json = _summaryJson();
    final completion = Map<String, dynamic>.from(
      json['profileCompletion'] as Map,
    )..remove('percentage');
    json['profileCompletion'] = completion;

    expect(
      () => LearnerProfileSummary.fromJson(json),
      throwsA(isA<FormatException>()),
    );
  });

  test(
    'provider exposes loading then success without automatic retry',
    () async {
      final completer = Completer<LearnerProfileSummary>();
      final repository = _FakeProfileRepository(() => completer.future);
      final container = ProviderContainer(
        overrides: [profileRepositoryProvider.overrideWithValue(repository)],
      );
      addTearDown(container.dispose);
      final states = <AsyncValue<LearnerProfileSummary>>[];
      final provider = learnerProfileSummaryProvider('user-1');
      final subscription = container.listen(
        provider,
        (_, next) => states.add(next),
        fireImmediately: true,
      );
      addTearDown(subscription.close);

      expect(states.last, isA<AsyncLoading<LearnerProfileSummary>>());
      completer.complete(LearnerProfileSummary.fromJson(_summaryJson()));
      final summary = await container.read(
        provider.future,
      );

      expect(summary.journey.savedProjectsCount, 7);
      expect(repository.calls, 1);
      expect(states.last, isA<AsyncData<LearnerProfileSummary>>());
    },
  );

  test(
    'provider exposes failure and explicit invalidation refetches',
    () async {
      var shouldFail = true;
      final repository = _FakeProfileRepository(() async {
        if (shouldFail) throw StateError('summary failed');
        return LearnerProfileSummary.fromJson(_summaryJson());
      });
      final container = ProviderContainer(
        overrides: [profileRepositoryProvider.overrideWithValue(repository)],
      );
      addTearDown(container.dispose);
      final provider = learnerProfileSummaryProvider('user-1');
      final subscription = container.listen(
        provider,
        (previous, next) {},
        fireImmediately: true,
      );
      addTearDown(subscription.close);

      await expectLater(
        container.read(provider.future),
        throwsA(isA<StateError>()),
      );
      expect(repository.calls, 1);

      shouldFail = false;
      container.invalidate(provider);
      final summary = await container.read(provider.future);

      expect(summary.profileCompletion.percentage, 67);
      expect(repository.calls, 2);
    },
  );

  test('provider cache is partitioned by authenticated user id', () async {
    final first = Completer<LearnerProfileSummary>();
    final second = Completer<LearnerProfileSummary>();
    var calls = 0;
    final repository = _FakeProfileRepository(() {
      calls += 1;
      return calls == 1 ? first.future : second.future;
    });
    final container = ProviderContainer(
      overrides: [profileRepositoryProvider.overrideWithValue(repository)],
    );
    addTearDown(container.dispose);

    final firstFuture = container.read(
      learnerProfileSummaryProvider('user-a').future,
    );
    final secondFuture = container.read(
      learnerProfileSummaryProvider('user-b').future,
    );
    expect(repository.calls, 2);

    final secondJson = _summaryJson();
    (secondJson['profileCompletion'] as Map<String, dynamic>)['percentage'] =
        33;
    second.complete(LearnerProfileSummary.fromJson(secondJson));
    expect((await secondFuture).profileCompletion.percentage, 33);

    first.complete(LearnerProfileSummary.fromJson(_summaryJson()));
    expect((await firstFuture).profileCompletion.percentage, 67);
    expect(
      container
          .read(learnerProfileSummaryProvider('user-b'))
          .requireValue
          .profileCompletion
          .percentage,
      33,
    );
  });
}

Map<String, dynamic> _summaryJson() => {
  'profileCompletion': {
    'completedSteps': 4,
    'totalSteps': 6,
    'percentage': 67,
    'missingSteps': ['phone', 'saved_location'],
  },
  'journey': {
    'activeReservationsCount': 3,
    'completedReservationsCount': 9,
    'likedMaterialsCount': 8,
    'savedProjectsCount': 7,
    'followedProjectsCount': 2,
    'activeBuildsCount': 1,
    'completedBuildsCount': 4,
  },
  'continueProject': {
    'projectId': 'project-1',
    'buildId': 'build-1',
    'title': 'Smart irrigation device',
    'imageUrl': null,
    'lastActivityAt': '2026-07-29T00:00:00.000Z',
    'progress': {'completedSteps': 2, 'totalSteps': 5, 'percentage': 40},
  },
};

class _FakeProfileRepository extends ProfileRepository {
  _FakeProfileRepository(this._loader) : super(api: ProfileApi(Dio()));

  final Future<LearnerProfileSummary> Function() _loader;
  int calls = 0;

  @override
  Future<LearnerProfileSummary> fetchLearnerProfileSummary() {
    calls += 1;
    return _loader();
  }
}

Dio _dioWithHandler(Map<String, dynamic> Function(RequestOptions) handler) {
  final dio = Dio();
  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, requestHandler) {
        requestHandler.resolve(
          Response<Map<String, dynamic>>(
            requestOptions: options,
            statusCode: 200,
            data: handler(options),
          ),
        );
      },
    ),
  );
  return dio;
}
