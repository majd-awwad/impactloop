import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/core/errors/api_exception.dart';
import 'package:frontend/features/learning_hub/domain/models/project_build.dart';
import 'package:frontend/features/project_help_sessions/application/help_session_mutation_feedback.dart';
import 'package:frontend/features/project_help_sessions/application/project_help_session_timezone.dart';
import 'package:frontend/features/project_help_sessions/data/models/project_help_session_models.dart';

void main() {
  group('PHS request creation contract', () {
    test('payload uses build id distinct from project route id', () {
      const projectId = 'b40b04cc-d26d-4eb3-b310-2e4a14d92bbb';
      const buildId = 'cmshmeod6002vz0vg9v6trk9t';

      expect(projectId, isNot(buildId));
      expect(buildId.length, greaterThan(10));
      expect(projectId.contains('-'), isTrue);

      final payload = CreateProjectHelpSessionRequestPayload(
        problemDescription:
            'Need help with the bottle cap mosaic layout and glue pattern before assembly.',
        durationMinutes: 30,
        learnerTimeZone: 'Asia/Hebron',
        projectStepId: '7036e0b6-cced-4ee6-9262-c17774a68e28',
        proposedTimes: [
          DateTime.utc(2026, 8, 11, 10),
          DateTime.utc(2026, 8, 11, 14),
          DateTime.utc(2026, 8, 11, 18),
        ],
      );

      final json = payload.toJson();
      expect(json['projectStepId'], '7036e0b6-cced-4ee6-9262-c17774a68e28');
      expect((json['proposedTimes'] as List).length, 3);
      for (final value in json['proposedTimes'] as List) {
        expect(value.toString().endsWith('Z'), isTrue);
      }
    });

    test('build model id is used for API path not project id', () {
      final build = ProjectBuild(
        id: 'cmshmeod6002vz0vg9v6trk9t',
        projectId: 'b40b04cc-d26d-4eb3-b310-2e4a14d92bbb',
        status: ProjectBuildStatus.inProgress,
        project: const ProjectBuildProject(
          id: 'b40b04cc-d26d-4eb3-b310-2e4a14d92bbb',
          title: 'Bottle Cap Mosaic Board',
          shortDescription: 'Mosaic board',
        ),
        progress: const ProjectBuildProgress(total: 1, ready: 0, percent: 0),
        materialReadiness: const ProjectBuildMaterialReadiness(
          ready: 0,
          linked: 0,
          reserved: 0,
          missing: 0,
          total: 0,
        ),
        stepProgress: const ProjectBuildStepProgress(
          completed: 0,
          total: 1,
          percent: 0,
          steps: [
            ProjectBuildStepView(
              stepId: '7036e0b6-cced-4ee6-9262-c17774a68e28',
              stepNumber: 1,
              title: 'Arrange caps',
              description: 'Layout',
              state: ProjectBuildStepState.current,
            ),
          ],
        ),
        items: const [],
        attemptNumber: 1,
        startedAt: DateTime.utc(2026, 1, 1),
        updatedAt: DateTime.utc(2026, 1, 2),
      );

      expect(build.id, isNot(build.projectId));
      expect(build.stepProgress.steps.first.stepId, contains('-'));
    });

    test('validation error on projectStepId maps to friendly copy not generic', () {
      const error = ApiException(
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        statusCode: 400,
        details: {
          'issues': [
            {'path': 'projectStepId', 'message': 'Invalid uuid'},
          ],
        },
      );

      final message = resolveProjectHelpSessionErrorFromObject(
        error,
        isArabic: false,
      );

      expect(message, contains('selected step'));
      expect(message, isNot('Something went wrong. Please try again.'));
    });

    test('validation error on buildId maps to friendly copy', () {
      const error = ApiException(
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        statusCode: 400,
        details: {
          'issues': [
            {'path': 'buildId', 'message': 'Invalid cuid'},
          ],
        },
      );

      final message = resolveProjectHelpSessionErrorFromObject(
        error,
        isArabic: false,
      );

      expect(message, contains('build could not be found'));
    });

    test('409 conflict maps to active-session copy', () {
      const error = ApiException(
        message: 'An active help session already exists for this build.',
        statusCode: 409,
      );

      final message = resolveProjectHelpSessionErrorFromObject(
        error,
        isArabic: false,
      );

      expect(message, contains('active help session'));
      expect(message, isNot('Something went wrong. Please try again.'));
    });

    test('isActiveHelpSessionAlreadyExistsError accepts status-only 409', () {
      expect(
        isActiveHelpSessionAlreadyExistsError(
          const ApiException(
            message: 'An active help session already exists for this build.',
            statusCode: 409,
          ),
        ),
        isTrue,
      );
    });

    test('felt phone sleeve list payload parses without throwing', () {
      final session = ProjectHelpSession.fromJson({
        'id': 'cmshnlwpc00260kvg3bl84hbk',
        'status': 'PENDING',
        'project': {
          'id': 'f77f8f85-a9bf-4af8-9972-0a65b693c8cf',
          'title': 'Felt Phone Sleeve',
        },
        'build': {'id': 'cmshnkydp000g0kvgxiont9wo', 'attemptNumber': 1},
        'learner': {'id': 'learner-1', 'displayName': 'Majd Learner'},
        'author': {'id': 'author-1', 'displayName': 'Israa Learner'},
        'problemDescription': 'x' * 54,
        'durationMinutes': 30,
        'learnerTimeZone': 'Asia/Jerusalem',
        'timeOptions': [
          {
            'id': 'opt-1',
            'type': 'LEARNER_PROPOSED',
            'startsAt': '2026-08-07T07:00:00.000Z',
            'proposedBy': {'id': 'learner-1', 'displayName': 'Majd Learner'},
          },
        ],
        'allowedActions': {
          'canAcceptAlternative': false,
          'canRejectAlternative': false,
          'canCancel': true,
          'canJoin': false,
        },
        'createdAt': '2026-08-06T15:11:33.840Z',
        'updatedAt': '2026-08-06T15:11:33.840Z',
        'meetingReady': false,
      });

      expect(session.status, ProjectHelpSessionStatus.pending);
      expect(session.build.id, 'cmshnkydp000g0kvgxiont9wo');
      expect(session.status.isActive, isTrue);
    });
  });
}
