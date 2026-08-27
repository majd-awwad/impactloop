import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/app/app.dart';
import 'package:frontend/app/application/app_settings_notifier.dart';
import 'package:frontend/app/router/app_router.dart';
import 'package:frontend/app/theme/app_theme.dart';
import 'package:frontend/app/widgets/hero_workshop_visual.dart';
import 'package:frontend/features/comments/application/comments_providers.dart';
import 'package:frontend/features/comments/domain/comment_models.dart';
import 'package:frontend/features/landing/application/landing_public_providers.dart';
import 'package:frontend/features/landing/data/landing_public_api.dart';
import 'package:frontend/features/landing/domain/landing_public_content.dart';
import 'package:frontend/features/landing/presentation/pages/landing_page.dart';
import 'package:frontend/features/landing/presentation/widgets/landing_stat_format.dart';
import 'package:frontend/features/learning_hub/application/learning_hub_providers.dart';
import 'package:frontend/features/learning_hub/domain/learning_project_repository.dart';
import 'package:frontend/features/learning_hub/domain/models/learning_project.dart';
import 'package:frontend/features/locations/application/saved_locations_providers.dart';
import 'package:frontend/features/material_discovery/application/material_discovery_providers.dart';
import 'package:frontend/features/material_discovery/application/material_related_projects_providers.dart';
import 'package:frontend/features/material_discovery/data/mock_material_discovery_repository.dart';
import 'package:frontend/features/material_discovery/data/mock_materials.dart';
import 'package:frontend/features/materials/application/material_listing_providers.dart';
import 'package:frontend/l10n/app_localizations.dart';
import 'package:frontend/shared/widgets/user_avatar.dart';

import 'support/learning_hub_test_support.dart';

const _landingProject = LearningProject(
  id: 'landing-project-1',
  category: LocalizedText(en: 'Woodworking', ar: 'نجارة'),
  title: LocalizedText(en: 'Mini Wooden Phone Stand', ar: 'حامل هاتف خشبي'),
  summary: LocalizedText(
    en: 'A compact stand from reclaimed offcuts.',
    ar: 'حامل صغير من قصاصات معاد استخدامها.',
  ),
  difficulty: LocalizedText(en: 'Beginner', ar: 'مبتدئ'),
  duration: LocalizedText(en: '2h', ar: '٢ س'),
  ratingLabel: LocalizedText(en: 'learners', ar: 'متعلمون'),
  ratingValue: 0,
  ratingCount: 0,
  componentCountLabel: LocalizedText(en: '', ar: ''),
  components: [],
  steps: [],
  links: [],
  imageUrl: null,
  heroIconData: Icons.architecture_outlined,
  cardGradient: [0xFF2E4738, 0xFF17211B],
  isFeatured: false,
);

LandingPublicContent _populatedContent() {
  return LandingPublicContent(
    stats: const LandingPublicStats(
      availableMaterialsCount: 12,
      publishedProjectsCount: 7,
      reusedMaterialsCount: 4,
    ),
    materials: [mockMaterials.first],
    projects: const [_landingProject],
    communityMembers: const [
      LandingCommunityMember(
        displayName: 'Majd',
        avatarUrl:
            '/demo-assets/visual-assets/people/profiles/profile-majd-core.png',
      ),
      LandingCommunityMember(
        displayName: 'Israa',
        avatarUrl:
            '/demo-assets/visual-assets/people/profiles/israa-core-profile.png',
      ),
    ],
  );
}

