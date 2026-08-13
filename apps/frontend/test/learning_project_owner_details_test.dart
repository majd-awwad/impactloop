import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:frontend/features/auth/application/auth_controller.dart';
import 'package:frontend/features/auth/data/models/user.dart';
import 'package:frontend/features/comments/application/comments_providers.dart';
import 'package:frontend/features/comments/domain/comment_models.dart';
import 'package:frontend/features/learning_hub/application/learning_hub_providers.dart';
import 'package:frontend/features/learning_hub/domain/learning_project_repository.dart';
import 'package:frontend/features/learning_hub/domain/models/learning_project.dart';
import 'package:frontend/features/learning_hub/domain/models/project_build.dart';
import 'package:frontend/features/learning_hub/domain/models/project_material_coverage.dart';
import 'package:frontend/features/learning_hub/presentation/pages/learning_project_details_page.dart';
import 'package:frontend/l10n/app_localizations.dart';

const _projectId = 'project-owner-details';
const _ownerId = 'project-owner';

final _testDate = DateTime.fromMillisecondsSinceEpoch(0);

final _commentsPage = CommentsPage(
  items: [
    CommentItem(
      id: 'comment-1',
      learningProjectId: _projectId,
      body: 'Can you clarify step two?',
      status: 'VISIBLE',
      isDeleted: false,
      createdAt: _testDate,
      updatedAt: _testDate,
      author: const CommentAuthor(
        id: 'learner-commenter',
        displayName: 'Commenter',
      ),
      canEdit: false,
      canDelete: false,
      repliesCount: 0,
    ),
  ],
  pagination: const CommentsPagination(
    page: 1,
    limit: 20,
    total: 1,
    totalPages: 1,
  ),
);

LearningProject _project() => const LearningProject(
  id: _projectId,
  category: LocalizedText(en: 'Robotics', ar: 'الروبوتات'),
  title: LocalizedText(en: 'Owner project', ar: 'مشروع المالك'),
  summary: LocalizedText(
    en: 'Build a useful sensor station.',
    ar: 'ابنِ محطة استشعار مفيدة.',
  ),
  longDescription: LocalizedText(
    en: 'Learn how the sensors and controller work together.',
    ar: 'تعلم كيف تعمل المستشعرات ووحدة التحكم معًا.',
  ),
  difficulty: LocalizedText(en: 'Easy', ar: 'سهل'),
  duration: LocalizedText(en: '45 min', ar: '45 دقيقة'),
  ratingLabel: LocalizedText(en: 'learners', ar: 'متعلمون'),
  ratingValue: 4,
  ratingCount: 1,
  hasRatings: true,
  componentCountLabel: LocalizedText(en: '1 component', ar: 'مكوّن واحد'),
  components: [LocalizedText(en: 'Sensor', ar: 'مستشعر')],
  requiredComponents: [
    ProjectRequiredComponentItem(
      id: 'component-1',
      name: LocalizedText(en: 'Sensor', ar: 'مستشعر'),
      materialType: 'Electronics',
      quantity: 1,
      unit: 'piece',
      isRequired: true,
      canBeSubstituted: false,
      publicAvailabilityStatus: ComponentPublicAvailabilityStatus.available,
    ),
  ],
  steps: [
    ProjectStep(
      title: LocalizedText(en: 'Connect sensor', ar: 'صل المستشعر'),
    ),
  ],
  links: [
    ProjectLinkItem(
      label: LocalizedText(en: 'Sensor guide', ar: 'دليل المستشعر'),
      urlLabel: LocalizedText(en: 'Open guide', ar: 'افتح الدليل'),
      url: 'https://example.com/sensor-guide',
    ),
  ],
  imageUrl: null,
  heroIconData: Icons.memory_rounded,
  cardGradient: [0xFF1F2937, 0xFF243B53],
  isFeatured: false,
  likesCount: 0,
  followersCount: 0,
  recentReviews: [
    ProjectReviewItem(
      id: 'review-1',
      projectId: _projectId,
      reviewerName: 'Helpful Learner',
      rating: 4,
      comment: 'Clear instructions.',
      isViewerReview: false,
    ),
  ],
  materialCoverage: ProjectMaterialCoverageSummary(
    totalRequiredComponents: 1,
    availableComponents: 1,
    partialComponents: 0,
    missingComponents: 0,
    unknownComponents: 0,
    availabilityRatio: 1,
    coverageLevel: ProjectMaterialCoverageLevel.full,
  ),
  personalBuildReadiness: ProjectPersonalBuildReadiness(
    buildId: 'historical-owner-build',
    buildStatus: 'IN_PROGRESS',
    readyComponents: 1,
    totalRequiredComponents: 1,
    needsMaterialComponents: 0,
    readinessRatio: 1,
  ),
  creator: LearningProjectCreator(id: _ownerId, displayName: 'Project Owner'),
);

