import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/core/errors/api_exception.dart';
import 'package:frontend/features/admin_portal/data/admin_learning_projects_api.dart';
import 'package:frontend/features/admin_portal/data/models/admin_learning_projects_models.dart';
import 'package:frontend/features/admin_portal/presentation/pages/admin_learning_projects_page.dart';

AdminLearningProjectDetail _detail({
  String id = 'proj-1',
  String status = 'PENDING_REVIEW',
  bool canApprove = true,
  bool canRequestChanges = true,
  bool canReject = true,
}) {
  return AdminLearningProjectDetail.fromJson({
    'id': id,
    'title': 'Robot Arm',
    'shortDescription': 'Short',
    'description': 'Build a simple robot arm with careful wiring.',
    'status': status,
    'difficulty': 'BEGINNER',
    'category': {'id': 'cat', 'nameEn': 'Robotics', 'nameAr': 'روبوتات'},
    'author': {
      'id': 'user-1',
      'displayName': 'Learner',
      'email': 'learner@test.com',
    },
    'createdAt': '2026-01-01T00:00:00.000Z',
    'updatedAt': '2026-01-01T00:00:00.000Z',
    'reviewedBy': null,
    'images': [],
    'requiredComponents': [],
    'steps': [],
    'links': [],
    'tags': [],
    'componentQuality': {
      'hardIssues': [],
      'softWarnings': [],
      'canApprove': true,
    },
    'allowedActions': {
      'canApprove': canApprove,
      'canRequestChanges': canRequestChanges,
      'canReject': canReject,
      'canHide': false,
      'canRestore': false,
      'canArchive': true,
      'canEditComponents': true,
    },
  });
}

Map<String, dynamic> _reviewContent({
  String summary = 'Clear beginner project with solid structure.',
}) {
  return {
    'summary': summary,
    'attentionLevel': 'MEDIUM',
    'strengths': ['Clear title'],
    'importantConcerns': [
      {
        'code': 'MISSING_DETAIL',
        'severity': 'WARNING',
        'message': 'Add tighter safety notes for motors.',
      },
    ],
    'safetyNotes': ['Check power isolation.'],
    'improvementSuggestions': ['Clarify step 2 wiring.'],
    'manualReviewNotes': ['Confirm component names manually.'],
  };
}

Map<String, dynamic> _coverageJson({required bool truncated}) {
  return {
    'includedSteps': truncated ? 2 : 3,
    'totalSteps': 3,
    'includedComponents': truncated ? 1 : 2,
    'totalComponents': 2,
    'contentTruncated': truncated,
  };
}

AdminLearningProjectAiReviewResult _reviewResult({
  required bool truncated,
  String summary = 'Clear beginner project with solid structure.',
}) {
  return AdminLearningProjectAiReviewResult.fromJson({
    'projectId': 'proj-1',
    'generatedAt': '2026-01-02T00:00:00.000Z',
    'provider': 'mock',
    'model': 'mock-general-learning',
    'coverage': _coverageJson(truncated: truncated),
    'review': _reviewContent(summary: summary),
  });
}

Map<String, dynamic> _savedReviewJson({
  required bool truncated,
  bool isStale = false,
  String summary = 'Clear beginner project with solid structure.',
  int schemaVersion = adminLearningProjectAiReviewSchemaVersion,
}) {
  return {
    'generatedAt': '2026-01-02T00:00:00.000Z',
    'generatedByAdminUserId': 'admin-1',
    'provider': 'mock',
    'model': 'mock-general-learning',
    'schemaVersion': schemaVersion,
    'isStale': isStale,
    'coverage': _coverageJson(truncated: truncated),
    'review': _reviewContent(summary: summary),
  };
}

AdminLearningProjectSavedAiReviewResponse _savedReviewResponse({
  String projectId = 'proj-1',
  String locale = 'en',
  Map<String, dynamic>? savedReview,
}) {
  return AdminLearningProjectSavedAiReviewResponse.fromJson({
    'projectId': projectId,
    'locale': locale,
    'savedReview': savedReview,
  });
}

