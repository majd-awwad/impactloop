import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/app/theme/app_theme.dart';
import 'package:frontend/features/auth/application/auth_controller.dart';
import 'package:frontend/features/auth/data/models/user.dart';
import 'package:frontend/features/material_discovery/application/liked_materials_controller.dart';
import 'package:frontend/features/material_discovery/application/material_discovery_providers.dart';
import 'package:frontend/features/material_discovery/data/api_material_discovery_repository.dart';
import 'package:frontend/features/material_discovery/data/material_discovery_api_mapper.dart';
import 'package:frontend/features/material_discovery/domain/liked_materials_repository.dart';
import 'package:frontend/features/material_discovery/domain/liked_materials_result.dart';
import 'package:frontend/features/material_discovery/domain/material_discovery_result.dart';
import 'package:frontend/features/material_discovery/domain/material_engagement.dart';
import 'package:frontend/features/material_discovery/presentation/pages/liked_materials_page.dart';
import 'package:go_router/go_router.dart';

void main() {
  test('API requests and parses the liked materials envelope', () async {
    final repository = ApiMaterialDiscoveryRepository(
      _dioWithHandler((options) {
        expect(options.method, 'GET');
        expect(options.path, '/api/materials/me/liked');
        expect(options.queryParameters, {'page': 2, 'limit': 20});
        return {
          'success': true,
          'data': {
            'items': [
              {
                'likedAt': '2026-07-29T00:00:00.000Z',
                'material': _materialJson('material-1'),
              },
            ],
            'pagination': {
              'page': 2,
              'limit': 20,
              'total': 21,
              'totalPages': 2,
            },
          },
        };
      }),
    );

    final result = await repository.fetchLikedMaterials(page: 2);

    expect(result.items.single.material.id, 'material-1');
    expect(result.items.single.material.isLiked, isTrue);
    expect(result.items.single.likedAt, DateTime.utc(2026, 7, 29));
    expect(result.pagination.total, 21);
  });

  test('contract rejects missing required wrapper fields', () {
    expect(
      () => LikedMaterialsResult.fromJson({
        'items': [
          {'material': _materialJson('material-1')},
        ],
        'pagination': {'page': 1, 'limit': 20, 'total': 1, 'totalPages': 1},
      }, parseMaterial: MaterialDiscoveryApiMapper.fromJson),
      throwsA(isA<FormatException>()),
    );
  });

  test(
    'controller paginates, de-duplicates, and removes after unlike',
    () async {
      final repository = _FakeLikedMaterialsRepository(
        pages: {
          1: _result(['a', 'b'], page: 1, total: 3, totalPages: 2),
          2: _result(['b', 'c'], page: 2, total: 3, totalPages: 2),
        },
      );
      final container = _container(repository);
      addTearDown(container.dispose);
      final subscription = container.listen(
        likedMaterialsControllerProvider,
        (_, _) {},
      );
      addTearDown(subscription.close);

      await container.read(likedMaterialsControllerProvider.future);
      await container
          .read(likedMaterialsControllerProvider.notifier)
          .loadMore();
      expect(
        container
            .read(likedMaterialsControllerProvider)
            .requireValue
            .items
            .map((item) => item.material.id),
        ['a', 'b', 'c'],
      );

      final notifier = container.read(
        likedMaterialsControllerProvider.notifier,
      );
      final unlike = notifier.unlike('b');
      final duplicateUnlike = notifier.unlike('b');
      await Future.wait([unlike, duplicateUnlike]);
      expect(repository.unlikedIds, ['b']);
      expect(
        container
            .read(likedMaterialsControllerProvider)
            .requireValue
            .items
            .any((item) => item.material.id == 'b'),
        isFalse,
      );
    },
  );

  test('failed unlike keeps the material and clears its busy state', () async {
    final repository = _FakeLikedMaterialsRepository(
      pages: {
        1: _result(['a'], page: 1, total: 1, totalPages: 1),
      },
      failUnlike: true,
    );
    final container = _container(repository);
    addTearDown(container.dispose);
    final subscription = container.listen(
      likedMaterialsControllerProvider,
      (_, _) {},
    );
    addTearDown(subscription.close);
    await container.read(likedMaterialsControllerProvider.future);

    await expectLater(
      container.read(likedMaterialsControllerProvider.notifier).unlike('a'),
      throwsStateError,
    );

    final state = container.read(likedMaterialsControllerProvider).requireValue;
    expect(state.items.single.material.id, 'a');
    expect(state.pendingUnlikeIds, isEmpty);
  });

  test(
    'load-more failure preserves the first page and exposes retry state',
    () async {
      final repository = _FakeLikedMaterialsRepository(
        pages: {
          1: _result(['a'], page: 1, total: 2, totalPages: 2),
          2: _result(['b'], page: 2, total: 2, totalPages: 2),
        },
        failedPages: {2},
      );
      final container = _container(repository);
      addTearDown(container.dispose);
      final subscription = container.listen(
        likedMaterialsControllerProvider,
        (_, _) {},
      );
      addTearDown(subscription.close);
      await container.read(likedMaterialsControllerProvider.future);

      await expectLater(
        container.read(likedMaterialsControllerProvider.notifier).loadMore(),
        throwsStateError,
      );

      final state = container
          .read(likedMaterialsControllerProvider)
          .requireValue;
      expect(state.items.map((item) => item.material.id), ['a']);
      expect(state.hasLoadMoreError, isTrue);
    },
  );

  test('refresh replaces stale pages with the latest first page', () async {
    final repository = _FakeLikedMaterialsRepository(
      pages: {
        1: _result(['a'], page: 1, total: 1, totalPages: 1),
      },
    );
    final container = _container(repository);
    addTearDown(container.dispose);
    final subscription = container.listen(
      likedMaterialsControllerProvider,
      (_, _) {},
    );
    addTearDown(subscription.close);
    await container.read(likedMaterialsControllerProvider.future);
    repository.pages[1] = _result(['b'], page: 1, total: 1, totalPages: 1);

    await container.read(likedMaterialsControllerProvider.notifier).refresh();

    expect(
      container
          .read(likedMaterialsControllerProvider)
          .requireValue
          .items
          .single
          .material
          .id,
      'b',
    );
  });

  test(
    'two different unlikes reconcile once and stay removed in either completion order',
    () async {
      for (final completionOrder in const [
        ['a', 'b'],
        ['b', 'a'],
      ]) {
        final repository = _ControlledLikedMaterialsRepository();
        final harness = await _controlledHarness(
          repository,
          _result(['a', 'b', 'c'], page: 1, total: 3, totalPages: 1),
        );

        final unlikeA = harness.notifier.unlike('a');
        final unlikeB = harness.notifier.unlike('b');
        expect(repository.unlikeRequestIds, ['a', 'b']);

        repository.completeUnlike(completionOrder.first);
        await (completionOrder.first == 'a' ? unlikeA : unlikeB);
        expect(repository.fetchCalls, hasLength(1));

        repository.completeUnlike(completionOrder.last);
        await (completionOrder.last == 'a' ? unlikeA : unlikeB);
        await _flushMicrotasks();

        expect(repository.fetchCalls, hasLength(2));
        repository.completeFetch(
          1,
          _result(['c'], page: 1, total: 1, totalPages: 1),
        );
        await _flushMicrotasks();

        final state = harness.container
            .read(likedMaterialsControllerProvider)
            .requireValue;
        expect(state.items.map((item) => item.material.id), ['c']);
        expect(state.total, 1);
        harness.dispose();
      }
    },
  );

  test(
    'a stale reconciliation is ignored and the newer reconciliation is serialized',
    () async {
      final repository = _ControlledLikedMaterialsRepository();
      final harness = await _controlledHarness(
        repository,
        _result(['a', 'b', 'c'], page: 1, total: 3, totalPages: 1),
      );
      addTearDown(harness.dispose);

      final unlikeA = harness.notifier.unlike('a');
      repository.completeUnlike('a');
      await unlikeA;
      await _flushMicrotasks();
      expect(repository.fetchCalls, hasLength(2));

      final unlikeB = harness.notifier.unlike('b');
      repository.completeUnlike('b');
      await unlikeB;
      await _flushMicrotasks();
      expect(
        repository.fetchCalls,
        hasLength(2),
        reason: 'the second reconciliation must wait for the first',
      );

      repository.completeFetch(
        1,
        _result(['a', 'b', 'c'], page: 1, total: 3, totalPages: 1),
      );
      await _flushMicrotasks();
      expect(repository.fetchCalls, hasLength(3));
      expect(
        harness.container
            .read(likedMaterialsControllerProvider)
            .requireValue
            .items
            .map((item) => item.material.id),
        ['c'],
      );

      repository.completeFetch(
        2,
        _result(['c'], page: 1, total: 1, totalPages: 1),
      );
      await _flushMicrotasks();

      final state = harness.container
          .read(likedMaterialsControllerProvider)
          .requireValue;
      expect(state.items.map((item) => item.material.id), ['c']);
      expect(state.total, 1);
    },
  );

  test(
    'refresh reflecting an unlike before its response does not decrement total twice',
    () async {
      final repository = _ControlledLikedMaterialsRepository();
      final harness = await _controlledHarness(
        repository,
        _result(['a', 'b'], page: 1, total: 2, totalPages: 1),
      );
      addTearDown(harness.dispose);

      final unlike = harness.notifier.unlike('a');
      final refresh = harness.notifier.refresh();
      repository.completeFetch(
        1,
        _result(['b'], page: 1, total: 1, totalPages: 1),
      );
      await refresh;

      repository.completeUnlike('a');
      await unlike;
      await _flushMicrotasks();
      expect(
        harness.container
            .read(likedMaterialsControllerProvider)
            .requireValue
            .total,
        1,
      );

      repository.completeFetch(
        2,
        _result(['b'], page: 1, total: 1, totalPages: 1),
      );
      await _flushMicrotasks();
      expect(
        harness.container
            .read(likedMaterialsControllerProvider)
            .requireValue
            .total,
        1,
      );
    },
  );

  test(
    'older manual refresh result cannot overwrite a newer refresh',
    () async {
      final repository = _ControlledLikedMaterialsRepository();
      final harness = await _controlledHarness(
        repository,
        _result(['a'], page: 1, total: 1, totalPages: 1),
      );
      addTearDown(harness.dispose);

      final older = harness.notifier.refresh();
      final newer = harness.notifier.refresh();
      repository.completeFetch(
        2,
        _result(['new'], page: 1, total: 1, totalPages: 1),
      );
      await newer;
      repository.completeFetch(
        1,
        _result(['old'], page: 1, total: 1, totalPages: 1),
      );
      await older;

      expect(
        harness.container
            .read(likedMaterialsControllerProvider)
            .requireValue
            .items
            .single
            .material
            .id,
        'new',
      );
    },
  );

  test(
    'failed reconciliation retains confirmed removal and exposes refresh retry',
    () async {
      final repository = _ControlledLikedMaterialsRepository();
      final harness = await _controlledHarness(
        repository,
        _result(['a', 'b'], page: 1, total: 2, totalPages: 1),
      );
      addTearDown(harness.dispose);

      final unlike = harness.notifier.unlike('a');
      repository.completeUnlike('a');
      await unlike;
      await _flushMicrotasks();
      repository.failFetch(1);
      await _flushMicrotasks();

      final state = harness.container
          .read(likedMaterialsControllerProvider)
          .requireValue;
      expect(state.items.map((item) => item.material.id), ['b']);
      expect(state.total, 1);
      expect(state.hasRefreshError, isTrue);
    },
  );

  test(
    'stale load-more cannot restore a material removed by a newer unlike',
    () async {
      final repository = _ControlledLikedMaterialsRepository();
      final harness = await _controlledHarness(
        repository,
        _result(['a'], page: 1, total: 2, totalPages: 2),
      );
      addTearDown(harness.dispose);

      final loadMore = harness.notifier.loadMore();
      final unlike = harness.notifier.unlike('a');
      repository.completeUnlike('a');
      await unlike;
      repository.completeFetch(
        1,
        _result(['a', 'b'], page: 2, total: 2, totalPages: 2),
      );
      await loadMore;
      await _flushMicrotasks();

      expect(repository.fetchCalls, hasLength(3));
      expect(
        harness.container
            .read(likedMaterialsControllerProvider)
            .requireValue
            .items,
        isEmpty,
      );
      repository.completeFetch(
        2,
        _result(['b'], page: 1, total: 1, totalPages: 1),
      );
      await _flushMicrotasks();

      final state = harness.container
          .read(likedMaterialsControllerProvider)
          .requireValue;
      expect(state.items.map((item) => item.material.id), ['b']);
      expect(state.total, 1);
    },
  );

  test(
    'stale manual refresh cannot restore a material removed by a newer unlike',
    () async {
      final repository = _ControlledLikedMaterialsRepository();
      final harness = await _controlledHarness(
        repository,
        _result(['a', 'b'], page: 1, total: 2, totalPages: 1),
      );
      addTearDown(harness.dispose);

      final refresh = harness.notifier.refresh();
      final unlike = harness.notifier.unlike('a');
      repository.completeUnlike('a');
      await unlike;
      repository.completeFetch(
        1,
        _result(['a', 'b'], page: 1, total: 2, totalPages: 1),
      );
      await refresh;
      await _flushMicrotasks();

      expect(repository.fetchCalls, hasLength(3));
      expect(
        harness.container
            .read(likedMaterialsControllerProvider)
            .requireValue
            .items
            .map((item) => item.material.id),
        ['b'],
      );
      repository.completeFetch(
        2,
        _result(['b'], page: 1, total: 1, totalPages: 1),
      );
      await _flushMicrotasks();
      expect(
        harness.container
            .read(likedMaterialsControllerProvider)
            .requireValue
            .items
            .map((item) => item.material.id),
        ['b'],
      );
    },
  );

  testWidgets('empty collection offers material discovery', (tester) async {
    final repository = _FakeLikedMaterialsRepository(
      pages: {1: _result([], page: 1, total: 0, totalPages: 0)},
    );
    await _pumpPage(tester, repository: repository);

    expect(find.text('No liked materials yet'), findsOneWidget);
    expect(find.text('Browse materials'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('initial failure retries without losing the page route', (
    tester,
  ) async {
    final repository = _FakeLikedMaterialsRepository(
      pages: {
        1: _result(['a'], page: 1, total: 1, totalPages: 1),
      },
      failedPages: {1},
    );
    await _pumpPage(tester, repository: repository);
    expect(find.text('Could not load liked materials.'), findsOneWidget);

    repository.failedPages.clear();
    await tester.tap(find.text('Try again'));
    await tester.pumpAndSettle();

    expect(find.text('Reusable sensor a'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('material card opens the existing detail route', (tester) async {
    final repository = _FakeLikedMaterialsRepository(
      pages: {
        1: _result(['a'], page: 1, total: 1, totalPages: 1),
      },
    );
    await _pumpPage(tester, repository: repository);

    await tester.tap(find.text('Reusable sensor a'));
    await tester.pumpAndSettle();

    expect(find.text('Material a'), findsOneWidget);
  });

  testWidgets('Arabic collection fits 320px at increased text scale', (
    tester,
  ) async {
    final repository = _FakeLikedMaterialsRepository(
      pages: {
        1: _result(['a'], page: 1, total: 1, totalPages: 1),
      },
    );
    tester.view.physicalSize = const Size(320, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await _pumpPage(
      tester,
      repository: repository,
      locale: const Locale('ar'),
      textScale: 1.6,
    );

    expect(find.text('المواد التي أعجبتني'), findsOneWidget);
    expect(find.bySemanticsLabel(RegExp('إزالة')), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

ProviderContainer _container(LikedMaterialsRepository repository) {
  return ProviderContainer(
    overrides: [
      authControllerProvider.overrideWith(_LearnerAuthController.new),
      likedMaterialsRepositoryProvider.overrideWithValue(repository),
    ],
  );
}

Future<_ControlledHarness> _controlledHarness(
  _ControlledLikedMaterialsRepository repository,
  LikedMaterialsResult initial,
) async {
  final container = _container(repository);
  final subscription = container.listen(
    likedMaterialsControllerProvider,
    (_, _) {},
  );
  final loading = container.read(likedMaterialsControllerProvider.future);
  await _flushMicrotasks();
  repository.completeFetch(0, initial);
  await loading;
  return _ControlledHarness(
    container: container,
    subscription: subscription,
    notifier: container.read(likedMaterialsControllerProvider.notifier),
  );
}

Future<void> _flushMicrotasks() => Future<void>.delayed(Duration.zero);

class _ControlledHarness {
  const _ControlledHarness({
    required this.container,
    required this.subscription,
    required this.notifier,
  });

  final ProviderContainer container;
  final ProviderSubscription<AsyncValue<LikedMaterialsState>> subscription;
  final LikedMaterialsController notifier;

  void dispose() {
    subscription.close();
    container.dispose();
  }
}

Future<void> _pumpPage(
  WidgetTester tester, {
  required LikedMaterialsRepository repository,
  Locale locale = const Locale('en'),
  double textScale = 1,
}) async {
  final router = GoRouter(
    initialLocation: '/materials/liked',
    routes: [
      GoRoute(
        path: '/materials/liked',
        builder: (_, _) => const LikedMaterialsPage(),
      ),
      GoRoute(
        path: '/materials',
        builder: (_, _) => const Scaffold(body: Text('Materials discovery')),
      ),
      GoRoute(
        path: '/materials/:id',
        builder: (_, state) =>
            Scaffold(body: Text('Material ${state.pathParameters['id']}')),
      ),
      GoRoute(
        path: '/profile',
        builder: (_, _) => const Scaffold(body: Text('Profile')),
      ),
      GoRoute(
        path: '/home',
        builder: (_, _) => const Scaffold(body: Text('Home')),
      ),
      GoRoute(
        path: '/learning',
        builder: (_, _) => const Scaffold(body: Text('Learning')),
      ),
      GoRoute(
        path: '/learner/reservations',
        builder: (_, _) => const Scaffold(body: Text('Reservations')),
      ),
    ],
  );
  addTearDown(router.dispose);

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        authControllerProvider.overrideWith(_LearnerAuthController.new),
        likedMaterialsRepositoryProvider.overrideWithValue(repository),
      ],
      child: MaterialApp.router(
        theme: AppTheme.light,
        locale: locale,
        supportedLocales: const [Locale('en'), Locale('ar')],
        localizationsDelegates: const [
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(
            context,
          ).copyWith(textScaler: TextScaler.linear(textScale)),
          child: child!,
        ),
        routerConfig: router,
      ),
    ),
  );
  await tester.pumpAndSettle();
}

class _LearnerAuthController extends AuthController {
  @override
  AuthState build() => AuthState(
    user: User(
      id: 'learner-1',
      displayName: 'Learner',
      email: 'learner@example.com',
      accountStatus: 'ACTIVE',
      roles: const ['LEARNER', 'SUPPLIER'],
      activeRole: 'SUPPLIER',
      createdAt: DateTime(2026),
    ),
    accessToken: 'token',
    hasBootstrapped: true,
  );
}

class _FakeLikedMaterialsRepository implements LikedMaterialsRepository {
  _FakeLikedMaterialsRepository({
    required this.pages,
    this.failUnlike = false,
    Set<int>? failedPages,
  }) : failedPages = failedPages ?? <int>{};

  final Map<int, LikedMaterialsResult> pages;
  final bool failUnlike;
  final Set<int> failedPages;
  final List<String> unlikedIds = [];

  @override
  Future<LikedMaterialsResult> fetchLikedMaterials({
    required int page,
    int limit = 20,
  }) async {
    if (failedPages.contains(page)) throw StateError('Page $page failed');
    final result = pages[page];
    if (result == null) throw StateError('Missing page $page');
    return result;
  }

  @override
  Future<MaterialEngagement> unlikeMaterial(
    String id, {
    String? recommendationImpressionId,
  }) async {
    if (failUnlike) throw StateError('Unlike failed');
    unlikedIds.add(id);
    for (final entry in pages.entries.toList()) {
      final filtered = entry.value.items
          .where((item) => item.material.id != id)
          .toList(growable: false);
      pages[entry.key] = LikedMaterialsResult(
        items: filtered,
        pagination: MaterialDiscoveryPagination(
          page: entry.value.pagination.page,
          limit: entry.value.pagination.limit,
          total: entry.value.pagination.total > 0
              ? entry.value.pagination.total - 1
              : 0,
          totalPages: entry.value.pagination.totalPages,
        ),
      );
    }
    return MaterialEngagement(materialId: id, likesCount: 0, isLiked: false);
  }
}

class _ControlledLikedMaterialsRepository implements LikedMaterialsRepository {
  final List<_ControlledFetchCall> fetchCalls = <_ControlledFetchCall>[];
  final List<String> unlikeRequestIds = <String>[];
  final Map<String, Completer<void>> _unlikeCompleters =
      <String, Completer<void>>{};

  @override
  Future<LikedMaterialsResult> fetchLikedMaterials({
    required int page,
    int limit = 20,
  }) {
    final completer = Completer<LikedMaterialsResult>();
    fetchCalls.add(_ControlledFetchCall(page: page, completer: completer));
    return completer.future;
  }

  @override
  Future<MaterialEngagement> unlikeMaterial(
    String id, {
    String? recommendationImpressionId,
  }) async {
    unlikeRequestIds.add(id);
    final completer = Completer<void>();
    _unlikeCompleters[id] = completer;
    await completer.future;
    return MaterialEngagement(materialId: id, likesCount: 0, isLiked: false);
  }

  void completeFetch(int index, LikedMaterialsResult result) {
    fetchCalls[index].completer.complete(result);
  }

  void failFetch(int index) {
    fetchCalls[index].completer.completeError(StateError('Refresh failed'));
  }

  void completeUnlike(String materialId) {
    _unlikeCompleters[materialId]!.complete();
  }
}

class _ControlledFetchCall {
  const _ControlledFetchCall({required this.page, required this.completer});

  final int page;
  final Completer<LikedMaterialsResult> completer;
}

LikedMaterialsResult _result(
  List<String> ids, {
  required int page,
  required int total,
  required int totalPages,
}) {
  return LikedMaterialsResult(
    items: ids
        .map(
          (id) => LikedMaterialItem(
            likedAt: DateTime.utc(2026, 7, 29),
            material: MaterialDiscoveryApiMapper.fromJson(_materialJson(id)),
          ),
        )
        .toList(growable: false),
    pagination: MaterialDiscoveryPagination(
      page: page,
      limit: 20,
      total: total,
      totalPages: totalPages,
    ),
  );
}

Map<String, dynamic> _materialJson(String id) => {
  'id': id,
  'title': 'Reusable sensor $id',
  'description': 'A reusable sensor for learning projects.',
  'category': {
    'id': 'category-1',
    'nameEn': 'Electronics',
    'nameAr': 'إلكترونيات',
  },
  'condition': 'GOOD',
  'status': 'AVAILABLE',
  'quantity': 4,
  'availableQuantity': 4,
  'unit': 'piece',
  'isFree': true,
  'price': null,
  'city': 'Nablus',
  'area': 'Rafidia',
  'deliveryAvailable': false,
  'pickupAllowed': true,
  'imageUrl': null,
  'supplierName': 'Workshop',
  'viewsCount': 3,
  'likesCount': 2,
  'isLiked': true,
  'createdAt': '2026-07-28T00:00:00.000Z',
};

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