List<Override> _baseOverrides({
  LandingPublicRepository? landing,
  LearningProjectRepository? learningHub,
}) {
  return [
    initialAppSettingsProvider.overrideWithValue(
      const AppSettings(themeMode: ThemeMode.system, languageCode: 'en'),
    ),
    landingPublicRepositoryProvider.overrideWithValue(
      landing ?? FakeLandingPublicRepository(content: _populatedContent()),
    ),
    learningHubRepositoryProvider.overrideWithValue(
      learningHub ?? ProjectLookupLearningHubRepository(_landingProject),
    ),
    materialDiscoveryRepositoryProvider.overrideWithValue(
      const MockMaterialDiscoveryRepository(),
    ),
    discoveryMaterialCategoriesProvider.overrideWith((ref) => Future.value([])),
    savedLocationsProvider.overrideWith((ref) => Future.value([])),
    materialRelatedProjectsInitialProvider.overrideWith(
      (ref, materialId) async => MaterialRelatedProjectsPage(
        materialId: materialId,
        items: const [],
        pagination: const MaterialRelatedProjectsPagination(
          page: 1,
          limit: 4,
          total: 0,
          totalPages: 0,
        ),
      ),
    ),
    rootCommentsProvider.overrideWith(
      (ref, key) async => const CommentsPage(
        items: [],
        pagination: CommentsPagination(
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
        ),
      ),
    ),
  ];
}