class _FakeAdminLearningProjectsApi extends AdminLearningProjectsApi {
  _FakeAdminLearningProjectsApi({
    required this.detail,
    this.reviewResult,
    this.savedReviewResponse,
    this.failReview = false,
    this.failGetSavedReview = false,
    this.delay = Duration.zero,
    this.getDelay = Duration.zero,
    this.malformedReviewJson,
    this.malformedSavedReviewJson,
    this.getSavedReviewHandler,
  }) : super(Dio(BaseOptions(baseUrl: 'http://test')));

  AdminLearningProjectDetail detail;
  AdminLearningProjectAiReviewResult? reviewResult;
  AdminLearningProjectSavedAiReviewResponse? savedReviewResponse;
  final bool failReview;
  final bool failGetSavedReview;
  final Duration delay;
  final Duration getDelay;
  final Map<String, dynamic>? malformedReviewJson;
  final Map<String, dynamic>? malformedSavedReviewJson;
  final Future<AdminLearningProjectSavedAiReviewResponse> Function({
    required String projectId,
    required String locale,
  })?
  getSavedReviewHandler;

  int fetchDetailCalls = 0;
  int getSavedAiReviewCalls = 0;
  int aiReviewCalls = 0;
  String? lastLocale;
  String? lastGetLocale;
  String? lastGetProjectId;

  @override
  Future<AdminLearningProjectDetail> fetchProjectDetail(String id) async {
    fetchDetailCalls += 1;
    return detail;
  }

  @override
  Future<AdminLearningProjectSavedAiReviewResponse> getSavedAiReview({
    required String projectId,
    required String locale,
  }) async {
    getSavedAiReviewCalls += 1;
    lastGetLocale = locale;
    lastGetProjectId = projectId;
    if (getDelay > Duration.zero) {
      await Future<void>.delayed(getDelay);
    }
    if (getSavedReviewHandler != null) {
      return getSavedReviewHandler!(projectId: projectId, locale: locale);
    }
    if (failGetSavedReview) {
      throw const ApiException(
        message: 'fetch failed',
        code: 'NETWORK_ERROR',
        statusCode: 503,
      );
    }
    if (malformedSavedReviewJson != null) {
      try {
        return AdminLearningProjectSavedAiReviewResponse.fromJson(
          malformedSavedReviewJson!,
        );
      } on FormatException catch (error) {
        throw ApiException(
          message: error.message,
          code: 'AI_REVIEW_INVALID',
          statusCode: 502,
        );
      }
    }
    return savedReviewResponse ??
        _savedReviewResponse(projectId: projectId, locale: locale);
  }

  @override
  Future<AdminLearningProjectAiReviewResult> runAiReview({
    required String projectId,
    required String locale,
  }) async {
    aiReviewCalls += 1;
    lastLocale = locale;
    if (delay > Duration.zero) {
      await Future<void>.delayed(delay);
    }
    if (failReview) {
      throw const ApiException(
        message: 'provider down',
        code: 'AI_DISABLED',
        statusCode: 503,
      );
    }
    if (malformedReviewJson != null) {
      try {
        return AdminLearningProjectAiReviewResult.fromJson(
          malformedReviewJson!,
        );
      } on FormatException catch (error) {
        throw ApiException(
          message: error.message,
          code: 'AI_REVIEW_INVALID',
          statusCode: 502,
        );
      }
    }
    return reviewResult ?? _reviewResult(truncated: false);
  }
}

