import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:frontend/features/auth/application/auth_controller.dart';
import 'package:frontend/features/material_discovery/application/material_related_projects_providers.dart';
import 'package:frontend/features/material_discovery/data/material_related_projects_api.dart';
import 'package:frontend/features/material_discovery/presentation/widgets/material_related_project_card.dart';
import 'package:frontend/features/material_discovery/presentation/widgets/material_related_projects_section.dart';

void main() {
  group('MaterialRelatedProjects models', () {
    test('parses LH-05 response contract', () {
      final page = MaterialRelatedProjectsPage.fromJson({
        'materialId': 'mat-arduino',
        'items': [
          {
            'project': {
              'id': '2fdd272a-ca46-4200-9a22-ce5114ff412c',
              'title': 'Robot Car',
              'shortDescription': 'Build a robot',
              'coverImageUrl': '/uploads/projects/cover.jpg',
              'category': {
                'id': 'cat-1',
                'nameEn': 'Robotics',
                'nameAr': 'روبوتات',
              },
              'difficulty': 'BEGINNER',
              'estimatedDurationMinutes': 90,
              'likesCount': 4,
              'requiredMaterialComponentCount': 3,
            },
            'bestMatchedComponent': {
              'componentId': 'comp-1',
              'componentName': 'Arduino board',
              'componentRole': 'REQUIRED_MATERIAL',
              'requiredQuantity': 1,
              'unit': 'piece',
              'canBeSubstituted': false,
            },
            'match': {
              'matchType': 'EXACT',
              'compatibilityScore': 400,
              'matchReasons': ['EXACT_NAME'],
              'additionalMatchedComponentsCount': 0,
            },
            'learnerContext': {
              'hasActiveBuild': true,
              'buildId': 'build-1',
              'buildStatus': 'IN_PROGRESS',
              'action': 'CONTINUE_BUILD',
            },
          },
        ],
        'pagination': {
          'page': 1,
          'limit': 4,
          'total': 1,
          'totalPages': 1,
        },
      });

      expect(page.materialId, 'mat-arduino');
      expect(page.items, hasLength(1));
      expect(page.items.first.project.title, 'Robot Car');
      expect(page.items.first.bestMatchedComponent.componentName, 'Arduino board');
      expect(page.items.first.match.matchType,
          MaterialRelatedProjectMatchType.exact);
      expect(
        page.items.first.learnerContext?.action,
        MaterialRelatedProjectLearnerAction.continueBuild,
      );
    });

    test('deduplicates merged project ids when appending pages', () {
      final merged = mergeMaterialRelatedProjectItems(
        [
          _item(
            projectId: 'proj-1',
            title: 'A',
            componentName: 'Board A',
          ),
          _item(
            projectId: 'proj-2',
            title: 'B',
            componentName: 'Board B',
          ),
        ],
        [
          _item(
            projectId: 'proj-2',
            title: 'B duplicate',
            componentName: 'Board B',
          ),
          _item(
            projectId: 'proj-3',
            title: 'C',
            componentName: 'Board C',
          ),
        ],
      );

      expect(merged.map((item) => item.projectId).toList(),
          ['proj-1', 'proj-2', 'proj-3']);
    });
  });

  group('MaterialRelatedProjectsSectionContent', () {
    testWidgets('renders exact, compatible, and alternative badges', (
      tester,
    ) async {
      await tester.pumpWidget(
        _wrap(
          MaterialRelatedProjectsSectionContent(
            items: [
              _item(
                projectId: 'proj-exact',
                title: 'Exact project',
                componentName: 'Arduino board',
                matchType: MaterialRelatedProjectMatchType.exact,
              ),
              _item(
                projectId: 'proj-compatible',
                title: 'Compatible project',
                componentName: 'Microcontroller board',
                matchType: MaterialRelatedProjectMatchType.compatible,
              ),
              _item(
                projectId: 'proj-alt',
                title: 'Alternative project',
                componentName: 'Arduino-compatible board',
                matchType: MaterialRelatedProjectMatchType.alternative,
              ),
            ],
            currentPage: 1,
            totalPages: 1,
            onOpenProject: (_) {},
            onPrimaryAction: (_) {},
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Exact match'), findsOneWidget);
      expect(find.text('Compatible'), findsOneWidget);
      expect(find.text('Alternative'), findsOneWidget);
      expect(find.textContaining('Arduino board'), findsOneWidget);
      expect(find.text('Find matching projects'), findsNothing);
    });

    testWidgets('guest sees View project action', (tester) async {
      await tester.pumpWidget(
        _wrap(
          MaterialRelatedProjectsSectionContent(
            items: [
              _item(
                projectId: 'proj-1',
                title: 'Robot Car',
                componentName: 'Arduino board',
              ),
            ],
            currentPage: 1,
            totalPages: 1,
            onOpenProject: (_) {},
            onPrimaryAction: (_) {},
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('View project'), findsOneWidget);
      expect(find.text('Continue build'), findsNothing);
    });

    testWidgets('START_BUILD and CONTINUE_BUILD labels map correctly', (
      tester,
    ) async {
      await tester.pumpWidget(
        _wrap(
          MaterialRelatedProjectsSectionContent(
            items: [
              _item(
                projectId: 'proj-start',
                title: 'Start project',
                componentName: 'Arduino board',
                learnerContext: const MaterialRelatedProjectLearnerContext(
                  hasActiveBuild: false,
                  buildId: null,
                  buildStatus: null,
                  action: MaterialRelatedProjectLearnerAction.startBuild,
                ),
              ),
              _item(
                projectId: 'proj-continue',
                title: 'Continue project',
                componentName: 'Arduino board',
                learnerContext: const MaterialRelatedProjectLearnerContext(
                  hasActiveBuild: true,
                  buildId: 'build-1',
                  buildStatus: 'IN_PROGRESS',
                  action: MaterialRelatedProjectLearnerAction.continueBuild,
                ),
              ),
            ],
            currentPage: 1,
            totalPages: 1,
            onOpenProject: (_) {},
            onPrimaryAction: (_) {},
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Start build'), findsOneWidget);
      expect(find.text('Continue build'), findsOneWidget);
    });

    testWidgets('shows additional matched count only when greater than zero', (
      tester,
    ) async {
      await tester.pumpWidget(
        _wrap(
          MaterialRelatedProjectsSectionContent(
            items: [
              _item(
                projectId: 'proj-1',
                title: 'Single match',
                componentName: 'Arduino board',
              ),
              _item(
                projectId: 'proj-2',
                title: 'Multi match',
                componentName: 'Arduino board',
                additionalCount: 2,
              ),
            ],
            currentPage: 1,
            totalPages: 1,
            onOpenProject: (_) {},
            onPrimaryAction: (_) {},
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.textContaining('Also matches 2 more components'), findsOneWidget);
      expect(find.textContaining('Also matches 0'), findsNothing);
    });

    testWidgets('empty state opens learning hub without title query', (
      tester,
    ) async {
      final router = GoRouter(
        routes: [
          GoRoute(
            path: '/',
            builder: (context, state) => MaterialRelatedProjectsSectionContent(
              items: const [],
              currentPage: 1,
              totalPages: 0,
              onBrowseLearningHub: () =>
                  GoRouter.of(context).go('/learning'),
            ),
          ),
          GoRoute(
            path: '/learning',
            builder: (context, state) => Scaffold(
              body: Text('hub:${state.uri.query}'),
            ),
          ),
        ],
      );

      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp.router(routerConfig: router),
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('Browse Learning Hub'));
      await tester.pumpAndSettle();

      expect(find.text('hub:'), findsOneWidget);
      expect(find.textContaining('Arduino'), findsNothing);
    });

    testWidgets('long project title does not overflow card width', (
      tester,
    ) async {
      await tester.pumpWidget(
        _wrap(
          SizedBox(
            width: 320,
            child: MaterialRelatedProjectCard(
              item: _item(
                projectId: 'proj-long',
                title:
                    'An extremely long learning project title that should wrap inside the compact related project card without causing horizontal overflow',
                componentName: 'Arduino board',
              ),
              onOpenProject: () {},
              onPrimaryAction: () {},
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.textContaining('extremely long learning project'), findsOneWidget);
    });

    testWidgets('missing cover image uses fallback icon', (tester) async {
      await tester.pumpWidget(
        _wrap(
          MaterialRelatedProjectCard(
            item: _item(
              projectId: 'proj-no-cover',
              title: 'No cover project',
              componentName: 'Arduino board',
            ),
            onOpenProject: () {},
            onPrimaryAction: () {},
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byIcon(Icons.architecture_outlined), findsOneWidget);
    });

    testWidgets('Arabic labels render in RTL', (tester) async {
      await tester.pumpWidget(
        _wrap(
          MaterialRelatedProjectsSectionContent(
            items: const [
              MaterialRelatedProjectItem(
                project: MaterialRelatedProjectSummary(
                  id: 'proj-ar',
                  title: 'مشروع الروبوت',
                  shortDescription: null,
                  coverImageUrl: null,
                  category: MaterialRelatedProjectCategory(
                    id: 'cat-1',
                    nameEn: 'Robotics',
                    nameAr: 'روبوتات',
                  ),
                  difficulty: 'BEGINNER',
                  estimatedDurationMinutes: 60,
                  likesCount: 0,
                  requiredMaterialComponentCount: 1,
                ),
                bestMatchedComponent: MaterialRelatedProjectComponent(
                  componentId: 'comp-1',
                  componentName: 'لوحة أردوينو',
                  componentRole: 'REQUIRED_MATERIAL',
                  requiredQuantity: 1,
                  unit: 'piece',
                  canBeSubstituted: false,
                ),
                match: MaterialRelatedProjectMatch(
                  matchType: MaterialRelatedProjectMatchType.exact,
                  compatibilityScore: 400,
                  matchReasons: ['EXACT_NAME'],
                  additionalMatchedComponentsCount: 0,
                ),
              ),
            ],
            currentPage: 1,
            totalPages: 1,
            onOpenProject: (_) {},
            onPrimaryAction: (_) {},
          ),
          locale: const Locale('ar'),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('مشاريع يمكنك تنفيذها بهذه المادة'), findsOneWidget);
      expect(find.text('تطابق مباشر'), findsOneWidget);
      expect(find.textContaining('لوحة أردوينو'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  });

  group('MaterialRelatedProjects providers', () {
    test('initial provider surfaces API errors', () async {
      final fakeApi = _FakeMaterialRelatedProjectsApi(
        failFirst: true,
        failCount: 1,
      );
      final container = ProviderContainer(
        overrides: [
          materialRelatedProjectsApiProvider.overrideWithValue(fakeApi),
        ],
      );
      addTearDown(container.dispose);

      final subscription = container.listen(
        materialRelatedProjectsInitialProvider('mat-arduino'),
        (_, _) {},
      );

      await Future<void>.delayed(Duration.zero);
      await Future<void>.delayed(Duration.zero);

      expect(subscription.read().hasError, isTrue);
      expect(fakeApi.calls, isNotEmpty);
    });
  });

  group('MaterialRelatedProjectsSection', () {
    testWidgets('calls related-projects endpoint after material id is provided', (
      tester,
    ) async {
      final fakeApi = _FakeMaterialRelatedProjectsApi();

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            materialRelatedProjectsApiProvider.overrideWithValue(fakeApi),
          ],
          child: MaterialApp(
            home: Scaffold(
              body: SingleChildScrollView(
                child: MaterialRelatedProjectsSection(materialId: 'mat-arduino'),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(fakeApi.calls, isNotEmpty);
      expect(fakeApi.calls.first['materialId'], 'mat-arduino');
      expect(fakeApi.calls.first['page'], 1);
      expect(find.text('Robot Car'), findsOneWidget);
      expect(find.textContaining('Arduino board'), findsOneWidget);
      expect(find.text('Robot Car').evaluate().length, 1);
      expect(
        find.byWidgetPredicate(
          (widget) =>
              widget is MaterialRelatedProjectCard &&
              widget.item.projectId ==
                  '2fdd272a-ca46-4200-9a22-ce5114ff412c',
        ),
        findsOneWidget,
      );
      expect(find.text('Find matching projects'), findsNothing);
    });

    testWidgets('load more appends without duplicate projects', (tester) async {
      final fakeApi = _FakeMaterialRelatedProjectsApi(enablePagination: true);

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            materialRelatedProjectsApiProvider.overrideWithValue(fakeApi),
          ],
          child: MaterialApp(
            home: Scaffold(
              body: SingleChildScrollView(
                child: MaterialRelatedProjectsSection(materialId: 'mat-arduino'),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Robot Car'), findsOneWidget);
      expect(find.text('Plant Monitor'), findsNothing);

      await tester.tap(find.text('Load more'));
      await tester.pumpAndSettle();

      expect(find.text('Robot Car'), findsOneWidget);
      expect(find.text('Plant Monitor'), findsOneWidget);
      expect(find.text('Robot Car').evaluate().length, 1);
    });

    testWidgets('error state retries fetch', (tester) async {
      final fakeApi = _FakeMaterialRelatedProjectsApi(
        failFirst: true,
        failCount: 1,
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authControllerProvider.overrideWith(_BootstrappedGuestAuthController.new),
            materialRelatedProjectsApiProvider.overrideWithValue(fakeApi),
          ],
          child: MaterialApp(
            home: Scaffold(
              body: SingleChildScrollView(
                child: MaterialRelatedProjectsSection(materialId: 'mat-arduino'),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.textContaining('Couldn'), findsOneWidget);
      expect(find.text('Try again'), findsOneWidget);

      await tester.tap(find.text('Try again'));
      await tester.pumpAndSettle();

      expect(find.text('Robot Car'), findsOneWidget);
      expect(fakeApi.calls.length, greaterThan(1));
    });
  });
}

class _BootstrappedGuestAuthController extends AuthController {
  @override
  AuthState build() => const AuthState(hasBootstrapped: true);
}

class _FakeMaterialRelatedProjectsApi extends MaterialRelatedProjectsApi {
  _FakeMaterialRelatedProjectsApi({
    this.failFirst = false,
    this.failCount = 1,
    this.enablePagination = false,
  }) : super(Dio());

  final bool failFirst;
  final int failCount;
  final bool enablePagination;
  final List<Map<String, dynamic>> calls = [];
  var _attempts = 0;

  @override
  Future<MaterialRelatedProjectsPage> fetchRelatedProjects({
    required String materialId,
    required int page,
    required int limit,
    CancelToken? cancelToken,
  }) async {
    calls.add({
      'materialId': materialId,
      'page': page,
      'limit': limit,
    });

    _attempts += 1;
    if (failFirst && _attempts <= failCount) {
      throw Exception('network');
    }

    if (enablePagination && page > 1) {
      return MaterialRelatedProjectsPage(
        materialId: materialId,
        items: [
          _item(
            projectId: 'proj-2',
            title: 'Plant Monitor',
            componentName: 'Arduino board',
          ),
        ],
        pagination: MaterialRelatedProjectsPagination(
          page: 2,
          limit: limit,
          total: 2,
          totalPages: 2,
        ),
      );
    }

    return MaterialRelatedProjectsPage(
      materialId: materialId,
      items: [
        _item(
          projectId: '2fdd272a-ca46-4200-9a22-ce5114ff412c',
          title: 'Robot Car',
          componentName: 'Arduino board',
          matchType: MaterialRelatedProjectMatchType.exact,
        ),
      ],
      pagination: MaterialRelatedProjectsPagination(
        page: page,
        limit: limit,
        total: enablePagination ? 2 : 1,
        totalPages: enablePagination ? 2 : 1,
      ),
    );
  }
}

MaterialRelatedProjectItem _item({
  required String projectId,
  required String title,
  required String componentName,
  MaterialRelatedProjectMatchType matchType =
      MaterialRelatedProjectMatchType.exact,
  int additionalCount = 0,
  MaterialRelatedProjectLearnerContext? learnerContext,
}) {
  return MaterialRelatedProjectItem(
    project: MaterialRelatedProjectSummary(
      id: projectId,
      title: title,
      shortDescription: null,
      coverImageUrl: null,
      category: const MaterialRelatedProjectCategory(
        id: 'cat-1',
        nameEn: 'Electronics',
        nameAr: 'إلكترونيات',
      ),
      difficulty: 'BEGINNER',
      estimatedDurationMinutes: 90,
      likesCount: 2,
      requiredMaterialComponentCount: 2,
    ),
    bestMatchedComponent: MaterialRelatedProjectComponent(
      componentId: 'comp-$projectId',
      componentName: componentName,
      componentRole: 'REQUIRED_MATERIAL',
      requiredQuantity: 1,
      unit: 'piece',
      canBeSubstituted: false,
    ),
    match: MaterialRelatedProjectMatch(
      matchType: matchType,
      compatibilityScore: 400,
      matchReasons: const ['EXACT_NAME'],
      additionalMatchedComponentsCount: additionalCount,
    ),
    learnerContext: learnerContext,
  );
}

Widget _wrap(
  Widget child, {
  Locale? locale,
}) {
  return ProviderScope(
    child: MaterialApp(
      locale: locale,
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [Locale('en'), Locale('ar')],
      home: Scaffold(
        body: SingleChildScrollView(child: child),
      ),
    ),
  );
}
