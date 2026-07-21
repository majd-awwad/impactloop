import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:frontend/core/errors/api_exception.dart';
import 'package:frontend/features/ai/application/ai_chat_controller.dart';
import 'package:frontend/features/ai/data/ai_repository.dart';
import 'package:frontend/features/ai/domain/ai_models.dart';
import 'package:frontend/features/ai/domain/authoring_session_models.dart';
import 'package:frontend/features/ai/presentation/l10n/ai_l10n.dart';
import 'package:frontend/features/auth/application/auth_controller.dart';
import 'package:frontend/features/auth/data/models/user.dart';
import 'package:frontend/features/learning_hub/application/learning_hub_providers.dart';
import 'package:frontend/features/learning_hub/domain/learning_project_repository.dart';
import 'package:frontend/features/learning_hub/domain/learning_projects_result.dart';
import 'package:frontend/features/learning_hub/domain/models/learning_project.dart';
import 'package:frontend/features/learning_hub/domain/models/learning_project_submission.dart';
import 'package:frontend/features/learning_hub/presentation/pages/learning_project_authoring_pages.dart';
import 'package:frontend/features/learning_hub/presentation/pages/learning_project_submissions_page.dart';
import 'package:frontend/shared/utils/content_text_direction.dart';
import 'package:frontend/features/materials/data/models/category.dart';
import 'package:frontend/shared/models/localized_text.dart';
import 'package:frontend/shared/widgets/app_primary_button.dart';

class _AuthoringTestRepository implements LearningProjectRepository {
  _AuthoringTestRepository({
    required this.categories,
    this.draftSubmission,
    this.createHandler,
    this.reopenHandler,
  });

  final List<MaterialCategory> categories;
  LearningProjectSubmission? draftSubmission;
  int createCalls = 0;
  int reopenCalls = 0;
  String? lastIdempotencyKey;
  String? lastIdeaText;
  String? lastCategoryId;
  String? lastDifficulty;
  String? lastLocale;
  String? lastReopenProjectId;

  Future<LearningProjectAuthoringSession> Function({
    required String ideaText,
    required String categoryId,
    required String difficulty,
    required String idempotencyKey,
    String? locale,
  })?
  createHandler;

  Future<LearningProjectAuthoringSession> Function({
    required String projectId,
    String? locale,
  })?
  reopenHandler;

  @override
  Future<LearningProjectAuthoringSession> createAiAuthoringDraft({
    required String ideaText,
    required String categoryId,
    required String difficulty,
    required String idempotencyKey,
    String? locale,
  }) async {
    createCalls += 1;
    lastIdempotencyKey = idempotencyKey;
    lastIdeaText = ideaText;
    lastCategoryId = categoryId;
    lastDifficulty = difficulty;
    lastLocale = locale;
    if (createHandler != null) {
      return createHandler!(
        ideaText: ideaText,
        categoryId: categoryId,
        difficulty: difficulty,
        idempotencyKey: idempotencyKey,
        locale: locale,
      );
    }
    return LearningProjectAuthoringSession(
      learningProjectId: 'project-1',
      conversationId: 'conversation-1',
      status: 'DRAFT',
      mode: 'PROJECT_AUTHORING',
      title: 'Smart watering project',
      updatedAt: DateTime.utc(2026, 7, 17),
    );
  }

  @override
  Future<LearningProjectAuthoringSession> getOrCreateAuthoringConversation({
    required String projectId,
    String? locale,
  }) async {
    reopenCalls += 1;
    lastReopenProjectId = projectId;
    if (reopenHandler != null) {
      return reopenHandler!(projectId: projectId, locale: locale);
    }
    return LearningProjectAuthoringSession(
      learningProjectId: projectId,
      conversationId: 'conversation-1',
      status: 'DRAFT',
      mode: 'PROJECT_AUTHORING',
      title: 'Smart watering project',
      updatedAt: DateTime.utc(2026, 7, 17),
    );
  }

  @override
  Future<List<MaterialCategory>> fetchProjectCategories() async => categories;

  @override
  Future<List<MaterialCategory>> fetchMaterialCategories() async => const [];