Future<void> _pumpDetail(
  WidgetTester tester, {
  required _FakeAdminLearningProjectsApi api,
  Locale locale = const Locale('en'),
  String projectId = 'proj-1',
  Size surfaceSize = const Size(1200, 900),
}) async {
  await tester.binding.setSurfaceSize(surfaceSize);
  addTearDown(() => tester.binding.setSurfaceSize(null));

  await tester.pumpWidget(
    ProviderScope(
      overrides: [adminLearningProjectsApiProvider.overrideWithValue(api)],
      child: MaterialApp(
        locale: locale,
        supportedLocales: const [Locale('en'), Locale('ar')],
        localizationsDelegates: const [
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        home: Scaffold(
          body: adminLearningProjectDetailDialogForTest(projectId: projectId),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

Future<void> _reopenDetail(
  WidgetTester tester, {
  required _FakeAdminLearningProjectsApi api,
  Locale locale = const Locale('en'),
  String projectId = 'proj-1',
}) async {
  await tester.pumpWidget(const SizedBox.shrink());
  await tester.pump();
  await _pumpDetail(tester, api: api, locale: locale, projectId: projectId);
}

Future<void> _tapAiReviewTrigger(WidgetTester tester) async {
  final trigger = find.byKey(const Key('admin-ai-review-run'));
  await tester.ensureVisible(trigger);
  await tester.pumpAndSettle();
  await tester.tap(trigger);
}

Future<void> _tapKeyed(WidgetTester tester, Key key) async {
  final finder = find.byKey(key);
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
}

void main() {
  testWidgets('opening eligible project calls GET exactly once', (
    tester,
  ) async {
    final api = _FakeAdminLearningProjectsApi(detail: _detail());
    await _pumpDetail(tester, api: api);

    expect(api.fetchDetailCalls, 1);
    expect(api.getSavedAiReviewCalls, 1);
    expect(api.lastGetLocale, 'en');
    expect(api.lastGetProjectId, 'proj-1');
  });

  testWidgets('opening detail never automatically calls POST', (tester) async {
    final api = _FakeAdminLearningProjectsApi(
      detail: _detail(),
      savedReviewResponse: _savedReviewResponse(
        savedReview: _savedReviewJson(truncated: false),
      ),
    );
    await _pumpDetail(tester, api: api);

    expect(api.aiReviewCalls, 0);
    expect(
      find.text('Clear beginner project with solid structure.'),
      findsOneWidget,
    );
  });

  testWidgets('GET savedReview null shows empty state and Run AI review', (
    tester,
  ) async {
    final api = _FakeAdminLearningProjectsApi(detail: _detail());
    await _pumpDetail(tester, api: api);

    expect(find.byKey(const Key('admin-ai-review-run')), findsOneWidget);
    expect(find.byKey(const Key('admin-ai-review-run-again')), findsNothing);
    expect(find.byKey(const Key('admin-ai-review-summary')), findsNothing);
  });

  testWidgets('GET saved review renders structured review and metadata', (
    tester,
  ) async {
    final api = _FakeAdminLearningProjectsApi(
      detail: _detail(),
      savedReviewResponse: _savedReviewResponse(
        savedReview: _savedReviewJson(truncated: false),
      ),
    );
    await _pumpDetail(tester, api: api);

    expect(
      find.text('Clear beginner project with solid structure.'),
      findsOneWidget,
    );
    expect(find.textContaining('Clear title'), findsOneWidget);
    expect(find.text('Add tighter safety notes for motors.'), findsOneWidget);
    expect(find.textContaining('Check power isolation.'), findsOneWidget);
    expect(find.textContaining('Clarify step 2 wiring.'), findsOneWidget);
    expect(
      find.textContaining('Confirm component names manually.'),
      findsOneWidget,
    );
    expect(find.byKey(const Key('admin-ai-review-metadata')), findsOneWidget);
    expect(find.textContaining('Provider: mock'), findsOneWidget);
    expect(find.textContaining('Model: mock-general-learning'), findsOneWidget);
  });

  testWidgets('closing and reopening triggers GET again without POST', (
    tester,
  ) async {
    final api = _FakeAdminLearningProjectsApi(
      detail: _detail(),
      savedReviewResponse: _savedReviewResponse(
        savedReview: _savedReviewJson(truncated: false),
      ),
    );
    await _pumpDetail(tester, api: api);
    expect(api.getSavedAiReviewCalls, 1);
    expect(api.aiReviewCalls, 0);

    await _reopenDetail(tester, api: api);
    expect(api.getSavedAiReviewCalls, 2);
    expect(api.aiReviewCalls, 0);
    expect(
      find.text('Clear beginner project with solid structure.'),
      findsOneWidget,
    );
  });

  testWidgets('isStale true keeps review visible and shows stale warning', (
    tester,
  ) async {
    final api = _FakeAdminLearningProjectsApi(
      detail: _detail(),
      savedReviewResponse: _savedReviewResponse(
        savedReview: _savedReviewJson(truncated: false, isStale: true),
      ),
    );
    await _pumpDetail(tester, api: api);

    expect(
      find.byKey(const Key('admin-ai-review-stale-warning')),
      findsOneWidget,
    );
    expect(
      find.text('Clear beginner project with solid structure.'),
      findsOneWidget,
    );
    expect(find.byKey(const Key('admin-ai-review-run-again')), findsOneWidget);
  });

  testWidgets('isStale false does not show stale warning', (tester) async {
    final api = _FakeAdminLearningProjectsApi(
      detail: _detail(),
      savedReviewResponse: _savedReviewResponse(
        savedReview: _savedReviewJson(truncated: false, isStale: false),
      ),
    );
    await _pumpDetail(tester, api: api);

    expect(
      find.byKey(const Key('admin-ai-review-stale-warning')),
      findsNothing,
    );
  });

  testWidgets(
    'ineligible project with saved review shows review and no run controls',
    (tester) async {
      final api = _FakeAdminLearningProjectsApi(
        detail: _detail(status: 'PUBLISHED'),
        savedReviewResponse: _savedReviewResponse(
          savedReview: _savedReviewJson(truncated: false),
        ),
      );
      await _pumpDetail(tester, api: api);

      expect(
        find.text('Clear beginner project with solid structure.'),
        findsOneWidget,
      );
      expect(find.byKey(const Key('admin-ai-review-run')), findsNothing);
      expect(find.byKey(const Key('admin-ai-review-run-again')), findsNothing);
      expect(
        find.textContaining(
          'AI review is available only for projects pending review',
        ),
        findsOneWidget,
      );
      expect(api.aiReviewCalls, 0);
    },
  );

  testWidgets(
    'ineligible project without saved review shows unavailable explanation only',
    (tester) async {
      final api = _FakeAdminLearningProjectsApi(
        detail: _detail(status: 'PUBLISHED'),
      );
      await _pumpDetail(tester, api: api);

      expect(find.byKey(const Key('admin-ai-review-run')), findsNothing);
      expect(find.byKey(const Key('admin-ai-review-run-again')), findsNothing);
      expect(
        find.textContaining(
          'AI review is available only for projects pending review',
        ),
        findsOneWidget,
      );
    },
  );

  testWidgets('Run again keeps old result visible while loading', (
    tester,
  ) async {
    final api = _FakeAdminLearningProjectsApi(
      detail: _detail(),
      savedReviewResponse: _savedReviewResponse(
        savedReview: _savedReviewJson(
          truncated: false,
          summary: 'First review summary',
        ),
      ),
      delay: const Duration(milliseconds: 200),
    );
    await _pumpDetail(tester, api: api);

    await _tapKeyed(tester, const Key('admin-ai-review-run-again'));
    await tester.pump();

    expect(find.text('First review summary'), findsOneWidget);
    expect(
      find.byKey(const Key('admin-ai-review-rerun-loading')),
      findsOneWidget,
    );
    expect(api.aiReviewCalls, 1);

    await tester.pumpAndSettle();
  });

  testWidgets('successful Run again replaces result and clears stale warning', (
    tester,
  ) async {
    final api = _FakeAdminLearningProjectsApi(
      detail: _detail(),
      savedReviewResponse: _savedReviewResponse(
        savedReview: _savedReviewJson(
          truncated: false,
          isStale: true,
          summary: 'First review summary',
        ),
      ),
      reviewResult: _reviewResult(
        truncated: false,
        summary: 'Second review summary',
      ),
    );
    await _pumpDetail(tester, api: api);

    await _tapKeyed(tester, const Key('admin-ai-review-run-again'));
    await tester.pumpAndSettle();

    expect(find.text('Second review summary'), findsOneWidget);
    expect(find.text('First review summary'), findsNothing);
    expect(
      find.byKey(const Key('admin-ai-review-stale-warning')),
      findsNothing,
    );
    expect(api.aiReviewCalls, 1);
  });

  testWidgets('failed Run again keeps old result and stale warning', (
    tester,
  ) async {
    final api = _FakeAdminLearningProjectsApi(
      detail: _detail(),
      savedReviewResponse: _savedReviewResponse(
        savedReview: _savedReviewJson(
          truncated: false,
          isStale: true,
          summary: 'First review summary',
        ),
      ),
      failReview: true,
    );
    await _pumpDetail(tester, api: api);

    await _tapKeyed(tester, const Key('admin-ai-review-run-again'));
    await tester.pumpAndSettle();

    expect(find.text('First review summary'), findsOneWidget);
    expect(
      find.byKey(const Key('admin-ai-review-stale-warning')),
      findsOneWidget,
    );
    expect(find.byKey(const Key('admin-ai-review-failure')), findsOneWidget);
    expect(find.textContaining('provider down'), findsNothing);
    expect(api.aiReviewCalls, 1);
  });

  testWidgets('initial POST failure shows generic error and retry', (
    tester,
  ) async {
    final api = _FakeAdminLearningProjectsApi(
      detail: _detail(),
      failReview: true,
    );
    await _pumpDetail(tester, api: api);

    await _tapAiReviewTrigger(tester);
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('admin-ai-review-failure')), findsOneWidget);
    expect(find.byKey(const Key('admin-ai-review-retry')), findsOneWidget);
    expect(find.textContaining('provider down'), findsNothing);
    expect(api.aiReviewCalls, 1);
  });

  testWidgets('GET failure shows safe unavailable state without POST', (
    tester,
  ) async {
    final api = _FakeAdminLearningProjectsApi(
      detail: _detail(),
      failGetSavedReview: true,
    );
    await _pumpDetail(tester, api: api);

    expect(find.byKey(const Key('admin-ai-review-failure')), findsOneWidget);
    expect(find.textContaining('fetch failed'), findsNothing);
    expect(api.aiReviewCalls, 0);
    expect(api.getSavedAiReviewCalls, 1);
  });

  testWidgets('Arabic and English use independent GET locale values', (
    tester,
  ) async {
    final api = _FakeAdminLearningProjectsApi(
      detail: _detail(),
      getSavedReviewHandler: ({required projectId, required locale}) async {
        return _savedReviewResponse(
          projectId: projectId,
          locale: locale,
          savedReview: locale == 'ar'
              ? _savedReviewJson(truncated: false, summary: 'ملخص عربي محفوظ')
              : _savedReviewJson(
                  truncated: false,
                  summary: 'English saved summary',
                ),
        );
      },
    );

    await _pumpDetail(tester, api: api, locale: const Locale('en'));
    expect(api.lastGetLocale, 'en');
    expect(find.text('English saved summary'), findsOneWidget);

    await _pumpDetail(tester, api: api, locale: const Locale('ar'));
    expect(api.lastGetLocale, 'ar');
    expect(find.text('ملخص عربي محفوظ'), findsOneWidget);
    expect(find.text('English saved summary'), findsNothing);
  });

  testWidgets('project A delayed GET cannot populate project B', (
    tester,
  ) async {
    var getCall = 0;
    final api = _FakeAdminLearningProjectsApi(
      detail: _detail(),
      getSavedReviewHandler: ({required projectId, required locale}) async {
        getCall += 1;
        if (getCall == 1) {
          await Future<void>.delayed(const Duration(milliseconds: 300));
          return _savedReviewResponse(
            projectId: projectId,
            locale: locale,
            savedReview: _savedReviewJson(
              truncated: false,
              summary: 'Project A summary',
            ),
          );
        }
        return _savedReviewResponse(
          projectId: projectId,
          locale: locale,
          savedReview: _savedReviewJson(
            truncated: false,
            summary: 'Project B summary',
          ),
        );
      },
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [adminLearningProjectsApiProvider.overrideWithValue(api)],
        child: MaterialApp(
          locale: const Locale('en'),
          supportedLocales: const [Locale('en')],
          localizationsDelegates: const [
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          home: Scaffold(
            body: adminLearningProjectDetailDialogForTest(projectId: 'proj-1'),
          ),
        ),
      ),
    );
    await tester.pump();

    await _reopenDetail(tester, api: api, projectId: 'proj-1');

    expect(find.text('Project B summary'), findsOneWidget);
    expect(find.text('Project A summary'), findsNothing);

    await tester.pump(const Duration(milliseconds: 400));
    expect(find.text('Project B summary'), findsOneWidget);
    expect(find.text('Project A summary'), findsNothing);
  });

  testWidgets('disposed dialog ignores late async completion', (tester) async {
    final api = _FakeAdminLearningProjectsApi(
      detail: _detail(),
      getDelay: const Duration(milliseconds: 200),
      savedReviewResponse: _savedReviewResponse(
        savedReview: _savedReviewJson(truncated: false),
      ),
    );

    await tester.binding.setSurfaceSize(const Size(1200, 900));
    await tester.pumpWidget(
      ProviderScope(
        overrides: [adminLearningProjectsApiProvider.overrideWithValue(api)],
        child: MaterialApp(
          locale: const Locale('en'),
          supportedLocales: const [Locale('en')],
          localizationsDelegates: const [
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          home: Scaffold(
            body: adminLearningProjectDetailDialogForTest(projectId: 'proj-1'),
          ),
        ),
      ),
    );
    await tester.pump();
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(milliseconds: 300));
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'partial coverage warning appears when contentTruncated is true',
    (tester) async {
      final truncatedApi = _FakeAdminLearningProjectsApi(
        detail: _detail(),
        savedReviewResponse: _savedReviewResponse(
          savedReview: _savedReviewJson(truncated: true),
        ),
      );
      await _pumpDetail(tester, api: truncatedApi);
      expect(
        find.byKey(const Key('admin-ai-review-partial-notice')),
        findsOneWidget,
      );
      expect(find.textContaining('Covered 2/3 steps'), findsOneWidget);
    },
  );

  testWidgets(
    'partial coverage warning hidden when contentTruncated is false',
    (tester) async {
      final fullApi = _FakeAdminLearningProjectsApi(
        detail: _detail(),
        savedReviewResponse: _savedReviewResponse(
          savedReview: _savedReviewJson(truncated: false),
        ),
      );
      await _pumpDetail(tester, api: fullApi);
      expect(
        find.byKey(const Key('admin-ai-review-partial-notice')),
        findsNothing,
      );
    },
  );

  testWidgets('Run again prevents duplicate POST while loading', (
    tester,
  ) async {
    final api = _FakeAdminLearningProjectsApi(
      detail: _detail(),
      savedReviewResponse: _savedReviewResponse(
        savedReview: _savedReviewJson(truncated: false),
      ),
      delay: const Duration(milliseconds: 200),
    );
    await _pumpDetail(tester, api: api);

    final runAgain = find.byKey(const Key('admin-ai-review-run-again'));
    await tester.ensureVisible(runAgain);
    await tester.tap(runAgain);
    await tester.pump();
    await tester.tap(runAgain);
    await tester.pump();

    expect(api.aiReviewCalls, 1);
    await tester.pumpAndSettle();
  });

  testWidgets('workflow controls remain available during GET loading', (
    tester,
  ) async {
    final api = _FakeAdminLearningProjectsApi(
      detail: _detail(),
      getDelay: const Duration(milliseconds: 200),
    );
    await tester.binding.setSurfaceSize(const Size(1200, 900));
    await tester.pumpWidget(
      ProviderScope(
        overrides: [adminLearningProjectsApiProvider.overrideWithValue(api)],
        child: MaterialApp(
          locale: const Locale('en'),
          supportedLocales: const [Locale('en')],
          localizationsDelegates: const [
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          home: Scaffold(
            body: adminLearningProjectDetailDialogForTest(projectId: 'proj-1'),
          ),
        ),
      ),
    );
    await tester.pump();

    expect(find.byKey(const Key('admin-ai-review-loading')), findsOneWidget);
    expect(find.byKey(const Key('admin-project-approve')), findsOneWidget);
    expect(
      find.byKey(const Key('admin-project-request-changes')),
      findsOneWidget,
    );
    expect(find.byKey(const Key('admin-project-reject')), findsOneWidget);
    await tester.pumpAndSettle();
  });

  testWidgets('workflow controls remain available during POST rerun loading', (
    tester,
  ) async {
    final api = _FakeAdminLearningProjectsApi(
      detail: _detail(),
      savedReviewResponse: _savedReviewResponse(
        savedReview: _savedReviewJson(truncated: false),
      ),
      delay: const Duration(milliseconds: 200),
    );
    await _pumpDetail(tester, api: api);

    await _tapKeyed(tester, const Key('admin-ai-review-run-again'));
    await tester.pump();

    expect(
      find.byKey(const Key('admin-ai-review-rerun-loading')),
      findsOneWidget,
    );
    expect(find.byKey(const Key('admin-project-approve')), findsOneWidget);
    expect(
      find.byKey(const Key('admin-project-request-changes')),
      findsOneWidget,
    );
    expect(find.byKey(const Key('admin-project-reject')), findsOneWidget);
    await tester.pumpAndSettle();
  });

  testWidgets('PENDING_REVIEW and CHANGES_REQUESTED show the trigger', (
    tester,
  ) async {
    final pendingApi = _FakeAdminLearningProjectsApi(
      detail: _detail(status: 'PENDING_REVIEW'),
    );
    await _pumpDetail(tester, api: pendingApi);
    expect(find.byKey(const Key('admin-ai-review-run')), findsOneWidget);

    final changesApi = _FakeAdminLearningProjectsApi(
      detail: _detail(status: 'CHANGES_REQUESTED'),
    );
    await _pumpDetail(tester, api: changesApi);
    expect(find.byKey(const Key('admin-ai-review-run')), findsOneWidget);
  });

  testWidgets('pressing trigger sends locale and shows structured review', (
    tester,
  ) async {
    final api = _FakeAdminLearningProjectsApi(
      detail: _detail(),
      reviewResult: _reviewResult(truncated: false),
    );
    await _pumpDetail(tester, api: api);

    await _tapAiReviewTrigger(tester);
    await tester.pumpAndSettle();

    expect(api.aiReviewCalls, 1);
    expect(api.lastLocale, 'en');
    expect(
      find.text('Clear beginner project with solid structure.'),
      findsOneWidget,
    );
  });

  testWidgets('AI result does not pre-fill admin reason fields', (
    tester,
  ) async {
    final api = _FakeAdminLearningProjectsApi(
      detail: _detail(),
      reviewResult: _reviewResult(truncated: false),
    );
    await _pumpDetail(tester, api: api);
    await _tapAiReviewTrigger(tester);
    await tester.pumpAndSettle();

    expect(find.byType(TextField), findsNothing);

    await _tapKeyed(tester, const Key('admin-project-request-changes'));
    await tester.pumpAndSettle();
    expect(find.byType(TextField), findsOneWidget);
    expect(
      tester.widget<TextField>(find.byType(TextField)).controller?.text,
      '',
    );
  });

  testWidgets('Arabic locale uses Arabic labels and ar request locale', (
    tester,
  ) async {
    final api = _FakeAdminLearningProjectsApi(
      detail: _detail(),
      reviewResult: _reviewResult(truncated: true),
    );
    await _pumpDetail(tester, api: api, locale: const Locale('ar'));

    expect(find.text('مراجعة مساعدة بالذكاء الاصطناعي'), findsOneWidget);
    await _tapAiReviewTrigger(tester);
    await tester.pumpAndSettle();

    expect(api.lastLocale, 'ar');
    expect(api.lastGetLocale, 'ar');
    expect(find.text('تشغيل المراجعة مجددًا'), findsOneWidget);
  });

  testWidgets('English labels render for English locale', (tester) async {
    final api = _FakeAdminLearningProjectsApi(detail: _detail());
    await _pumpDetail(tester, api: api, locale: const Locale('en'));

    expect(find.text('AI-assisted review'), findsOneWidget);
    expect(find.text('Run AI review'), findsOneWidget);
  });

  testWidgets('long AI text does not overflow in constrained viewport', (
    tester,
  ) async {
    final long = 'Long review text. ' * 80;
    final api = _FakeAdminLearningProjectsApi(
      detail: _detail(),
      savedReviewResponse: _savedReviewResponse(
        savedReview: _savedReviewJson(truncated: true, summary: long),
      ),
    );
    await _pumpDetail(tester, api: api, surfaceSize: const Size(700, 640));

    expect(tester.takeException(), isNull);
    expect(find.byKey(const Key('admin-ai-review-summary')), findsOneWidget);
  });

  group('strict saved review parsing', () {
    Map<String, dynamic> validSavedReview() =>
        _savedReviewJson(truncated: true);

    Map<String, dynamic> savedResponsePayload(Map<String, dynamic>? saved) {
      return {'projectId': 'proj-1', 'locale': 'en', 'savedReview': saved};
    }

    test('valid saved review parses successfully', () {
      final parsed = AdminLearningProjectSavedAiReviewResponse.fromJson(
        savedResponsePayload(validSavedReview()),
      );
      expect(parsed.savedReview?.schemaVersion, 1);
      expect(parsed.savedReview?.isStale, isFalse);
    });

    for (final field in [
      'generatedByAdminUserId',
      'isStale',
      'schemaVersion',
    ]) {
      test('missing $field fails parsing', () {
        final saved = validSavedReview()..remove(field);
        expect(
          () => AdminLearningProjectSavedAiReviewResponse.fromJson(
            savedResponsePayload(saved),
          ),
          throwsA(isA<FormatException>()),
        );
      });
    }

    test('unsupported schemaVersion fails parsing', () {
      final saved = validSavedReview()..['schemaVersion'] = 2;
      expect(
        () => AdminLearningProjectSavedAiReviewResponse.fromJson(
          savedResponsePayload(saved),
        ),
        throwsA(isA<FormatException>()),
      );
    });

    testWidgets('malformed saved review reaches localized unavailable UI', (
      tester,
    ) async {
      final api = _FakeAdminLearningProjectsApi(
        detail: _detail(),
        malformedSavedReviewJson: savedResponsePayload(
          validSavedReview()..remove('isStale'),
        ),
      );
      await _pumpDetail(tester, api: api);

      expect(find.byKey(const Key('admin-ai-review-failure')), findsOneWidget);
      expect(find.textContaining('Invalid saved AI review'), findsNothing);
      expect(api.aiReviewCalls, 0);
    });
  });

  group('strict AI review coverage parsing', () {
    Map<String, dynamic> validCoverage({
      int includedSteps = 2,
      int totalSteps = 3,
      int includedComponents = 1,
      int totalComponents = 2,
      bool contentTruncated = true,
    }) {
      return {
        'includedSteps': includedSteps,
        'totalSteps': totalSteps,
        'includedComponents': includedComponents,
        'totalComponents': totalComponents,
        'contentTruncated': contentTruncated,
      };
    }

    Map<String, dynamic> reviewPayload(Map<String, dynamic> coverage) {
      return {
        'projectId': 'proj-1',
        'generatedAt': '2026-01-02T00:00:00.000Z',
        'provider': 'mock',
        'model': 'mock-general-learning',
        'coverage': coverage,
        'review': {
          'summary': 'Parsed summary',
          'attentionLevel': 'LOW',
          'strengths': <String>[],
          'importantConcerns': <Map<String, dynamic>>[],
          'safetyNotes': <String>[],
          'improvementSuggestions': <String>[],
          'manualReviewNotes': <String>[],
        },
      };
    }

    test('valid complete coverage parses successfully', () {
      final coverage = AdminLearningProjectAiReviewCoverage.fromJson(
        validCoverage(),
      );
      expect(coverage.contentTruncated, isTrue);
    });

    test('missing contentTruncated fails parsing', () {
      final json = validCoverage()..remove('contentTruncated');
      expect(
        () => AdminLearningProjectAiReviewCoverage.fromJson(json),
        throwsA(isA<FormatException>()),
      );
    });

    testWidgets('malformed POST coverage reaches localized unavailable UI', (
      tester,
    ) async {
      final api = _FakeAdminLearningProjectsApi(
        detail: _detail(),
        malformedReviewJson: reviewPayload(
          validCoverage()..remove('contentTruncated'),
        ),
      );
      await _pumpDetail(tester, api: api);
      await _tapAiReviewTrigger(tester);
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('admin-ai-review-failure')), findsOneWidget);
      expect(find.textContaining('Invalid AI review coverage'), findsNothing);
    });
  });
}
