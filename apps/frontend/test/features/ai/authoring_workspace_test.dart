import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/ai/domain/ai_models.dart';
import 'package:frontend/features/ai/domain/authoring_session_models.dart';
import 'package:frontend/features/ai/presentation/l10n/ai_l10n.dart';

AuthoringSessionResponse _response({
  required String projectId,
  required String conversationId,
  required String sessionId,
  int version = 1,
  String stage = 'TITLE',
  String status = 'WAITING_FOR_USER',
  AuthoringPersistedTurn? turn,
  String title = 'Arduino light',
}) {
  return AuthoringSessionResponse(
    session: AuthoringPersistedSession(
      id: sessionId,
      conversationId: conversationId,
      learningProjectId: projectId,
      stage: stage,
      status: status,
      version: version,
      completedStages: const [],
      baseProjectUpdatedAt: '2026-01-01T00:00:00.000Z',
    ),
    currentTurn: turn,
    canonicalProject: AiAuthoringCanonicalProject(
      id: projectId,
      updatedAt: '2026-01-01T00:00:00.000Z',
      title: title,
      shortDescription: 'Short',
      description: 'Full',
      difficulty: 'INTERMEDIATE',
      estimatedMinutes: 60,
    ),
    availableActions: const ['ACCEPT_TURN', 'SUGGEST_ANOTHER', 'SAVE_MANUAL'],
  );
}

AuthoringPersistedTurn _turn({
  required String id,
  String stage = 'TITLE',
  Object? value = 'Arduino light',
}) {
  return AuthoringPersistedTurn(
    id: id,
    stage: stage,
    kind: 'PROPOSAL',
    status: 'PROPOSED',
    payload: {'value': value},
    explanation: 'Suggestion',
    baseProjectUpdatedAt: '2026-01-01T00:00:00.000Z',
  );
}