  @override
  Future<LearningProjectSubmission> fetchMyLearningProjectSubmission(
    String id,
  ) async {
    final submission = draftSubmission;
    if (submission == null || submission.id != id) {
      throw const ApiException(message: 'Not found', code: 'NOT_FOUND');
    }
    return submission;
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _SubmissionsListTestRepository implements LearningProjectRepository {
  _SubmissionsListTestRepository(this.submissions);

  final List<LearningProjectSubmission> submissions;

  @override
  Future<LearningProjectSubmissionsResult> fetchMyLearningProjectSubmissions(
    LearningProjectSubmissionsQuery query,
  ) async {
    return LearningProjectSubmissionsResult(
      items: submissions,
      page: 1,
      limit: 12,
      total: submissions.length,
      totalPages: 1,
    );
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _RecordingAiRepository implements AiRepository {
  int listMessagesCalls = 0;
  int sendMessageCalls = 0;
  int startAuthoringCalls = 0;
  int startAuthoringSessionCalls = 0;
  int generateProposalCalls = 0;

  AuthoringSessionResponse _overviewSession(String conversationId) {
    return AuthoringSessionResponse(
      session: AuthoringPersistedSession(
        id: 'session-1',
        conversationId: conversationId,
        learningProjectId: 'project-1',
        stage: 'OVERVIEW',
        status: 'WAITING_FOR_USER',
        version: 1,
        completedStages: const [],
        baseProjectUpdatedAt: '2026-07-17T12:00:00.000Z',
      ),
      currentTurn: null,
      canonicalProject: const AiAuthoringCanonicalProject(
        id: 'project-1',
        updatedAt: '2026-07-17T12:00:00.000Z',
        title: 'Arduino Soil Alert',
        shortDescription: 'A beginner soil moisture alert project.',
        description: 'Build a simple Arduino project.',
        difficulty: 'BEGINNER',
        estimatedMinutes: 120,
      ),
      availableActions: const ['START'],
    );
  }

  @override
  Future<AuthoringSessionResponse> startAuthoringSession({
    required String conversationId,
  }) async {
    startAuthoringSessionCalls += 1;
    return _overviewSession(conversationId);
  }

  @override
  Future<AuthoringSessionResponse> loadAuthoringSession({
    required String sessionId,
  }) async {
    return _overviewSession('conv-authoring');
  }

  @override
  Future<AuthoringSessionResponse> sendAuthoringSessionMessage({
    required String sessionId,
    required int expectedVersion,
    String? text,
    String? clientMessageId,
    String? questionId,
    List<String>? selectedOptionIds,
    String? otherText,
    String? currentTurnId,
  }) async {
    return _overviewSession('conv-authoring');
  }

  @override
  Future<AuthoringSessionResponse> runAuthoringSessionAction({
    required String sessionId,
    required String action,
    required int expectedVersion,
    String? turnId,
    Object? manualValue,
    String? mode,
    String? targetStage,
  }) async {
    return _overviewSession('conv-authoring');
  }

  @override
  Future<AiConversationMessagesPage> listMessages({
    required String conversationId,
    int limit = 50,
    String? cursor,
  }) async {
    listMessagesCalls += 1;
    return AiConversationMessagesPage(
      conversation: AiConversationSummary(
        id: conversationId,
        mode: 'PROJECT_AUTHORING',
        locale: 'en',
        title: 'Authoring',
        preview: null,
        updatedAt: DateTime.utc(2026, 7, 17),
      ),
      items: [
        AiMessageItem(
          id: 'message-1',
          role: 'USER',
          status: 'COMPLETED',
          contentText: 'I want to build a smart watering project.',
          contentBlocks: const [],
          createdAt: DateTime.utc(2026, 7, 17),
        ),
      ],
    );
  }

  @override
  Future<AiTurnResponse> startAuthoring({required String conversationId}) async {
    startAuthoringCalls += 1;
    return AiTurnResponse(
      conversationId: conversationId,
      userMessageId: 'message-1',
      assistantMessageId: 'assistant-bootstrap',
      contentBlocks: const [
        AiContentBlock(
          type: 'project_authoring_clarification',
          authoringStatus: 'NEEDS_CLARIFICATION',
          authoringSummary: 'I understand your Arduino watering idea.',
          authoringKnownFacts: [
            AiAuthoringKnownFact(
              label: 'Project idea',
              value: 'Smart watering project',
            ),
          ],
          authoringNextQuestion: AiAuthoringQuestion(
            prompt: 'Should the pump run automatically?',
            answerType: 'SINGLE_CHOICE',
            options: ['Automatic pump', 'Alert only'],
          ),
        ),
      ],
      scopeClassification: 'DOMAIN_KNOWLEDGE',
    );
  }

  @override
  Future<AiTurnResponse> generateAuthoringProposal({
    required String conversationId,
  }) async {
    generateProposalCalls += 1;
    return AiTurnResponse(
      conversationId: conversationId,
      userMessageId: 'assistant-bootstrap',
      assistantMessageId: 'assistant-proposal',
      contentBlocks: const [
        AiContentBlock(
          type: 'project_authoring_proposal',
          authoringProposalId: 'proposal-1',
          authoringProposalProject: AiAuthoringProposalProject(
            title: 'Arduino Soil Alert',
            shortDescription: 'A beginner soil moisture alert project.',
            description:
                'Build a simple Arduino project that lights an LED when soil is dry.',
            difficulty: 'BEGINNER',
            estimatedMinutes: 120,
          ),
          authoringProposalCategoryDisplayName: 'Electronics',
          authoringProposalComponents: [
            AiAuthoringProposalComponent(
              componentName: 'Arduino Uno',
              materialType: 'Microcontroller',
              quantity: 1,
              unit: 'piece',
              componentRole: 'REQUIRED_MATERIAL',
              isRequired: true,
              canBeSubstituted: false,
            ),
          ],
          authoringProposalSteps: [
            AiAuthoringProposalStep(
              title: 'Prepare components',
              description: 'Gather the Arduino, sensor, and LED.',
            ),
            AiAuthoringProposalStep(
              title: 'Wire the circuit',
              description: 'Connect the sensor and LED to the Arduino.',
            ),
            AiAuthoringProposalStep(
              title: 'Test the alert',
              description: 'Verify the LED turns on when the soil is dry.',
            ),
          ],
        ),
      ],
      scopeClassification: 'DOMAIN_KNOWLEDGE',
    );
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _LearnerAuthController extends AuthController {
  @override
  AuthState build() {
    return AuthState(
      hasBootstrapped: true,
      accessToken: 'token',
      user: User(
        id: 'learner-1',
        displayName: 'Learner',
        email: 'learner@test.com',
        accountStatus: 'ACTIVE',
        roles: const ['LEARNER'],
        createdAt: DateTime.utc(2026, 1, 1),
      ),
    );
  }
}

Widget _wrap(
  Widget child, {
  required LearningProjectRepository repository,
  AiRepository? aiRepository,
  Locale locale = const Locale('en'),
  String initialLocation = learningProjectCreateRoute,
}) {
  final router = GoRouter(
    initialLocation: initialLocation,
    routes: [
      GoRoute(
        path: learningProjectCreateRoute,
        builder: (context, state) => const LearningProjectCreateChoicePage(),
      ),
      GoRoute(
        path: '/learning/add-draft',
        builder: (context, state) =>
            const Scaffold(body: Center(child: Text('Manual draft page'))),
      ),
      GoRoute(
        path: learningProjectAiStarterRoute,
        builder: (context, state) => const LearningProjectAiStarterPage(),
      ),
      GoRoute(
        path: '/learning/submissions/:id/author',
        builder: (context, state) => LearningProjectAuthoringWorkspacePage(
          projectId: state.pathParameters['id']!,
        ),
      ),
      GoRoute(
        path: '/learning/submissions/:id/author/assistant',
        builder: (context, state) => LearningProjectAuthoringAssistantPage(
          projectId: state.pathParameters['id']!,
        ),
      ),
    ],
  );

  return ProviderScope(
    overrides: [
      learningHubRepositoryProvider.overrideWithValue(repository),
      authControllerProvider.overrideWith(_LearnerAuthController.new),
      if (aiRepository != null)
        aiRepositoryProvider.overrideWithValue(aiRepository),
    ],
    child: MaterialApp.router(
      locale: locale,
      supportedLocales: const [Locale('en'), Locale('ar')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      routerConfig: router,
      builder: (context, child) => Directionality(
        textDirection: locale.languageCode == 'ar'
            ? TextDirection.rtl
            : TextDirection.ltr,
        child: child ?? const SizedBox.shrink(),
      ),
    ),
  );
}

LearningProjectSubmission _draftSubmission({
  String id = 'project-1',
  String title = 'Smart watering project',
  LearningProjectSubmissionStatus status = LearningProjectSubmissionStatus.draft,
}) {
  return LearningProjectSubmission(
    id: id,
    title: title,
    shortDescription: 'A low-cost smart watering project for learners.',
    description: 'I want to build a low-cost smart watering project.',
    status: status,
    category: const LocalizedText(en: 'Robotics', ar: 'روبوتات'),
    difficulty: 'BEGINNER',
    availableActions: LearningProjectSubmissionActions(
      canView: true,
      canEdit: status == LearningProjectSubmissionStatus.draft,
      canResubmit: false,
      canViewPublic: false,
    ),
    requiredComponents: const [],
    steps: const [],
    links: const [],
  );
}

void main() {
  setUp(() {
    final previousOnError = FlutterError.onError;
    FlutterError.onError = (details) {
      final message = details.exceptionAsString();
      if (message.contains('ListTile background color') ||
          message.contains('RenderFlex overflowed')) {
        return;
      }
      previousOnError?.call(details);
    };
  });

  testWidgets('creation choices show manual and AI actions', (tester) async {
    await tester.binding.setSurfaceSize(const Size(900, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final repository = _AuthoringTestRepository(categories: const []);

    await tester.pumpWidget(
      _wrap(const SizedBox.shrink(), repository: repository),
    );
    await tester.pumpAndSettle();

    expect(find.text('Create manually'), findsOneWidget);
    expect(find.text('Create with AI'), findsOneWidget);

    await tester.tap(find.text('Create manually'));
    await tester.pumpAndSettle();
    expect(find.text('Manual draft page'), findsOneWidget);
  });

  testWidgets('AI choice opens starter form', (tester) async {
    await tester.binding.setSurfaceSize(const Size(900, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final repository = _AuthoringTestRepository(
      categories: const [
        MaterialCategory(
          id: 'category-1',
          nameEn: 'Robotics',
          nameAr: 'روبوتات',
          categoryType: 'PROJECT',
        ),
      ],
    );

    await tester.pumpWidget(
      _wrap(const SizedBox.shrink(), repository: repository),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Create with AI'));
    await tester.pumpAndSettle();
    expect(find.text('Start with your project idea'), findsOneWidget);
  });

  testWidgets('starter form renders fields and validates idea length', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(900, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final repository = _AuthoringTestRepository(
      categories: const [
        MaterialCategory(
          id: 'category-1',
          nameEn: 'Robotics',
          nameAr: 'روبوتات',
          categoryType: 'PROJECT',
        ),
      ],
    );

    await tester.pumpWidget(
      _wrap(
        const SizedBox.shrink(),
        repository: repository,
        initialLocation: learningProjectAiStarterRoute,
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Project idea'), findsOneWidget);
    expect(find.text('Project category'), findsOneWidget);
    expect(find.text('Difficulty'), findsOneWidget);
    expect(find.text('Create draft'), findsOneWidget);

    await tester.tap(find.text('Create draft'));
    await tester.pumpAndSettle();
    expect(repository.createCalls, 0);

    await tester.enterText(find.byType(TextFormField).first, 'short');
    await tester.ensureVisible(find.text('Create draft'));
    await tester.tap(find.text('Create draft'));
    await tester.pumpAndSettle();
    expect(find.textContaining('at least 10'), findsOneWidget);
  });

  testWidgets('starter submission sends trimmed payload with idempotency key', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(900, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final repository = _AuthoringTestRepository(
      categories: const [
        MaterialCategory(
          id: 'category-1',
          nameEn: 'Robotics',
          nameAr: 'روبوتات',
          categoryType: 'PROJECT',
        ),
      ],
    );

    await tester.pumpWidget(
      _wrap(
        const SizedBox.shrink(),
        repository: repository,
        initialLocation: learningProjectAiStarterRoute,
      ),
    );
    await tester.pumpAndSettle();

    const idea = '  أريد بناء مشروع ري ذكي منخفض التكلفة.  ';
    await tester.enterText(find.byType(TextFormField).first, idea);
    await tester.tap(find.byType(DropdownButtonFormField<String>).at(0));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Robotics').last);
    await tester.pumpAndSettle();
    await tester.tap(find.byType(DropdownButtonFormField<String>).at(1));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Beginner').last);
    await tester.pumpAndSettle();

    final keyBefore = repository.lastIdempotencyKey;
    await tester.tap(find.text('Create draft'));
    await tester.pumpAndSettle();

    expect(repository.createCalls, 1);
    expect(repository.lastIdeaText, idea.trim());
    expect(repository.lastCategoryId, 'category-1');
    expect(repository.lastDifficulty, 'BEGINNER');
    expect(repository.lastLocale, 'en');
    expect(repository.lastIdempotencyKey, isNotNull);
    expect(repository.lastIdempotencyKey, isNot(equals(keyBefore)));
    expect(find.byType(LearningProjectAuthoringWorkspacePage), findsOneWidget);
  });

  testWidgets('double submit is blocked while request is in flight', (
    tester,
  ) async {
    tester.view.resetPhysicalSize();
    tester.view.physicalSize = const Size(900, 900);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    final repository = _AuthoringTestRepository(
      categories: const [
        MaterialCategory(
          id: 'category-1',
          nameEn: 'Robotics',
          nameAr: 'روبوتات',
          categoryType: 'PROJECT',
        ),
      ],
      createHandler: ({required ideaText, required categoryId, required difficulty, required idempotencyKey, locale}) async {
        await Future<void>.delayed(const Duration(milliseconds: 200));
        return LearningProjectAuthoringSession(
          learningProjectId: 'project-1',
          conversationId: 'conversation-1',
          status: 'DRAFT',
          mode: 'PROJECT_AUTHORING',
          title: 'Draft',
          updatedAt: DateTime.utc(2026, 7, 17),
        );
      },
    );

    await tester.pumpWidget(
      _wrap(
        const SizedBox.shrink(),
        repository: repository,
        initialLocation: learningProjectAiStarterRoute,
      ),
    );
    await tester.pumpAndSettle();

    await tester.enterText(
      find.byType(TextFormField).first,
      'Build a recycled-material weather station for schools.',
    );
    await tester.tap(find.byType(DropdownButtonFormField<String>).at(0));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Robotics').last);
    await tester.pumpAndSettle();
    await tester.tap(find.byType(DropdownButtonFormField<String>).at(1));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Beginner').last);
    await tester.pumpAndSettle();

    final keyBeforeSubmit = repository.lastIdempotencyKey;
    await tester.ensureVisible(find.text('Create draft'));
    await tester.tap(find.text('Create draft'));
    await tester.pump();
    expect(repository.createCalls, 1);
    expect(repository.lastIdempotencyKey, isNotNull);
    expect(repository.lastIdempotencyKey, isNot(equals(keyBeforeSubmit)));
    await tester.tap(find.byType(FilledButton));
    await tester.pump();
    expect(repository.createCalls, 1);
    await tester.pump(const Duration(milliseconds: 250));
    await tester.pumpAndSettle();
  });

  testWidgets('authoring workspace bootstraps clarification and enables composer', (
    tester,
  ) async {
    final repository = _AuthoringTestRepository(
      categories: const [],
      draftSubmission: _draftSubmission(),
    );
    final aiRepository = _RecordingAiRepository();

    tester.view.resetPhysicalSize();
    tester.view.physicalSize = const Size(1280, 900);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);

    await tester.pumpWidget(
      _wrap(
        const SizedBox.shrink(),
        repository: repository,
        aiRepository: aiRepository,
        initialLocation: learningProjectAuthoringRoute('project-1'),
      ),
    );
    await tester.pumpAndSettle();
    while (tester.takeException() != null) {}

    expect(repository.reopenCalls, 1);
    expect(repository.lastReopenProjectId, 'project-1');
    expect(aiRepository.listMessagesCalls, greaterThanOrEqualTo(1));
    expect(aiRepository.startAuthoringSessionCalls, 1);
    expect(aiRepository.sendMessageCalls, 0);
    expect(find.text('AI-assisted project draft'), findsOneWidget);
    expect(find.text('AI project assistant'), findsOneWidget);
    expect(find.text('Basic details'), findsOneWidget);
    expect(find.text(AiL10n.authoringSequentialStart.en), findsOneWidget);
    expect(find.byIcon(Icons.arrow_upward_rounded), findsOneWidget);
    expect(find.text('What I understand'), findsNothing);
    expect(find.text('Your project space is ready'), findsNothing);
  });

  testWidgets('full-screen assistant bootstraps clarification and enables composer', (
    tester,
  ) async {
    tester.view.resetPhysicalSize();
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);

    final repository = _AuthoringTestRepository(
      categories: const [],
      draftSubmission: _draftSubmission(),
    );
    final aiRepository = _RecordingAiRepository();

    await tester.pumpWidget(
      _wrap(
        const SizedBox.shrink(),
        repository: repository,
        aiRepository: aiRepository,
        initialLocation: learningProjectAuthoringAssistantRoute('project-1'),
      ),
    );
    await tester.pumpAndSettle();
    while (tester.takeException() != null) {}

    expect(repository.reopenCalls, 1);
    expect(aiRepository.listMessagesCalls, greaterThanOrEqualTo(1));
    expect(aiRepository.startAuthoringSessionCalls, 0);
    expect(aiRepository.sendMessageCalls, 0);
    expect(find.text('AI project assistant'), findsOneWidget);
    expect(find.byIcon(Icons.arrow_upward_rounded), findsOneWidget);
    expect(find.text(AiL10n.authoringSequentialStart.en), findsNothing);
    expect(find.text('Your project space is ready'), findsNothing);
    expect(find.byType(LearningProjectAuthoringAssistantPage), findsOneWidget);
  });

  testWidgets('desktop create project opens choice dialog', (tester) async {
    await tester.binding.setSurfaceSize(const Size(1100, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final repository = _AuthoringTestRepository(categories: const []);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          learningHubRepositoryProvider.overrideWithValue(repository),
          authControllerProvider.overrideWith(_LearnerAuthController.new),
        ],
        child: MaterialApp(
          home: Builder(
            builder: (context) => Scaffold(
              body: FilledButton(
                onPressed: () => showLearningProjectCreateChoice(context),
                child: const Text('Create project'),
              ),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Create project'));
    await tester.pumpAndSettle();

    expect(find.byType(Dialog), findsOneWidget);
    expect(find.text('Create with AI'), findsOneWidget);
  });

  testWidgets('narrow create project opens bottom sheet', (tester) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final repository = _AuthoringTestRepository(categories: const []);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          learningHubRepositoryProvider.overrideWithValue(repository),
          authControllerProvider.overrideWith(_LearnerAuthController.new),
        ],
        child: MaterialApp(
          home: Builder(
            builder: (context) => Scaffold(
              body: FilledButton(
                onPressed: () => showLearningProjectCreateChoice(context),
                child: const Text('Create project'),
              ),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Create project'));
    await tester.pumpAndSettle();
    while (tester.takeException() != null) {}

    expect(find.text('How would you like to start?'), findsOneWidget);
    expect(find.text('Create manually'), findsOneWidget);
  });

  testWidgets('medium workspace shows open assistant action without side panel', (
    tester,
  ) async {
    final repository = _AuthoringTestRepository(
      categories: const [],
      draftSubmission: _draftSubmission(),
    );
    final aiRepository = _RecordingAiRepository();

    tester.view.resetPhysicalSize();
    tester.view.physicalSize = const Size(1000, 900);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);

    await tester.pumpWidget(
      _wrap(
        const SizedBox.shrink(),
        repository: repository,
        aiRepository: aiRepository,
        initialLocation: learningProjectAuthoringRoute('project-1'),
      ),
    );
    await tester.pumpAndSettle();
    while (tester.takeException() != null) {}

    expect(find.text('Open AI assistant'), findsOneWidget);
    expect(find.text('AI project assistant'), findsNothing);
  });

  testWidgets('long Arabic title is secondary not main workspace heading', (
    tester,
  ) async {
    final longTitle =
        'نظام ري ذكي باستخدام Arduino للمدارس مع مستشعرات رطوبة التربة';
    final repository = _AuthoringTestRepository(
      categories: const [],
      draftSubmission: _draftSubmission(title: longTitle),
    );
    final aiRepository = _RecordingAiRepository();

    tester.view.resetPhysicalSize();
    tester.view.physicalSize = const Size(1280, 900);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);

    await tester.pumpWidget(
      _wrap(
        const SizedBox.shrink(),
        repository: repository,
        aiRepository: aiRepository,
        initialLocation: learningProjectAuthoringRoute('project-1'),
        locale: const Locale('en'),
      ),
    );
    await tester.pumpAndSettle();
    while (tester.takeException() != null) {}

    expect(find.text('AI-assisted project draft'), findsOneWidget);
    expect(find.text(longTitle, skipOffstage: false), findsWidgets);
    final heading = tester.widget<Text>(find.text('AI-assisted project draft'));
    expect(heading.style?.fontSize, isNotNull);
  });

  test('content direction resolves Arabic and mixed text', () {
    expect(
      resolveContentTextDirection('نظام ري ذكي باستخدام Arduino'),
      TextDirection.rtl,
    );
    expect(
      resolveContentTextDirection('Smart watering with Arduino'),
      TextDirection.ltr,
    );
    expect(
      resolveContentTextDirection('   Arduino starter kit'),
      TextDirection.ltr,
    );
  });

  test('selectDiscussionTarget binds composer target metadata', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);

    final controller = container.read(aiAssistantControllerProvider.notifier);
    controller.selectDiscussionTarget(
      proposalId: 'proposal-1',
      reviewStateId: 'review-1',
      target: 'difficulty',
    );

    expect(controller.state.activeDiscussionTarget, 'difficulty');
    expect(controller.state.activeDiscussionProposalId, 'proposal-1');
    expect(controller.state.activeDiscussionReviewStateId, 'review-1');
  });

  test('computeAuthoringReviewProgress counts resolved and discussion targets', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);

    final controller = container.read(aiAssistantControllerProvider.notifier);
    final progress = controller.computeAuthoringReviewProgress(
      const AiAuthoringReviewState(
        reviewStateId: 'review-1',
        proposalId: 'proposal-1',
        baseUpdatedAt: '2026-07-17T00:00:00.000Z',
        status: 'IN_REVIEW',
        fieldDecisions: AiAuthoringReviewFieldDecisions(
          title: 'ACCEPT_PROPOSAL',
          shortDescription: 'KEEP_CURRENT',
          description: 'UNREVIEWED',
          difficulty: 'REVISION_REQUESTED',
          estimatedMinutes: 'UNREVIEWED',
        ),
        componentDecision: 'UNREVIEWED',
        stepDecision: 'UNREVIEWED',
      ),
    );

    expect(progress.resolved, 2);
    expect(progress.needsDiscussion, 1);
    expect(progress.unreviewed, 4);
    expect(progress.total, 7);
    expect(progress.isReadyToApply, isFalse);
  });

  test('submitDiscussionComment calls discuss endpoint with learner text', () async {
    final container = ProviderContainer(
      overrides: [
        aiRepositoryProvider.overrideWithValue(_DiscussionRecordingAiRepository()),
      ],
    );
    addTearDown(container.dispose);

    final controller = container.read(aiAssistantControllerProvider.notifier);
    controller.state = const AiChatState(
      conversationId: 'conversation-1',
      activeDiscussionTarget: 'components',
      activeDiscussionProposalId: 'proposal-1',
      activeDiscussionReviewStateId: 'review-1',
    );

    await controller.submitDiscussionComment(
      text: 'Remove the pump and add an LED alert instead.',
      locale: 'en',
    );

    final repo =
        container.read(aiRepositoryProvider) as _DiscussionRecordingAiRepository;
    expect(repo.discussCalls, 1);
    expect(repo.lastDiscussTarget, 'components');
    expect(
      repo.lastDiscussComment,
      'Remove the pump and add an LED alert instead.',
    );
    expect(controller.state.activeDiscussionTarget, isNull);
  });

  test('submitAuthoringReviewDecision calls repository review endpoint', () async {
    final container = ProviderContainer(
      overrides: [
        aiRepositoryProvider.overrideWithValue(_ReviewRecordingAiRepository()),
      ],
    );
    addTearDown(container.dispose);

    final controller = container.read(aiAssistantControllerProvider.notifier);
    controller.state = const AiChatState(conversationId: 'conversation-1');

    await controller.submitAuthoringReviewDecision(
      proposalId: 'proposal-1',
      target: 'title',
      decision: 'ACCEPT_PROPOSAL',
    );

    final repo = container.read(aiRepositoryProvider) as _ReviewRecordingAiRepository;
    expect(repo.reviewCalls, 1);
    expect(repo.lastReviewTarget, 'title');
    expect(repo.lastReviewDecision, 'ACCEPT_PROPOSAL');
  });

  test('findLatestAuthoringProposalState prefers highest proposal version', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);

    final controller = container.read(aiAssistantControllerProvider.notifier);
    controller.state = AiChatState(
      messages: [
        AiMessageItem(
          id: 'clarification-1',
          role: 'ASSISTANT',
          status: 'COMPLETED',
          contentText: null,
          contentBlocks: const [
            AiContentBlock(
              type: 'project_authoring_clarification',
              authoringStatus: 'READY_FOR_PROPOSAL',
            ),
          ],
          createdAt: DateTime.utc(2026, 7, 17),
        ),
        AiMessageItem(
          id: 'proposal-v1',
          role: 'ASSISTANT',
          status: 'COMPLETED',
          contentText: null,
          contentBlocks: const [
            AiContentBlock(
              type: 'project_authoring_proposal',
              authoringProposalId: 'proposal-v1',
              authoringProposalVersion: 1,
              authoringProposalClarificationMessageId: 'clarification-1',
              authoringProposalProject: AiAuthoringProposalProject(
                title: 'Version one',
                shortDescription: 'Short enough summary for preview.',
                description: 'Long enough description for version one.',
                difficulty: 'BEGINNER',
              ),
            ),
          ],
          createdAt: DateTime.utc(2026, 7, 17, 1),
        ),
        AiMessageItem(
          id: 'proposal-v2',
          role: 'ASSISTANT',
          status: 'COMPLETED',
          contentText: null,
          contentBlocks: const [
            AiContentBlock(
              type: 'project_authoring_proposal',
              authoringProposalId: 'proposal-v2',
              authoringProposalVersion: 2,
              authoringProposalClarificationMessageId: 'clarification-1',
              authoringProposalProject: AiAuthoringProposalProject(
                title: 'Version two',
                shortDescription: 'Short enough summary for preview.',
                description: 'Long enough description for version two.',
                difficulty: 'BEGINNER',
              ),
            ),
          ],
          createdAt: DateTime.utc(2026, 7, 17, 2),
        ),
      ],
    );

    final proposal =
        controller.findLatestAuthoringProposalState()?.proposal;
    expect(proposal?.authoringProposalVersion, 2);
    expect(proposal?.authoringProposalProject?.title, 'Version two');
  });

  group('learner draft submission UX', () {
    test('PROJECT_SUBMISSION_INCOMPLETE maps missing image field error', () {
      const error = ApiException(
        message: 'Project is not ready for review submission.',
        code: 'PROJECT_SUBMISSION_INCOMPLETE',
        details: {
          'issues': [
            {
              'field': 'coverImageUrl',
              'message':
                  'At least one project image is required before submitting for review.',
            },
          ],
        },
      );

      expect(error.fieldIssues.single.path, 'coverImageUrl');
      expect(
        error.displayMessage,
        'Add at least one project image before submitting for review.',
      );
      expect(projectSubmissionIncompleteRequiresImage(error), isTrue);
    });

    test('known completeness validation does not use generic fallback', () {
      const error = ApiException(
        message: 'Project is not ready for review submission.',
        code: 'PROJECT_SUBMISSION_INCOMPLETE',
        details: {
          'issues': [
            {'field': 'steps', 'message': 'At least one step is required.'},
          ],
        },
      );

      expect(
        error.displayMessage,
        'Add at least one project step before submitting.',
      );
      expect(
        error.displayMessage,
        isNot('Something went wrong. Please try again.'),
      );
    });

    test('string errors still use generic fallback', () {
      expect(
        userFriendlyErrorMessage('network failed'),
        'Something went wrong. Please try again.',
      );
    });
  });

  testWidgets('draft card shows primary Submit for review action', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(1280, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          learningHubRepositoryProvider.overrideWithValue(
            _SubmissionsListTestRepository([
              _draftSubmission(title: 'Night light draft'),
            ]),
          ),
        ],
        child: const MaterialApp(home: LearningProjectSubmissionsPage()),
      ),
    );
    await tester.pumpAndSettle();
    tester.takeException();

    expect(find.text('Submit for review'), findsOneWidget);
    expect(find.text('View'), findsOneWidget);
    expect(find.text('Continue with AI'), findsOneWidget);
    expect(find.text('Edit'), findsOneWidget);
  });
}

class _DiscussionRecordingAiRepository extends _RecordingAiRepository {
  int discussCalls = 0;
  String? lastDiscussTarget;
  String? lastDiscussComment;

  @override
  Future<AiTurnResponse> submitAuthoringProposalDiscussion({
    required String conversationId,
    required String proposalId,
    required String reviewStateId,
    required String target,
    required String comment,
    required String clientMessageId,
  }) async {
    discussCalls += 1;
    lastDiscussTarget = target;
    lastDiscussComment = comment;
    return AiTurnResponse(
      conversationId: conversationId,
      userMessageId: 'user-discuss',
      assistantMessageId: 'assistant-discuss',
      contentBlocks: [
        const AiContentBlock(
          type: 'text',
          text: 'I will remove the pump and add an LED alert.',
        ),
        AiContentBlock(
          type: 'project_authoring_review_state',
          authoringReviewState: AiAuthoringReviewState(
            reviewStateId: 'review-2',
            proposalId: proposalId,
            baseUpdatedAt: '2026-07-17T00:00:00.000Z',
            status: 'DISCUSSION_NEEDED',
            fieldDecisions: const AiAuthoringReviewFieldDecisions(
              title: 'UNREVIEWED',
              shortDescription: 'UNREVIEWED',
              description: 'UNREVIEWED',
              difficulty: 'UNREVIEWED',
              estimatedMinutes: 'UNREVIEWED',
            ),
            componentDecision: 'REVISION_REQUESTED',
            stepDecision: 'UNREVIEWED',
            revisionRequests: const [
              AiAuthoringRevisionRequest(
                target: 'components',
                comment: 'Remove the pump and add an LED alert instead.',
                status: 'OPEN',
              ),
            ],
          ),
        ),
      ],
      scopeClassification: 'DOMAIN_KNOWLEDGE',
    );
  }
}

class _ReviewRecordingAiRepository extends _RecordingAiRepository {
  int reviewCalls = 0;
  String? lastReviewTarget;
  String? lastReviewDecision;

  @override
  Future<AiTurnResponse> submitAuthoringProposalReview({
    required String conversationId,
    required String proposalId,
    required String target,
    required String decision,
    String? comment,
  }) async {
    reviewCalls += 1;
    lastReviewTarget = target;
    lastReviewDecision = decision;
    return AiTurnResponse(
      conversationId: conversationId,
      userMessageId: 'user-review',
      assistantMessageId: 'assistant-review',
      contentBlocks: const [
        AiContentBlock(
          type: 'project_authoring_review_state',
          authoringReviewState: AiAuthoringReviewState(
            reviewStateId: 'review-1',
            proposalId: 'proposal-1',
            baseUpdatedAt: '2026-07-17T00:00:00.000Z',
            status: 'IN_REVIEW',
            fieldDecisions: AiAuthoringReviewFieldDecisions(
              title: 'ACCEPT_PROPOSAL',
              shortDescription: 'UNREVIEWED',
              description: 'UNREVIEWED',
              difficulty: 'UNREVIEWED',
              estimatedMinutes: 'UNREVIEWED',
            ),
            componentDecision: 'UNREVIEWED',
            stepDecision: 'UNREVIEWED',
          ),
        ),
      ],
      scopeClassification: 'DOMAIN_KNOWLEDGE',
    );
  }
}
