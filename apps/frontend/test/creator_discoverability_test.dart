import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:frontend/features/learning_hub/domain/learning_projects_result.dart';
import 'package:frontend/features/learning_hub/domain/models/learning_project.dart';
import 'package:frontend/features/learning_hub/presentation/widgets/learning_project_card.dart';
import 'package:frontend/features/learning_hub/presentation/widgets/project_creator_identity.dart';
import 'package:frontend/features/project_help_sessions/application/project_help_sessions_providers.dart';
import 'package:frontend/features/project_help_sessions/data/models/project_help_session_models.dart';
import 'package:frontend/features/project_help_sessions/presentation/widgets/help_session_project_picker.dart';
import 'package:frontend/features/public_user_profiles/application/public_user_profile_providers.dart';
import 'package:frontend/features/public_user_profiles/data/public_user_profile_models.dart';
import 'package:frontend/features/public_user_profiles/presentation/public_user_profile_page.dart';
import 'package:frontend/l10n/app_localizations.dart';
import 'package:frontend/shared/widgets/entity_attribution_footer.dart';

const _creator = LearningProjectCreator(
  id: 'creator-1',
  displayName: 'Majd Awad',
);

LearningProject _project({String id = 'project-1'}) => LearningProject(
  id: id,
  category: const LocalizedText(en: 'Robotics', ar: 'روبوتات'),
  title: const LocalizedText(en: 'CNC Henna Project', ar: 'آلة نقش الحناء'),
  summary: const LocalizedText(en: 'A practical CNC build', ar: 'مشروع عملي'),
  difficulty: const LocalizedText(en: 'Medium', ar: 'متوسط'),
  duration: const LocalizedText(en: '9 hrs', ar: '9 ساعات'),
  ratingLabel: const LocalizedText(en: 'learners', ar: 'متعلم'),
  ratingValue: 0,
  ratingCount: 0,
  componentCountLabel: const LocalizedText(en: '', ar: ''),
  components: const [],
  steps: const [],
  links: const [],
  imageUrl: null,
  heroIconData: Icons.school_outlined,
  cardGradient: const [0xFFE7F4ED, 0xFFDCEEE5],
  isFeatured: false,
  creator: _creator,
);

List<LocalizationsDelegate<dynamic>> get _delegates => const [
  AppLocalizations.delegate,
  GlobalMaterialLocalizations.delegate,
  GlobalWidgetsLocalizations.delegate,
  GlobalCupertinoLocalizations.delegate,
];

