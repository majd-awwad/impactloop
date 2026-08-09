import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:go_router/go_router.dart';

import 'package:frontend/core/errors/api_exception.dart';
import 'package:frontend/features/auth/application/auth_controller.dart';
import 'package:frontend/features/auth/data/models/user.dart';
import 'package:frontend/features/material_discovery/application/material_discovery_providers.dart';
import 'package:frontend/features/material_discovery/data/api_material_discovery_repository.dart';
import 'package:frontend/features/material_discovery/domain/discovery_material.dart';
import 'package:frontend/features/material_discovery/domain/material_discovery_query.dart';
import 'package:frontend/features/material_discovery/domain/material_discovery_repository.dart';
import 'package:frontend/features/material_discovery/domain/material_discovery_result.dart';
import 'package:frontend/features/material_discovery/domain/material_engagement.dart';
import 'package:frontend/features/material_discovery/data/material_discovery_api_mapper.dart';
import 'package:frontend/features/material_discovery/presentation/pages/public_supplier_page.dart';
import 'package:frontend/features/material_discovery/presentation/widgets/public_supplier_profile_widgets.dart';
import 'package:frontend/l10n/app_localizations.dart';
import 'package:frontend/shared/widgets/materials/materials_ui_palette.dart';

class _FakeSupplierRepository implements MaterialDiscoveryRepository {
  _FakeSupplierRepository({
    required this.supplier,
    this.materials = const [],
    this.followShouldFail = false,
    this.followGate,
  });

  PublicSupplier supplier;
  final List<DiscoveryMaterial> materials;
  final bool followShouldFail;
  final Completer<void>? followGate;
  int followCalls = 0;

  @override
  Future<MaterialDiscoveryResult> fetchMaterials(
    MaterialDiscoveryQuery query,
  ) async {
    return const MaterialDiscoveryResult(
      items: [],
      pagination: MaterialDiscoveryPagination(
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      ),
    );
  }

  @override
  Future<DiscoveryMaterial?> getMaterialById(
    String id, {
    String? recommendationImpressionId,
  }) async => null;

  @override
  Future<MaterialEngagement> likeMaterial(
    String id, {
    String? recommendationImpressionId,
  }) async {
    return MaterialEngagement(materialId: id, likesCount: 0, isLiked: true);
  }

  @override
  Future<MaterialEngagement> unlikeMaterial(
    String id, {
    String? recommendationImpressionId,
  }) async {
    return MaterialEngagement(materialId: id, likesCount: 0, isLiked: false);
  }

  @override
  Future<PublicSupplier?> fetchPublicSupplier(String supplierProfileId) async {
    return supplierProfileId == supplier.id ? supplier : null;
  }

  @override
  Future<MaterialDiscoveryResult> fetchSupplierMaterials(
    String supplierProfileId,
    MaterialDiscoveryQuery query,
  ) async {
    return MaterialDiscoveryResult(
      items: materials,
      pagination: MaterialDiscoveryPagination(
        page: 1,
        limit: materials.length,
        total: materials.length,
        totalPages: 1,
      ),
    );
  }

  @override
  Future<SupplierFollowStatus> followSupplier(String supplierProfileId) async {
    followCalls += 1;
    await followGate?.future;
    if (followShouldFail) {
      throw const ApiException(message: 'Follow failed', statusCode: 500);
    }

    supplier = supplier.copyWith(
      followersCount: supplier.followersCount + 1,
      isFollowedByViewer: true,
    );

    return SupplierFollowStatus(
      supplierProfileId: supplierProfileId,
      followersCount: supplier.followersCount,
      isFollowedByViewer: true,
    );
  }

  @override
  Future<SupplierFollowStatus> unfollowSupplier(
    String supplierProfileId,
  ) async {
    supplier = supplier.copyWith(
      followersCount: supplier.followersCount > 0
          ? supplier.followersCount - 1
          : 0,
      isFollowedByViewer: false,
    );

    return SupplierFollowStatus(
      supplierProfileId: supplierProfileId,
      followersCount: supplier.followersCount,
      isFollowedByViewer: false,
    );
  }
}