void main() {
  testWidgets(
    'owner sees public content, other reviews, and comments without learner controls',
    (tester) async {
      final repository = _DetailsRepository(_project());
      await _pumpDetails(tester, viewerId: _ownerId, repository: repository);

      expect(find.text('Manage project'), findsOneWidget);
      expect(
        find.ancestor(
          of: find.byKey(
            const ValueKey('learning-project-owner-manage-action'),
          ),
          matching: find.byKey(
            const ValueKey('learning-project-creator-panel'),
          ),
        ),
        findsOneWidget,
      );
      expect(find.text('View profile'), findsNothing);
      expect(find.text('Post review'), findsNothing);
      expect(find.text('Review this project'), findsNothing);
      expect(find.text('Start build'), findsNothing);
      expect(find.text('Browse materials'), findsNothing);
      expect(find.text('Your build readiness'), findsNothing);
      expect(find.text('0 likes'), findsNothing);
      expect(find.text('Save'), findsNothing);
      expect(find.text('0 followers'), findsNothing);
      expect(repository.fetchBuildCalls, 0);

      expect(find.text('Helpful Learner'), findsOneWidget);
      expect(find.text('Clear instructions.'), findsOneWidget);
      expect(find.text('Material availability'), findsOneWidget);
      expect(find.text('Required components'), findsOneWidget);
      expect(find.text('Connect sensor'), findsOneWidget);
      expect(find.text('Sensor guide'), findsOneWidget);
      expect(find.text('Comments'), findsOneWidget);
      expect(find.text('Can you clarify step two?'), findsOneWidget);
      expect(find.text('Reply'), findsOneWidget);
      expect(find.widgetWithText(FilledButton, 'Post'), findsOneWidget);
      expect(
        find.byKey(const ValueKey('learning-project-details-hero-back')),
        findsOneWidget,
      );
      expect(find.byKey(const ValueKey('app-back-page-level')), findsOneWidget);

      final availabilityY = tester
          .getTopLeft(find.text('Material availability'))
          .dy;
      final componentsY = tester
          .getTopLeft(find.text('Required components'))
          .dy;
      final stepsY = tester.getTopLeft(find.text('Implementation steps')).dy;
      final linksY = tester.getTopLeft(find.text('Helpful links')).dy;
      final reviewsY = tester.getTopLeft(find.text('Learner reviews')).dy;
      final commentsY = tester.getTopLeft(find.text('Comments')).dy;
      expect(availabilityY, lessThan(componentsY));
      expect(componentsY, lessThan(stepsY));
      expect(stepsY, lessThan(linksY));
      expect(linksY, lessThan(reviewsY));
      expect(reviewsY, lessThan(commentsY));
    },
  );

  testWidgets('non-owner learner still receives review and build controls', (
    tester,
  ) async {
    final repository = _DetailsRepository(_project());
    await _pumpDetails(
      tester,
      viewerId: 'other-learner',
      repository: repository,
    );

    expect(find.text('Manage project'), findsNothing);
    expect(find.text('View profile'), findsOneWidget);
    expect(find.text('Post review'), findsOneWidget);
    expect(find.text('Start build'), findsOneWidget);
    expect(find.text('Browse materials'), findsOneWidget);
    expect(find.text('Your build readiness'), findsOneWidget);
    expect(find.text('0 likes'), findsOneWidget);
    expect(find.text('Save'), findsOneWidget);
    expect(find.text('0 followers'), findsOneWidget);
    expect(repository.fetchBuildCalls, 1);

    expect(find.text('Helpful Learner'), findsOneWidget);
    expect(find.text('Comments'), findsOneWidget);
  });

  testWidgets('Arabic owner details keep localized chrome and owner gates', (
    tester,
  ) async {
    final repository = _DetailsRepository(_project());
    await _pumpDetails(
      tester,
      viewerId: _ownerId,
      repository: repository,
      locale: const Locale('ar'),
    );

    expect(find.text('إدارة المشروع'), findsOneWidget);
    expect(find.text('توفر المواد'), findsOneWidget);
    expect(find.text('المكونات المطلوبة'), findsOneWidget);
    expect(find.text('خطوات التنفيذ'), findsOneWidget);
    expect(find.text('روابط مفيدة'), findsOneWidget);
    expect(find.text('مراجعات المتعلمين'), findsOneWidget);
    expect(find.text('التعليقات'), findsOneWidget);
    expect(find.text('رد'), findsOneWidget);
    expect(find.widgetWithText(FilledButton, 'نشر'), findsOneWidget);

    expect(find.text('Post review'), findsNothing);
    expect(find.text('ابدأ البناء'), findsNothing);
    expect(find.text('تصفح المواد'), findsNothing);
    expect(find.text('Start build'), findsNothing);
    expect(repository.fetchBuildCalls, 0);
    expect(
      Directionality.of(
        tester.element(find.byType(LearningProjectDetailsPage)),
      ),
      TextDirection.rtl,
    );
  });

  testWidgets('mobile details expose the compact Back action', (tester) async {
    final repository = _DetailsRepository(_project());
    await _pumpDetails(
      tester,
      viewerId: _ownerId,
      repository: repository,
      surfaceSize: const Size(390, 844),
    );

    expect(find.byKey(const ValueKey('app-back-compact')), findsOneWidget);
    expect(find.byKey(const ValueKey('app-back-page-level')), findsNothing);
    expect(find.text('Manage project'), findsOneWidget);
    expect(find.text('Post review'), findsNothing);
    expect(find.text('Start build'), findsNothing);
  });
}

