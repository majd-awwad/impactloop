import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/core/errors/api_exception.dart';
import 'package:frontend/features/auth/application/auth_controller.dart';
import 'package:frontend/features/auth/data/models/user.dart';
import 'package:frontend/features/material_discovery/domain/discovery_material.dart';
import 'package:frontend/features/material_discovery/domain/material_discovery_query.dart';
import 'package:frontend/features/material_discovery/domain/material_discovery_repository.dart';
import 'package:frontend/features/material_discovery/domain/material_discovery_result.dart';
import 'package:frontend/features/material_discovery/domain/material_engagement.dart';
import 'package:frontend/features/material_discovery/presentation/widgets/material_supplier_profile_card.dart';
import 'package:frontend/l10n/app_localizations.dart';
import 'package:frontend/shared/models/localized_text.dart';
import 'package:frontend/shared/widgets/materials/material_condition_badge.dart';
import 'package:frontend/shared/widgets/materials/material_status_badge.dart';

class _TestAuthController extends AuthController {
  @override
  AuthState build() {
    return AuthState(
      user: User(
        id: 'learner-1',
        displayName: 'Learner',
        email: 'learner@example.test',
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

class _FollowRepository implements MaterialDiscoveryRepository {
  _FollowRepository({
    this.followShouldFail = false,
    this.followCompleter,
  });

  final bool followShouldFail;
  final Completer<SupplierFollowStatus>? followCompleter;
  int followCalls = 0;
  int unfollowCalls = 0;

  @override
  Future<SupplierFollowStatus> followSupplier(String supplierProfileId) async {
    followCalls += 1;
    if (followShouldFail) {
      throw const ApiException(message: 'Follow failed', statusCode: 500);
    }
    if (followCompleter != null) return followCompleter!.future;
    return SupplierFollowStatus(
      supplierProfileId: supplierProfileId,
      followersCount: 3,
      isFollowedByViewer: true,
    );
  }

  @override
  Future<SupplierFollowStatus> unfollowSupplier(
    String supplierProfileId,
  ) async {
    unfollowCalls += 1;
    return SupplierFollowStatus(
      supplierProfileId: supplierProfileId,
      followersCount: 1,
      isFollowedByViewer: false,
    );
  }

  @override
  Future<MaterialDiscoveryResult> fetchMaterials(
    MaterialDiscoveryQuery query,
  ) async => const MaterialDiscoveryResult(
    items: [],
    pagination: MaterialDiscoveryPagination(
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    ),
  );

  @override
  Future<DiscoveryMaterial?> getMaterialById(
    String id, {
    String? recommendationImpressionId,
  }) async => null;

  @override
  Future<MaterialEngagement> likeMaterial(
    String id, {
    String? recommendationImpressionId,
  }) async => MaterialEngagement(materialId: id, likesCount: 0, isLiked: true);

  @override
  Future<MaterialEngagement> unlikeMaterial(
    String id, {
    String? recommendationImpressionId,
  }) async => MaterialEngagement(materialId: id, likesCount: 0, isLiked: false);

  @override
  Future<PublicSupplier?> fetchPublicSupplier(String supplierProfileId) async =>
      null;

  @override
  Future<MaterialDiscoveryResult> fetchSupplierMaterials(
    String supplierProfileId,
    MaterialDiscoveryQuery query,
  ) => fetchMaterials(query);
}

DiscoveryMaterial _material({
  bool isFollowing = false,
  int followersCount = 2,
  String id = 'material-1',
  String supplierName = 'Majd Tech Reuse Workshop',
}) {
  return DiscoveryMaterial(
    id: id,
    title: const LocalizedText(en: 'Stepper motor', ar: 'محرك خطوي'),
    description: const LocalizedText(en: 'Motor', ar: 'محرك'),
    category: const LocalizedText(en: 'Electronics', ar: 'إلكترونيات'),
    conditionLabel: const LocalizedText(en: 'Good', ar: 'جيدة'),
    conditionTone: MaterialConditionBadgeTone.good,
    statusLabel: const LocalizedText(en: 'Available', ar: 'متاحة'),
    statusTone: MaterialStatusBadgeTone.available,
    quantityLabel: const LocalizedText(en: '1 piece', ar: 'قطعة واحدة'),
    priceLabel: const LocalizedText(en: 'Free', ar: 'مجانية'),
    locationLabel: const LocalizedText(en: 'Hebron', ar: 'الخليل'),
    availabilityLabel: const LocalizedText(en: 'Available', ar: 'متاحة'),
    deliveryAvailable: false,
    isFree: true,
    supplierName: LocalizedText(en: supplierName, ar: supplierName),
    supplierSubtitle: const LocalizedText(en: 'Workshop', ar: 'ورشة'),
    supplierType: 'WORKSHOP',
    supplierVerified: true,
    supplier: DiscoveryMaterialSupplierSummary(
      id: 'supplier-1',
      displayName: supplierName,
      city: 'Hebron',
      area: 'University District',
      followersCount: followersCount,
      isFollowedByViewer: isFollowing,
    ),
    heroIconData: Icons.memory_rounded,
    cardGradient: const [0xFF0B6B4A, 0xFFBDEBD7],
  );
}

Widget _testApp({
  required DiscoveryMaterial material,
  required MaterialDiscoveryRepository repository,
  Locale locale = const Locale('en'),
}) {
  return ProviderScope(
    overrides: [authControllerProvider.overrideWith(_TestAuthController.new)],
    child: MaterialApp(
      locale: locale,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(
        body: SingleChildScrollView(
          child: Center(
            child: SizedBox(
              width: 420,
              child: MaterialSupplierProfileCard(
                material: material,
                repository: repository,
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

String _followersCount(WidgetTester tester) {
  return tester
      .widget<Text>(find.byKey(const ValueKey('supplier-followers-count')))
      .data!;
}

void main() {
  testWidgets('not-following state renders Follow', (tester) async {
    await tester.pumpWidget(
      _testApp(material: _material(), repository: _FollowRepository()),
    );

    expect(find.text('Follow'), findsOneWidget);
    expect(find.text('Following'), findsNothing);
    expect(find.byIcon(Icons.person_add_outlined), findsOneWidget);
  });

  testWidgets('following state renders Following with check', (tester) async {
    await tester.pumpWidget(
      _testApp(
        material: _material(isFollowing: true),
        repository: _FollowRepository(),
      ),
    );

    expect(find.text('Following'), findsOneWidget);
    expect(find.byIcon(Icons.check_rounded), findsOneWidget);
  });

  testWidgets('Follow updates state and count immediately', (tester) async {
    final completer = Completer<SupplierFollowStatus>();
    final repository = _FollowRepository(followCompleter: completer);
    await tester.pumpWidget(
      _testApp(material: _material(), repository: repository),
    );

    await tester.tap(find.byKey(const ValueKey('supplier-follow-button')));
    await tester.pump();

    expect(find.text('Following'), findsOneWidget);
    expect(_followersCount(tester), '3');
    expect(find.byType(CircularProgressIndicator), findsOneWidget);

    completer.complete(
      const SupplierFollowStatus(
        supplierProfileId: 'supplier-1',
        followersCount: 3,
        isFollowedByViewer: true,
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Supplier followed successfully'), findsOneWidget);
  });

  testWidgets('Following performs unfollow and decreases count', (
    tester,
  ) async {
    final repository = _FollowRepository();
    await tester.pumpWidget(
      _testApp(material: _material(isFollowing: true), repository: repository),
    );

    await tester.tap(find.byKey(const ValueKey('supplier-follow-button')));
    await tester.pumpAndSettle();

    expect(repository.unfollowCalls, 1);
    expect(find.text('Follow'), findsOneWidget);
    expect(_followersCount(tester), '1');
    expect(find.text('Supplier unfollowed'), findsOneWidget);
  });

  testWidgets('failed mutation restores state and count', (tester) async {
    final repository = _FollowRepository(followShouldFail: true);
    await tester.pumpWidget(
      _testApp(material: _material(), repository: repository),
    );

    await tester.tap(find.byKey(const ValueKey('supplier-follow-button')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.text('Follow'), findsOneWidget);
    expect(_followersCount(tester), '2');
    expect(find.byType(SnackBar), findsOneWidget);
  });

  testWidgets('rapid double click sends one follow mutation', (tester) async {
    final completer = Completer<SupplierFollowStatus>();
    final repository = _FollowRepository(followCompleter: completer);
    await tester.pumpWidget(
      _testApp(material: _material(), repository: repository),
    );

    final button = find.byKey(const ValueKey('supplier-follow-button'));
    await tester.tap(button);
    await tester.tap(button);
    await tester.pump();

    expect(repository.followCalls, 1);
    completer.complete(
      const SupplierFollowStatus(
        supplierProfileId: 'supplier-1',
        followersCount: 3,
        isFollowedByViewer: true,
      ),
    );
    await tester.pumpAndSettle();
  });

  testWidgets('existing follower count loads correctly', (tester) async {
    await tester.pumpWidget(
      _testApp(
        material: _material(followersCount: 48),
        repository: _FollowRepository(),
      ),
    );

    expect(_followersCount(tester), '48');
    expect(find.text('Followers'), findsOneWidget);
  });

  testWidgets('Arabic renders localized labels in RTL', (tester) async {
    await tester.pumpWidget(
      _testApp(
        material: _material(),
        repository: _FollowRepository(),
        locale: const Locale('ar'),
      ),
    );

    final card = find.byKey(const ValueKey('material-supplier-profile-card'));
    expect(find.text('متابعة'), findsOneWidget);
    expect(find.text('المتابعون'), findsOneWidget);
    expect(find.text('موثّق'), findsOneWidget);
    expect(Directionality.of(tester.element(card)), TextDirection.rtl);
  });

  testWidgets('English renders localized labels in LTR', (tester) async {
    await tester.pumpWidget(
      _testApp(material: _material(), repository: _FollowRepository()),
    );

    final card = find.byKey(const ValueKey('material-supplier-profile-card'));
    expect(find.text('View profile'), findsOneWidget);
    expect(find.text('Verified'), findsOneWidget);
    expect(Directionality.of(tester.element(card)), TextDirection.ltr);
  });

  testWidgets('shared state survives card navigation recreation', (
    tester,
  ) async {
    final repository = _FollowRepository();
    final showRecreatedCard = ValueNotifier(false);
    addTearDown(showRecreatedCard.dispose);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(_TestAuthController.new),
        ],
        child: MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: Scaffold(
            body: ValueListenableBuilder<bool>(
              valueListenable: showRecreatedCard,
              builder: (context, recreated, _) => MaterialSupplierProfileCard(
                key: ValueKey(recreated),
                material: _material(
                  id: recreated ? 'material-2' : 'material-1',
                  isFollowing: false,
                  followersCount: 2,
                ),
                repository: repository,
              ),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.byKey(const ValueKey('supplier-follow-button')));
    await tester.pumpAndSettle();
    showRecreatedCard.value = true;
    await tester.pumpAndSettle();

    expect(find.text('Following'), findsOneWidget);
    expect(_followersCount(tester), '3');
  });

  testWidgets('long supplier identity fits a narrow card', (tester) async {
    await tester.pumpWidget(
      _testApp(
        material: _material(
          supplierName:
              'Majd Technology Reuse and Community Electronics Workshop',
        ),
        repository: _FollowRepository(),
      ),
    );
    await tester.binding.setSurfaceSize(const Size(300, 700));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pump();

    expect(tester.takeException(), isNull);
    expect(
      find.byKey(const ValueKey('supplier-follow-button')),
      findsOneWidget,
    );
  });
}