void main() {
  test('formatLandingCount never invents inflated suffixes', () {
    expect(formatLandingCount(null), '—');
    expect(formatLandingCount(0), '0');
    expect(formatLandingCount(12), '12');
    expect(formatLandingCount(12500), '12.5k');
  });

  test('public landing parser keeps AVAILABLE materials only', () {
    final content = ApiLandingPublicRepository.parseContent({
      'stats': {
        'availableMaterialsCount': 2,
        'publishedProjectsCount': 1,
        'reusedMaterialsCount': 3,
      },
      'materials': [
        {
          'id': 'available-1',
          'title': 'Available plywood',
          'description': 'Public listing',
          'status': 'AVAILABLE',
          'isFree': true,
          'city': 'Nablus',
          'category': {'nameEn': 'Wood', 'nameAr': 'خشب'},
          'condition': 'GOOD',
        },
        {
          'id': 'pending-1',
          'title': 'Pending reservation',
          'description': 'Should be hidden',
          'status': 'PENDING_RESERVATION',
          'isFree': true,
          'city': 'Nablus',
          'category': {'nameEn': 'Wood', 'nameAr': 'خشب'},
          'condition': 'GOOD',
        },
      ],
      'projects': [
        {
          'id': 'project-1',
          'title': 'Published shelf',
          'shortDescription': 'A public project',
          'difficulty': 'BEGINNER',
          'category': {'nameEn': 'Woodworking', 'nameAr': 'نجارة'},
        },
      ],
      'communityMembers': [
        {
          'displayName': 'Majd',
          'avatarUrl':
              '/demo-assets/visual-assets/people/profiles/profile-majd-core.png',
        },
        {'displayName': '  ', 'avatarUrl': '/ignored.png'},
      ],
    });

    expect(content.materials, hasLength(1));
    expect(content.materials.single.id, 'available-1');
    expect(content.projects.single.title.en, 'Published shelf');
    expect(content.stats.reusedMaterialsCount, 3);
    expect(content.communityMembers, hasLength(1));
    expect(content.communityMembers.single.displayName, 'Majd');
  });

  testWidgets('guest can load landing without auth and see public records', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(overrides: _baseOverrides(), child: const ImpactLoopApp()),
    );
    await tester.pumpAndSettle();

    expect(find.text('Build a better future'), findsOneWidget);
    expect(find.text('Create account'), findsWidgets);
    expect(find.text('Reclaimed Birch Plywood Panels'), findsNothing);
    expect(find.text('Mini Wooden Phone Stand'), findsNothing);
    expect(find.text('Published learning projects'), findsNothing);
    expect(find.byType(UserAvatar), findsWidgets);
    expect(find.text('12'), findsWidgets);
    expect(find.text('12.5k+'), findsNothing);
    expect(find.text('420+'), findsNothing);
  });

  testWidgets('landing remains usable when public content is unavailable', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(1200, 1600));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      ProviderScope(
        overrides: _baseOverrides(
          landing: FakeLandingPublicRepository(
            error: Exception('landing unavailable'),
          ),
        ),
        child: const ImpactLoopApp(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Build a better future'), findsOneWidget);
    expect(find.text('This section could not be loaded.'), findsNothing);
    expect(tester.takeException(), isNull);

    await tester.pumpWidget(
      ProviderScope(
        overrides: _baseOverrides(landing: const FakeLandingPublicRepository()),
        child: const ImpactLoopApp(),
      ),
    );
    await tester.pumpAndSettle();

    expect(
      find.text('No public materials are available right now.'),
      findsNothing,
    );
    expect(
      find.text('No published learning projects are available right now.'),
      findsNothing,
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('loading state stays compact and does not invent cards', (
    tester,
  ) async {
    final completer = Completer<LandingPublicContent>();

    await tester.pumpWidget(
      ProviderScope(
        overrides: _baseOverrides(
          landing: _DelayedLandingRepository(completer),
        ),
        child: const ImpactLoopApp(),
      ),
    );
    await tester.pump();

    expect(find.text('Build a better future'), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsNothing);
    expect(find.text('Mini Wooden Phone Stand'), findsNothing);
    expect(find.byType(UserAvatar), findsNothing);

    completer.complete(_populatedContent());
    await tester.pumpAndSettle();

    expect(find.text('Mini Wooden Phone Stand'), findsNothing);
    expect(find.byType(UserAvatar), findsWidgets);
  });

  testWidgets('guest can open materials browse from landing', (tester) async {
    await tester.binding.setSurfaceSize(const Size(1200, 1800));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      ProviderScope(
        overrides: _baseOverrides(),
        child: const ImpactLoopApp(),
      ),
    );
    await tester.pumpAndSettle();

    final router = ProviderScope.containerOf(
      tester.element(find.byType(ImpactLoopApp)),
    ).read(appRouterProvider);

    await tester.ensureVisible(find.text('Explore materials'));
    await tester.tap(find.text('Explore materials').first);
    await tester.pumpAndSettle();

    expect(router.routeInformationProvider.value.uri.path, '/materials');
  });

  testWidgets('mobile hero keeps impact copy inside the clipped visual', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(402, 1400));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      ProviderScope(overrides: _baseOverrides(), child: const ImpactLoopApp()),
    );
    await tester.pumpAndSettle();

    final visual = find.byType(HeroWorkshopVisual);
    final impactHeading = find.text('Make an impact');

    expect(visual, findsOneWidget);
    expect(impactHeading, findsOneWidget);
    expect(
      tester.getTopLeft(impactHeading).dy,
      greaterThanOrEqualTo(tester.getTopLeft(visual).dy),
    );
    expect(
      tester.getBottomRight(impactHeading).dy,
      lessThanOrEqualTo(tester.getBottomRight(visual).dy),
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('protected material action prompts login for guests', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(1200, 1600));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      ProviderScope(overrides: _baseOverrides(), child: const ImpactLoopApp()),
    );
    await tester.pumpAndSettle();

    final router = ProviderScope.containerOf(
      tester.element(find.byType(ImpactLoopApp)),
    ).read(appRouterProvider);
    router.go('/materials/plywood-panels');
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

    final protectedAction = find.textContaining('Reserve');
    expect(protectedAction, findsWidgets);
    await tester.ensureVisible(protectedAction.first);
    await tester.tap(protectedAction.first);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

    expect(router.routeInformationProvider.value.uri.path, '/login');
    expect(
      router.routeInformationProvider.value.uri.queryParameters['from'],
      '/materials/plywood-panels',
    );
  });

  testWidgets('Arabic landing copy remains valid', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: _baseOverrides(),
        child: MaterialApp(
          locale: const Locale('ar'),
          theme: AppTheme.light,
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: AppLocalizations.supportedLocales,
          home: const LandingPage(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('ابنِ مستقبلًا أفضل'), findsOneWidget);
    expect(find.text('مواد متاحة'), findsWidgets);
    expect(find.text('مشاريع تعليمية منشورة'), findsNothing);
    expect(tester.takeException(), isNull);
  });
}

class _DelayedLandingRepository implements LandingPublicRepository {
  const _DelayedLandingRepository(this.completer);

  final Completer<LandingPublicContent> completer;

  @override
  Future<LandingPublicContent> fetchLanding() => completer.future;
}