class _LearnerAuthController extends AuthController {
  @override
  AuthState build() {
    return AuthState(
      user: User(
        id: 'learner-1',
        displayName: 'Learner',
        email: 'learner@example.com',
        accountStatus: 'ACTIVE',
        roles: const ['LEARNER'],
        activeRole: 'LEARNER',
        createdAt: DateTime(2026),
      ),
      accessToken: 'token',
      hasBootstrapped: true,
    );
  }
}

Widget _supplierTestApp({
  required Widget child,
  required MaterialDiscoveryRepository repository,
  Locale locale = const Locale('en'),
}) {
  return ProviderScope(
    overrides: [
      materialDiscoveryRepositoryProvider.overrideWithValue(repository),
      authControllerProvider.overrideWith(_LearnerAuthController.new),
    ],
    child: MaterialApp(
      locale: locale,
      supportedLocales: const [Locale('en'), Locale('ar')],
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      home: child,
    ),
  );
}

Widget _supplierRouterTestApp({
  required MaterialDiscoveryRepository repository,
  required GoRouter router,
}) {
  return ProviderScope(
    overrides: [
      materialDiscoveryRepositoryProvider.overrideWithValue(repository),
      authControllerProvider.overrideWith(_LearnerAuthController.new),
    ],
    child: MaterialApp.router(
      routerConfig: router,
      supportedLocales: const [Locale('en'), Locale('ar')],
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
    ),
  );
}