void main() {
  test('Learning creator search is sent through the existing q parameter', () {
    final params = const LearningProjectsQuery(
      page: 1,
      limit: 12,
      q: 'Majd Awad',
    ).toApiQueryParameters();

    expect(params['q'], 'Majd Awad');
  });

  testWidgets(
    'Learning card creator footer navigates separately from project',
    (tester) async {
      await tester.binding.setSurfaceSize(const Size(430, 720));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      final router = GoRouter(
        initialLocation: '/card',
        routes: [
          GoRoute(
            path: '/card',
            builder: (_, _) => Scaffold(
              body: SizedBox(
                width: 398,
                child: LearningProjectCard(project: _project()),
              ),
            ),
          ),
          GoRoute(
            path: '/learning/:id',
            builder: (_, _) => const Text('PROJECT'),
          ),
          GoRoute(path: '/users/:id', builder: (_, _) => const Text('CREATOR')),
        ],
      );
      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp.router(
            routerConfig: router,
            localizationsDelegates: _delegates,
            supportedLocales: AppLocalizations.supportedLocales,
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Majd Awad'), findsOneWidget);
      expect(find.byType(EntityAttributionFooter), findsOneWidget);
      expect(find.byIcon(Icons.chevron_right_rounded), findsNothing);
      await tester.tap(find.text('Majd Awad'));
      await tester.pumpAndSettle();
      expect(find.text('CREATOR'), findsOneWidget);

      router.go('/card');
      await tester.pumpAndSettle();
      await tester.tap(find.text('CNC Henna Project'));
      await tester.pumpAndSettle();
      expect(find.text('PROJECT'), findsOneWidget);
    },
  );

  testWidgets('Learning detail creator row opens the public user profile', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(360, 640));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final router = GoRouter(
      initialLocation: '/details',
      routes: [
        GoRoute(
          path: '/details',
          builder: (_, _) => const Scaffold(
            body: LearningProjectCreatorRow(creator: _creator),
          ),
        ),
        GoRoute(path: '/users/:id', builder: (_, _) => const Text('CREATOR')),
      ],
    );
    await tester.pumpWidget(
      MaterialApp.router(
        routerConfig: router,
        localizationsDelegates: _delegates,
        supportedLocales: AppLocalizations.supportedLocales,
      ),
    );
    await tester.pumpAndSettle();
    expect(
      find.byKey(const ValueKey('learning-project-creator-panel')),
      findsOneWidget,
    );
    expect(find.text('Project creator'), findsOneWidget);
    expect(find.text('View profile'), findsOneWidget);
    await tester.tap(find.text('View profile'));
    await tester.pumpAndSettle();
    expect(find.text('CREATOR'), findsOneWidget);
  });

  testWidgets(
    'public learner profile renders projects and no supplier section',
    (tester) async {
      final bundle = (
        profile: const PublicUserProfile(
          id: 'creator-1',
          displayName: 'Majd Awad',
          publicRoles: ['LEARNER'],
          publishedProjectsCount: 1,
        ),
        projects: LearningProjectsResult(
          items: [_project()],
          page: 1,
          limit: 12,
          total: 1,
          totalPages: 1,
        ),
      );
      await _pumpPublicProfile(tester, bundle);
      expect(
        find.byKey(const ValueKey('public-user-profile-hero')),
        findsOneWidget,
      );
      expect(find.text('1'), findsOneWidget);
      expect(find.text('Published projects'), findsWidgets);
      expect(find.text('CNC Henna Project'), findsOneWidget);
      expect(find.byType(EntityAttributionFooter), findsNothing);
      expect(find.text('Supplier activity'), findsNothing);
    },
  );

  testWidgets('Arabic multi-role profile links supplier identity separately', (
    tester,
  ) async {
    final bundle = (
      profile: const PublicUserProfile(
        id: 'creator-1',
        displayName: 'إسراء حداد',
        publicRoles: ['LEARNER', 'SUPPLIER'],
        publishedProjectsCount: 0,
        supplier: PublicUserSupplierSummary(
          id: 'supplier-1',
          displayName: 'ورشة الأمل',
          isVerified: true,
          availableMaterialsCount: 6,
        ),
      ),
      projects: const LearningProjectsResult(
        items: [],
        page: 1,
        limit: 12,
        total: 0,
        totalPages: 0,
      ),
    );
    await _pumpPublicProfile(
      tester,
      bundle,
      locale: const Locale('ar'),
      size: const Size(320, 1200),
    );
    expect(find.text('إسراء حداد'), findsOneWidget);
    expect(find.text('ورشة الأمل'), findsOneWidget);
    expect(find.text('6'), findsOneWidget);
    expect(find.text('المواد المتاحة'), findsOneWidget);
    expect(find.text('موثّق'), findsOneWidget);
    expect(
      find.byKey(const ValueKey('public-user-supplier-activity')),
      findsOneWidget,
    );
    expect(find.text('عرض ملف المورد'), findsOneWidget);
    expect(find.text('لا توجد مشاريع منشورة بعد'), findsOneWidget);
    expect(
      Directionality.of(tester.element(find.byType(PublicUserProfilePage))),
      TextDirection.rtl,
    );
    await tester.tap(find.text('عرض ملف المورد'));
    await tester.pumpAndSettle();
    expect(find.text('SUPPLIER PROFILE'), findsOneWidget);
  });

  testWidgets(
    'PHS picker shows creator, searches by creator, and selects build',
    (tester) async {
      const option = ProjectHelpSessionProjectOption(
        buildId: 'build-1',
        projectId: 'project-1',
        title: 'CNC Henna Project',
        creator: ProjectHelpSessionProjectOptionCreator(
          id: 'creator-1',
          displayName: 'Majd Awad',
        ),
      );
      const result = ProjectHelpSessionProjectOptionsResult(
        items: [option],
        page: 1,
        total: 1,
        totalPages: 1,
      );
      String? selected;
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            projectHelpSessionProjectOptionsProvider(
              null,
            ).overrideWith((ref) async => result),
            projectHelpSessionProjectOptionsProvider(
              'Majd',
            ).overrideWith((ref) async => result),
          ],
          child: MaterialApp(
            localizationsDelegates: _delegates,
            supportedLocales: AppLocalizations.supportedLocales,
            home: Builder(
              builder: (context) => Scaffold(
                body: FilledButton(
                  onPressed: () async {
                    selected = (await showHelpSessionProjectPicker(
                      context,
                    ))?.buildId;
                  },
                  child: const Text('OPEN'),
                ),
              ),
            ),
          ),
        ),
      );
      await tester.tap(find.text('OPEN'));
      await tester.pumpAndSettle();
      expect(find.text('CNC Henna Project'), findsOneWidget);
      expect(find.text('By Majd Awad'), findsOneWidget);
      await tester.enterText(find.byType(TextField), 'Majd');
      await tester.pump(const Duration(milliseconds: 350));
      await tester.pumpAndSettle();
      await tester.tap(find.text('CNC Henna Project'));
      await tester.pumpAndSettle();
      expect(selected, 'build-1');
    },
  );
}

Future<void> _pumpPublicProfile(
  WidgetTester tester,
  PublicUserProfileBundle bundle, {
  Locale locale = const Locale('en'),
  Size size = const Size(1100, 1200),
}) async {
  await tester.binding.setSurfaceSize(size);
  addTearDown(() => tester.binding.setSurfaceSize(null));
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        publicUserProfileProvider(
          'creator-1',
        ).overrideWith((ref) async => bundle),
      ],
      child: MaterialApp.router(
        locale: locale,
        localizationsDelegates: _delegates,
        supportedLocales: AppLocalizations.supportedLocales,
        routerConfig: GoRouter(
          initialLocation: '/users/creator-1',
          routes: [
            GoRoute(
              path: '/users/:id',
              builder: (_, _) =>
                  const PublicUserProfilePage(userId: 'creator-1'),
            ),
            GoRoute(
              path: '/suppliers/:id',
              builder: (_, _) => const Scaffold(body: Text('SUPPLIER PROFILE')),
            ),
            GoRoute(
              path: '/learning/:id',
              builder: (_, _) => const Scaffold(body: Text('PROJECT')),
            ),
          ],
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}