void main() {
  group('authoringSessionResponseToSnapshot', () {
    test('maps canonical project for immediate editor sync', () {
      final snapshot = authoringSessionResponseToSnapshot(
        _response(
          projectId: 'p1',
          conversationId: 'c1',
          sessionId: 's1',
          turn: _turn(id: 'turn-1'),
          title: 'Desk light',
        ),
      );
      expect(snapshot.canonicalProject.title, 'Desk light');
      expect(snapshot.currentSuggestion?.turnId, 'turn-1');
      expect(snapshot.availableActions, contains('ACCEPT_TURN'));
    });

    test('clarification follow-up question is not a saveable suggestion', () {
      final snapshot = authoringSessionResponseToSnapshot(
        AuthoringSessionResponse(
          session: AuthoringPersistedSession(
            id: 's1',
            conversationId: 'c1',
            learningProjectId: 'p1',
            stage: 'OVERVIEW',
            status: 'WAITING_FOR_USER',
            version: 1,
            completedStages: const [],
            baseProjectUpdatedAt: DateTime.now().toUtc().toIso8601String(),
            currentTurnId: 'clarify-1',
          ),
          currentTurn: AuthoringPersistedTurn(
            id: 'clarify-1',
            stage: 'OVERVIEW',
            kind: 'FOLLOW_UP_QUESTION',
            status: 'PROPOSED',
            payload: const {
              'question': 'What skill level should this project assume?',
            },
            explanation: 'Clarification question',
            baseProjectUpdatedAt: DateTime.now().toUtc().toIso8601String(),
          ),
          canonicalProject: AiAuthoringCanonicalProject(
            id: 'p1',
            updatedAt: DateTime.now().toUtc().toIso8601String(),
            title: 'Door alarm',
            shortDescription: 'TBD',
            description: 'TBD',
            difficulty: 'BEGINNER',
            estimatedMinutes: 120,
            components: const [],
            steps: const [],
          ),
          availableActions: const ['START'],
        ),
      );

      expect(snapshot.currentSuggestion, isNull);
      expect(snapshot.currentTurn?.proposal['question'],
          'What skill level should this project assume?');
    });

    test('STEPS overview snapshot keeps step plan and overview actions', () {
      final snapshot = authoringSessionResponseToSnapshot(
        AuthoringSessionResponse(
          session: AuthoringPersistedSession(
            id: 's1',
            conversationId: 'c1',
            learningProjectId: 'p1',
            stage: 'STEPS_OVERVIEW',
            status: 'WAITING_FOR_USER',
            version: 4,
            completedStages: const ['COMPONENTS'],
            baseProjectUpdatedAt: DateTime.now().toUtc().toIso8601String(),
            currentTurnId: 'steps-1',
          ),
          currentTurn: AuthoringPersistedTurn(
            id: 'steps-1',
            stage: 'STEPS_OVERVIEW',
            kind: 'STEP_PLAN',
            status: 'PROPOSED',
            payload: {
              'steps': [
                {
                  'id': 'step-1',
                  'order': 1,
                  'title': 'تجهيز Arduino',
                  'description': 'جهّز اللوحة والمكوّنات.',
                },
                {
                  'id': 'step-2',
                  'order': 2,
                  'title': 'توصيل LDR',
                  'description': 'ابنِ Voltage Divider ووصّله بـ Analog pin.',
                },
                {
                  'id': 'step-3',
                  'order': 3,
                  'title': 'توصيل LED',
                  'description': 'وصّل LED مع مقاومة 220Ω.',
                },
                {
                  'id': 'step-4',
                  'order': 4,
                  'title': 'كتابة الكود',
                  'description': 'اقرأ LDR واضبط Threshold.',
                },
                {
                  'id': 'step-5',
                  'order': 5,
                  'title': 'الاختبار',
                  'description': 'ارفع الكود واختبر في الظلام والضوء.',
                },
              ],
            },
            explanation: 'خطة من 5 خطوات جاهزة للمراجعة.',
            baseProjectUpdatedAt: DateTime.now().toUtc().toIso8601String(),
          ),
          canonicalProject: AiAuthoringCanonicalProject(
            id: 'p1',
            updatedAt: DateTime.now().toUtc().toIso8601String(),
            title: 'مصباح ليلي',
            shortDescription: 'مشروع Arduino',
            description: 'LDR وLED',
            difficulty: 'BEGINNER',
            estimatedMinutes: 90,
            components: const [],
            steps: const [],
          ),
          availableActions: const [
            'ACCEPT_TURN',
            'SUGGEST_ANOTHER',
            'SAVE_MANUAL',
            'CHOOSE_MODE',
          ],
        ),
      );

      expect(snapshot.currentSuggestion?.hasStepList, isTrue);
      expect(snapshot.currentSuggestion?.steps.length, 5);
      expect(snapshot.availableActions, contains('CHOOSE_MODE'));
      expect(snapshot.availableActions, contains('SUGGEST_ANOTHER'));
      expect(snapshot.availableActions, contains('SAVE_MANUAL'));
    });

    test('historical preview uses payload value not learner feedback explanation', () {
      const learnerFeedback =
          'أعطيني وصف أقصر وركز على إنه الصوت والضوء يشتغلوا لما ينفتح الباب.';
      final summary = historicalSummaryFromTurn(
        AuthoringPersistedTurn(
          id: 'turn-a',
          stage: 'SHORT_DESCRIPTION',
          kind: 'STAGE_PROPOSAL',
          status: 'SUPERSEDED',
          payload: const {
            'value':
                'إنذار باب Arduino يشغّل Buzzer وLED أحمر عند فتح الباب عبر Reed switch.',
          },
          explanation: learnerFeedback,
          baseProjectUpdatedAt: DateTime.now().toUtc().toIso8601String(),
        ),
      );

      expect(summary.preview, contains('إنذار باب Arduino'));
      expect(summary.preview, isNot(contains(learnerFeedback)));
    });
  });

  group('authoring action mapping and composer hints', () {
    test('mapUiActionToPersistedAction maps CHOOSE_MODE to CHOOSE_STEP_MODE', () {
      final response = AuthoringSessionResponse(
        session: AuthoringPersistedSession(
          id: 'session-1',
          conversationId: 'conv-1',
          learningProjectId: 'project-1',
          stage: 'STEPS_OVERVIEW',
          status: 'WAITING_FOR_USER',
          version: 1,
          completedStages: const [],
          baseProjectUpdatedAt: '2026-01-01T00:00:00.000Z',
          currentTurnId: 'turn-1',
        ),
        currentTurn: null,
        canonicalProject: AiAuthoringCanonicalProject(
          id: 'project-1',
          updatedAt: '2026-01-01T00:00:00.000Z',
          title: 'Test project',
          shortDescription: 'Short',
          description: 'Full',
          difficulty: 'BEGINNER',
          estimatedMinutes: 60,
        ),
        availableActions: const ['CHOOSE_MODE'],
      );

      expect(
        mapUiActionToPersistedAction(
          uiAction: 'CHOOSE_MODE',
          response: response,
          mode: 'STEP_BY_STEP',
        ),
        'CHOOSE_STEP_MODE',
      );
    });

    test('composer hint does not expose raw stage enum', () {
      final hint = AiL10n.authoringDiscussComposerHintForSessionStage('STEPS_OVERVIEW');
      expect(hint.en, 'Describe the step changes you want…');
      expect(hint.en, isNot(contains('STEPS_OVERVIEW')));
    });
  });
}