Future<void> _pumpDetails(
  WidgetTester tester, {
  required String viewerId,
  required _DetailsRepository repository,
  Locale locale = const Locale('en'),
  Size surfaceSize = const Size(1200, 1800),
}) async {
  await tester.binding.setSurfaceSize(surfaceSize);
  addTearDown(() => tester.binding.setSurfaceSize(null));

  final router = GoRouter(
    initialLocation: '/learning/$_projectId',
    routes: [
      GoRoute(
        path: '/learning/:id',
        builder: (_, state) =>
            LearningProjectDetailsPage(projectId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/learning/submissions/:id',
        builder: (_, _) => const Text('manage project destination'),
      ),
    ],
  );
  addTearDown(router.dispose);

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        authControllerProvider.overrideWith(
          () => _ViewerAuthController(viewerId),
        ),
        learningHubRepositoryProvider.overrideWithValue(repository),
        rootCommentsProvider((
          type: CommentTargetType.learningProject,
          targetId: _projectId,
        )).overrideWith((ref) async => _commentsPage),
      ],
      child: MaterialApp.router(
        locale: locale,
        routerConfig: router,
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context).copyWith(size: surfaceSize),
          child: child!,
        ),
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: AppLocalizations.supportedLocales,
      ),
    ),
  );

  await tester.pumpAndSettle();
}

class _ViewerAuthController extends AuthController {
  _ViewerAuthController(this.viewerId);

  final String viewerId;

  @override
  AuthState build() => AuthState(
    user: User(
      id: viewerId,
      displayName: 'Current Learner',
      email: '$viewerId@example.com',
      accountStatus: 'ACTIVE',
      roles: const ['LEARNER'],
      activeRole: 'LEARNER',
      createdAt: DateTime(2026),
    ),
    accessToken: 'test-token',
    hasBootstrapped: true,
  );
}

class _DetailsRepository implements LearningProjectRepository {
  _DetailsRepository(this.project);

  final LearningProject project;
  int fetchBuildCalls = 0;

  @override
  Future<LearningProject?> fetchProjectById(String id) async => project;

  @override
  Future<ProjectBuild?> fetchMyBuild(String projectId) async {
    fetchBuildCalls += 1;
    return null;
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}