void main() {
  test('parses public supplier response', () {
    final supplier = PublicSupplier.fromJson({
      'id': 'sp-1',
      'displayName': 'Workshop One',
      'supplierType': 'WORKSHOP',
      'description': 'Public workshop',
      'avatarUrl': '/uploads/profiles/avatar.jpg',
      'coverImageUrl': '/uploads/profiles/cover.jpg',
      'city': 'Nablus',
      'area': 'Industrial',
      'isVerified': true,
      'materialsCount': 4,
      'followersCount': 9,
      'isFollowedByViewer': true,
    });

    expect(supplier.id, 'sp-1');
    expect(supplier.displayName, 'Workshop One');
    expect(supplier.isVerified, isTrue);
    expect(supplier.materialsCount, 4);
    expect(supplier.followersCount, 9);
    expect(supplier.isFollowedByViewer, isTrue);
    expect(supplier.avatarUrl, endsWith('/uploads/profiles/avatar.jpg'));
    expect(supplier.coverImageUrl, endsWith('/uploads/profiles/cover.jpg'));
  });

  test('parses follow response', () {
    final status = SupplierFollowStatus.fromJson({
      'supplierProfileId': 'sp-1',
      'followersCount': 10,
      'isFollowedByViewer': true,
    });

    expect(status.supplierProfileId, 'sp-1');
    expect(status.followersCount, 10);
    expect(status.isFollowedByViewer, isTrue);
  });

  test('parses unfollow response', () {
    final status = SupplierFollowStatus.fromJson({
      'supplierProfileId': 'sp-1',
      'followersCount': 9,
      'isFollowedByViewer': false,
    });

    expect(status.followersCount, 9);
    expect(status.isFollowedByViewer, isFalse);
  });

  test('fetchPublicSupplier parses wrapped API response', () async {
    final dio = Dio();
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          handler.resolve(
            Response<Map<String, dynamic>>(
              requestOptions: options,
              data: {
                'success': true,
                'message': 'ok',
                'data': {
                  'id': 'sp-api',
                  'displayName': 'API Supplier',
                  'materialsCount': 2,
                  'followersCount': 1,
                  'isFollowedByViewer': false,
                },
              },
            ),
          );
        },
      ),
    );

    final repository = ApiMaterialDiscoveryRepository(dio);
    final supplier = await repository.fetchPublicSupplier('sp-api');

    expect(supplier?.id, 'sp-api');
    expect(supplier?.displayName, 'API Supplier');
  });

  testWidgets('route delivers authoritative supplier profile ID', (
    tester,
  ) async {
    const supplierProfileId = 'sp-route-1';

    await tester.binding.setSurfaceSize(const Size(1200, 1200));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      _supplierTestApp(
        repository: _FakeSupplierRepository(
          supplier: const PublicSupplier(
            id: supplierProfileId,
            displayName: 'Route Supplier',
          ),
        ),
        child: const PublicSupplierPage(supplierProfileId: supplierProfileId),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Route Supplier'), findsWidgets);
    expect(find.byKey(const ValueKey('public-supplier-tab-0')), findsOneWidget);
    expect(find.byKey(const ValueKey('public-supplier-tab-1')), findsOneWidget);
    expect(find.text('Edit Supplier Profile'), findsNothing);
  });

  testWidgets('shows initially unfollowed state and updates after follow', (
    tester,
  ) async {
    final repository = _FakeSupplierRepository(
      supplier: const PublicSupplier(
        id: 'sp-follow',
        displayName: 'Follow Supplier',
        followersCount: 2,
        isFollowedByViewer: false,
      ),
    );

    await tester.pumpWidget(
      _supplierTestApp(
        repository: repository,
        child: const PublicSupplierPage(supplierProfileId: 'sp-follow'),
      ),
    );

    await tester.pumpAndSettle();

    expect(find.text('Follow'), findsOneWidget);
    expect(find.text('Followers'), findsOneWidget);
    expect(find.text('2'), findsWidgets);

    await tester.tap(find.text('Follow'));
    await tester.pumpAndSettle();

    expect(find.text('Following'), findsOneWidget);
    expect(find.text('3'), findsWidgets);
  });

  testWidgets('shows initially followed state and updates after unfollow', (
    tester,
  ) async {
    final repository = _FakeSupplierRepository(
      supplier: const PublicSupplier(
        id: 'sp-unfollow',
        displayName: 'Unfollow Supplier',
        followersCount: 5,
        isFollowedByViewer: true,
      ),
    );

    await tester.pumpWidget(
      _supplierTestApp(
        repository: repository,
        child: const PublicSupplierPage(supplierProfileId: 'sp-unfollow'),
      ),
    );

    await tester.pumpAndSettle();

    expect(find.text('Following'), findsOneWidget);

    await tester.tap(find.text('Following'));
    await tester.pumpAndSettle();

    expect(find.text('Follow'), findsOneWidget);
    expect(find.text('4'), findsWidgets);
  });

  testWidgets('desktop follow states and success feedback are distinct', (
    tester,
  ) async {
    final repository = _FakeSupplierRepository(
      supplier: const PublicSupplier(
        id: 'sp-desktop-follow',
        displayName: 'Desktop Follow Supplier',
        followersCount: 2,
        isFollowedByViewer: false,
      ),
    );

    await tester.binding.setSurfaceSize(const Size(1280, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      _supplierTestApp(
        repository: repository,
        child: const PublicSupplierPage(supplierProfileId: 'sp-desktop-follow'),
      ),
    );
    await tester.pumpAndSettle();

    const buttonKey = ValueKey('public-supplier-desktop-follow-button');
    final buttonFinder = find.byKey(buttonKey);
    final palette = MaterialsUiPalette.of(tester.element(buttonFinder));
    final initialButton = tester.widget<FilledButton>(buttonFinder);
    final initialBackground = initialButton.style?.backgroundColor?.resolve({});
    expect(initialBackground, palette.mint);

    await tester.tap(buttonFinder);
    await tester.pumpAndSettle();

    final followingButton = tester.widget<FilledButton>(buttonFinder);
    final followingBackground = followingButton.style?.backgroundColor?.resolve(
      {},
    );
    final followingForeground = followingButton.style?.foregroundColor?.resolve(
      {},
    );
    expect(followingBackground, isNot(initialBackground));
    expect(followingForeground, palette.mint);
    expect(find.text('Following'), findsOneWidget);
    expect(find.text('3'), findsWidgets);
    expect(find.text('Supplier followed successfully'), findsOneWidget);

    final snackBar = tester.widget<SnackBar>(find.byType(SnackBar));
    final snackContext = tester.element(find.byType(SnackBar));
    expect(snackBar.width, 420);
    expect(
      snackBar.backgroundColor,
      Theme.of(snackContext).colorScheme.surface,
    );
    expect(snackBar.shape, isA<RoundedRectangleBorder>());
    expect(find.byIcon(Icons.check_circle_outline_rounded), findsOneWidget);
    final feedbackText = tester.widget<Text>(
      find.text('Supplier followed successfully'),
    );
    expect(
      feedbackText.style?.color,
      Theme.of(snackContext).colorScheme.onSurface,
    );

    await tester
        .widget<RefreshIndicator>(find.byType(RefreshIndicator))
        .onRefresh();
    await tester.pumpAndSettle();
    expect(find.text('Following'), findsOneWidget);
    expect(find.text('3'), findsWidgets);

    await tester.tap(buttonFinder);
    await tester.pumpAndSettle();

    final followButton = tester.widget<FilledButton>(buttonFinder);
    expect(followButton.style?.backgroundColor?.resolve({}), initialBackground);
    expect(find.text('Follow'), findsOneWidget);
    expect(find.text('2'), findsWidgets);
    expect(find.text('Supplier unfollowed'), findsOneWidget);
  });

  testWidgets('follow mutation disables repeated desktop clicks', (
    tester,
  ) async {
    final gate = Completer<void>();
    final repository = _FakeSupplierRepository(
      supplier: const PublicSupplier(
        id: 'sp-follow-gate',
        displayName: 'Protected Follow Supplier',
      ),
      followGate: gate,
    );

    await tester.binding.setSurfaceSize(const Size(1280, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      _supplierTestApp(
        repository: repository,
        child: const PublicSupplierPage(supplierProfileId: 'sp-follow-gate'),
      ),
    );
    await tester.pumpAndSettle();

    const buttonKey = ValueKey('public-supplier-desktop-follow-button');
    await tester.tap(find.byKey(buttonKey));
    await tester.pump();

    expect(repository.followCalls, 1);
    expect(
      tester.widget<FilledButton>(find.byKey(buttonKey)).onPressed,
      isNull,
    );

    gate.complete();
    await tester.pumpAndSettle();

    expect(repository.followCalls, 1);
    expect(find.text('Following'), findsOneWidget);
  });

  testWidgets('restores authoritative follow state after failed mutation', (
    tester,
  ) async {
    final repository = _FakeSupplierRepository(
      supplier: const PublicSupplier(
        id: 'sp-fail',
        displayName: 'Fail Supplier',
        followersCount: 1,
        isFollowedByViewer: false,
      ),
      followShouldFail: true,
    );

    await tester.pumpWidget(
      _supplierTestApp(
        repository: repository,
        child: const PublicSupplierPage(supplierProfileId: 'sp-fail'),
      ),
    );

    await tester.pumpAndSettle();

    await tester.tap(find.text('Follow'));
    await tester.pump();
    await tester.pumpAndSettle();

    expect(find.text('Follow'), findsOneWidget);
    expect(find.text('1'), findsWidgets);
    expect(repository.supplier.isFollowedByViewer, isFalse);
    expect(repository.supplier.followersCount, 1);
  });

  testWidgets('renders profile hero, description, and hides edit controls', (
    tester,
  ) async {
    final repository = _FakeSupplierRepository(
      supplier: const PublicSupplier(
        id: 'sp-hero',
        displayName: 'Majd Tech Reuse Workshop',
        supplierType: 'WORKSHOP',
        description: 'Public workshop description',
        city: 'Hebron',
        area: 'University District',
        isVerified: true,
        materialsCount: 4,
        followersCount: 2,
      ),
    );

    await tester.pumpWidget(
      _supplierTestApp(
        repository: repository,
        child: const PublicSupplierPage(supplierProfileId: 'sp-hero'),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Majd Tech Reuse Workshop'), findsWidgets);
    expect(find.text('Public workshop description'), findsWidgets);
    expect(find.text('Verified supplier'), findsOneWidget);
    expect(find.text('Edit Supplier Profile'), findsNothing);
    expect(find.byIcon(Icons.camera_alt), findsNothing);
    expect(find.text('M'), findsOneWidget);
  });

  testWidgets('public materials use multi-column grid at desktop width', (
    tester,
  ) async {
    final materials = List.generate(
      4,
      (index) => MaterialDiscoveryApiMapper.fromJson({
        'id': 'mat-$index',
        'title': 'Material $index',
        'description': 'Description $index',
        'status': 'AVAILABLE',
        'quantity': 1,
        'unit': 'piece',
        'condition': 'GOOD',
        'isFree': true,
        'deliveryAvailable': false,
        'category': {'nameEn': 'Electronics', 'nameAr': 'إلكترونيات'},
      }),
    );

    final repository = _FakeSupplierRepository(
      supplier: const PublicSupplier(
        id: 'sp-grid',
        displayName: 'Grid Supplier',
        materialsCount: 4,
      ),
      materials: materials,
    );

    await tester.binding.setSurfaceSize(const Size(1400, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      _supplierTestApp(
        repository: repository,
        child: const PublicSupplierPage(supplierProfileId: 'sp-grid'),
      ),
    );
    await tester.pumpAndSettle();

    final gridView = tester.widget<SliverGrid>(find.byType(SliverGrid));
    final delegate =
        gridView.gridDelegate as SliverGridDelegateWithFixedCrossAxisCount;
    expect(delegate.crossAxisCount, 4);
    expect(find.text('Material 0'), findsOneWidget);
    expect(find.text('Material 3'), findsOneWidget);
  });

  testWidgets('uses the dedicated desktop hero and tabs at wide widths', (
    tester,
  ) async {
    final repository = _FakeSupplierRepository(
      supplier: const PublicSupplier(
        id: 'sp-desktop',
        displayName: 'Desktop Supplier',
        description: 'A purpose-built desktop profile.',
        materialsCount: 12,
        followersCount: 7,
      ),
    );

    await tester.binding.setSurfaceSize(const Size(1280, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      _supplierTestApp(
        repository: repository,
        child: const PublicSupplierPage(supplierProfileId: 'sp-desktop'),
      ),
    );
    await tester.pumpAndSettle();

    expect(
      find.byKey(const ValueKey('public-supplier-desktop-hero')),
      findsOneWidget,
    );
    expect(
      find.byKey(const ValueKey('public-supplier-desktop-tabs')),
      findsOneWidget,
    );
    expect(find.byType(PublicSupplierProfileHeader), findsNothing);
    expect(
      find.byKey(const ValueKey('public-supplier-desktop-back')),
      findsOneWidget,
    );
  });

  testWidgets('desktop back pops history and falls back for direct entry', (
    tester,
  ) async {
    final repository = _FakeSupplierRepository(
      supplier: const PublicSupplier(
        id: 'sp-back',
        displayName: 'Back Supplier',
      ),
    );
    late GoRouter router;
    router = GoRouter(
      initialLocation: '/previous',
      routes: [
        GoRoute(
          path: '/previous',
          builder: (_, _) => const Scaffold(body: Text('Previous page')),
        ),
        GoRoute(
          path: '/materials',
          builder: (_, _) => const Scaffold(body: Text('Materials fallback')),
        ),
        GoRoute(
          path: '/suppliers/:supplierId',
          builder: (_, state) => PublicSupplierPage(
            supplierProfileId: state.pathParameters['supplierId']!,
            repository: repository,
          ),
        ),
      ],
    );
    addTearDown(router.dispose);

    await tester.binding.setSurfaceSize(const Size(1280, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(
      _supplierRouterTestApp(repository: repository, router: router),
    );
    await tester.pumpAndSettle();

    router.push('/suppliers/sp-back');
    await tester.pumpAndSettle();
    await tester.tap(
      find.byKey(const ValueKey('public-supplier-desktop-back')),
    );
    await tester.pumpAndSettle();
    expect(find.text('Previous page'), findsOneWidget);

    router.go('/suppliers/sp-back');
    await tester.pumpAndSettle();
    await tester.tap(
      find.byKey(const ValueKey('public-supplier-desktop-back')),
    );
    await tester.pumpAndSettle();
    expect(find.text('Materials fallback'), findsOneWidget);
  });

  testWidgets('preserves the approved mobile supplier composition', (
    tester,
  ) async {
    final repository = _FakeSupplierRepository(
      supplier: const PublicSupplier(
        id: 'sp-mobile',
        displayName: 'Mobile Supplier',
        materialsCount: 2,
        followersCount: 3,
      ),
    );

    await tester.binding.setSurfaceSize(const Size(430, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      _supplierTestApp(
        repository: repository,
        child: const PublicSupplierPage(supplierProfileId: 'sp-mobile'),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byType(PublicSupplierProfileHeader), findsOneWidget);
    expect(find.byType(PublicSupplierStatsBar), findsOneWidget);
    expect(
      find.byKey(const ValueKey('public-supplier-desktop-hero')),
      findsNothing,
    );
    expect(
      find.byKey(const ValueKey('public-supplier-desktop-tabs')),
      findsNothing,
    );
    expect(
      find.byKey(const ValueKey('public-supplier-desktop-back')),
      findsNothing,
    );
  });

  testWidgets('uses three material columns at medium desktop width', (
    tester,
  ) async {
    final materials = List.generate(
      3,
      (index) => MaterialDiscoveryApiMapper.fromJson({
        'id': 'medium-$index',
        'title': 'Medium material $index',
        'description': 'Description $index',
        'status': 'AVAILABLE',
        'quantity': 1,
        'unit': 'piece',
        'condition': 'GOOD',
        'isFree': true,
        'deliveryAvailable': false,
        'category': {'nameEn': 'Electronics', 'nameAr': 'إلكترونيات'},
      }),
    );
    final repository = _FakeSupplierRepository(
      supplier: const PublicSupplier(
        id: 'sp-medium',
        displayName: 'Medium Supplier',
        materialsCount: 3,
      ),
      materials: materials,
    );

    await tester.binding.setSurfaceSize(const Size(1000, 1000));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      _supplierTestApp(
        repository: repository,
        child: const PublicSupplierPage(supplierProfileId: 'sp-medium'),
      ),
    );
    await tester.pumpAndSettle();

    final grid = tester.widget<SliverGrid>(find.byType(SliverGrid));
    final delegate =
        grid.gridDelegate as SliverGridDelegateWithFixedCrossAxisCount;
    expect(delegate.crossAxisCount, 3);
  });

  testWidgets('desktop layout mirrors in Arabic', (tester) async {
    final repository = _FakeSupplierRepository(
      supplier: const PublicSupplier(
        id: 'sp-arabic',
        displayName: 'ورشة إعادة الاستخدام',
        supplierType: 'WORKSHOP',
        city: 'الخليل',
        materialsCount: 4,
      ),
    );

    await tester.binding.setSurfaceSize(const Size(1280, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      _supplierTestApp(
        repository: repository,
        locale: const Locale('ar'),
        child: const PublicSupplierPage(supplierProfileId: 'sp-arabic'),
      ),
    );
    await tester.pumpAndSettle();

    final hero = find.byKey(const ValueKey('public-supplier-desktop-hero'));
    expect(hero, findsOneWidget);
    expect(Directionality.of(tester.element(hero)), TextDirection.rtl);
    expect(find.text('رجوع'), findsOneWidget);
    expect(find.text('المواد المتاحة'), findsOneWidget);

    await tester.tap(
      find.byKey(const ValueKey('public-supplier-desktop-follow-button')),
    );
    await tester.pumpAndSettle();

    expect(find.text('متابَع'), findsOneWidget);
    expect(find.text('تمت المتابعة بنجاح'), findsOneWidget);
  });

  testWidgets('overview tab shows about content', (tester) async {
    final repository = _FakeSupplierRepository(
      supplier: const PublicSupplier(
        id: 'sp-overview',
        displayName: 'Overview Supplier',
        description: 'Overview copy',
      ),
    );

    await tester.binding.setSurfaceSize(const Size(1200, 1200));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      _supplierTestApp(
        repository: repository,
        child: const PublicSupplierPage(supplierProfileId: 'sp-overview'),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const ValueKey('public-supplier-tab-0')));
    await tester.pumpAndSettle();

    expect(find.text('About this supplier'), findsOneWidget);
    expect(find.text('Overview copy'), findsNWidgets(2));
  });
}
