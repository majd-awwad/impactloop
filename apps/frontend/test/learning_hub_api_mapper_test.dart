import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/learning_hub/data/learning_hub_api_mapper.dart';
import 'package:frontend/features/learning_hub/domain/models/project_build.dart';

void main() {
  group('LearningHubApiMapper', () {
    test('maps list item fields and difficulty labels', () {
      final project = LearningHubApiMapper.fromListItemJson({
        'id': '11111111-1111-1111-1111-111111111111',
        'title': 'Obstacle Avoidance Robot',
        'shortDescription': 'Build a simple autonomous robot.',
        'category': {'id': 'cat-1', 'nameEn': 'Robotics', 'nameAr': 'روبوتات'},
        'difficulty': 'INTERMEDIATE',
        'estimatedDurationMinutes': 240,
        'coverImageUrl': 'https://example.com/cover.jpg',
        'authorName': 'Demo Author',
        'tags': ['robotics'],
        'ratingSummary': null,
        'createdAt': '2026-01-01T00:00:00.000Z',
      });

      expect(project.id, '11111111-1111-1111-1111-111111111111');
      expect(project.title.en, 'Obstacle Avoidance Robot');
      expect(project.summary.en, 'Build a simple autonomous robot.');
      expect(project.category.en, 'Robotics');
      expect(project.category.ar, 'روبوتات');
      expect(project.difficulty.en, 'Medium');
      expect(project.duration.en, '4 hrs');
      expect(project.imageUrl, 'https://example.com/cover.jpg');
      expect(project.hasRatings, isFalse);
      expect(project.ratingValue, 0);
      expect(project.ratingCount, 0);
      expect(project.components, isEmpty);
      expect(project.isFeatured, isFalse);
    });

    test('maps detail fields including components, steps, and links', () {
      final project = LearningHubApiMapper.fromDetailJson({
        'id': '22222222-2222-2222-2222-222222222222',
        'title': 'Simple LED Circuit',
        'shortDescription': 'Short copy',
        'description': 'Longer project description',
        'category': {
          'id': 'cat-2',
          'nameEn': 'Electronics',
          'nameAr': 'إلكترونيات',
        },
        'difficulty': 'BEGINNER',
        'estimatedDurationMinutes': 45,
        'coverImageUrl': null,
        'images': [
          {
            'id': 'img-1',
            'imageUrl': 'https://example.com/step.jpg',
            'sortOrder': 0,
          },
        ],
        'requiredComponents': [
          {'componentName': 'LED'},
          {'componentName': 'Resistor'},
        ],
        'steps': [
          {'stepNumber': 2, 'title': 'Wire the circuit'},
          {'stepNumber': 1, 'title': 'Place the LED'},
        ],
        'links': [
          {
            'title': 'Reference guide',
            'sourceName': 'Example Source',
            'url': 'https://example.com/guide',
          },
        ],
        'tags': ['electronics'],
        'ratingSummary': {'average': 4.5, 'count': 2},
        'recentReviews': [
          {
            'id': 'review-1',
            'projectId': '22222222-2222-2222-2222-222222222222',
            'rating': 5,
            'comment': 'Clear steps and easy to source.',
            'reviewerName': 'Mira',
            'isViewerReview': true,
            'createdAt': '2026-01-02T00:00:00.000Z',
            'updatedAt': '2026-01-02T00:00:00.000Z',
          },
        ],
        'viewerReview': {
          'id': 'review-1',
          'projectId': '22222222-2222-2222-2222-222222222222',
          'rating': 5,
          'comment': 'Clear steps and easy to source.',
          'reviewerName': 'Mira',
          'isViewerReview': true,
          'createdAt': '2026-01-02T00:00:00.000Z',
          'updatedAt': '2026-01-02T00:00:00.000Z',
        },
        'createdAt': '2026-01-01T00:00:00.000Z',
      });

      expect(project.difficulty.en, 'Easy');
      expect(project.duration.en, '45 min');
      expect(project.longDescription?.en, 'Longer project description');
      expect(project.imageUrl, 'https://example.com/step.jpg');
      expect(project.components.map((item) => item.en), ['LED', 'Resistor']);
      expect(project.componentCountLabel.en, '2 components');
      expect(project.steps.map((step) => step.title.en), [
        'Place the LED',
        'Wire the circuit',
      ]);
      expect(project.links.first.label.en, 'Reference guide');
      expect(project.links.first.urlLabel.en, 'https://example.com/guide');
      expect(project.hasRatings, isTrue);
      expect(project.ratingValue, 4.5);
      expect(project.ratingCount, 2);
      expect(
        project.recentReviews.single.comment,
        'Clear steps and easy to source.',
      );
      expect(project.viewerReview?.rating, 5);
      expect(project.viewerReview?.isViewerReview, isTrue);
    });

    test('maps ratingSummary when present', () {
      final project = LearningHubApiMapper.fromListItemJson({
        'id': '33333333-3333-3333-3333-333333333333',
        'title': 'Rated Project',
        'shortDescription': 'Summary',
        'category': {'nameEn': 'Energy', 'nameAr': 'Energy'},
        'difficulty': 'ADVANCED',
        'estimatedDurationMinutes': 90,
        'ratingSummary': {'average': 4.6, 'count': 12},
      });

      expect(project.difficulty.en, 'Advanced');
      expect(project.duration.en, '1 hr 30 min');
      expect(project.hasRatings, isTrue);
      expect(project.ratingValue, 4.6);
      expect(project.ratingCount, 12);
    });

    test('formatDurationMinutes handles flexible and hour labels', () {
      expect(
        LearningHubApiMapper.formatDurationMinutes(null),
        'Flexible timing',
      );
      expect(LearningHubApiMapper.formatDurationMinutes(30), '30 min');
      expect(LearningHubApiMapper.formatDurationMinutes(60), '1 hr');
      expect(LearningHubApiMapper.formatDurationMinutes(120), '2 hrs');
      expect(LearningHubApiMapper.formatDurationMinutes(90), '1 hr 30 min');
    });

    test('maps learner submission moderation fields and actions', () {
      final submission = LearningHubApiMapper.submissionFromJson({
        'id': '44444444-4444-4444-4444-444444444444',
        'title': 'Needs edits',
        'shortDescription': 'Short project summary.',
        'description': 'Full project description.',
        'status': 'CHANGES_REQUESTED',
        'category': {'id': 'cat-1', 'nameEn': 'Robotics', 'nameAr': 'روبوتات'},
        'difficulty': 'INTERMEDIATE',
        'estimatedDurationMinutes': 180,
        'submittedAt': '2026-01-01T00:00:00.000Z',
        'reviewedAt': '2026-01-02T00:00:00.000Z',
        'reviewNote': 'Clarify the component list.',
        'changesRequestedReason': 'Clarify the component list.',
        'availableActions': {
          'canView': true,
          'canEdit': true,
          'canResubmit': true,
          'canViewPublic': false,
        },
        'requiredComponents': [
          {
            'id': 'component-1',
            'componentName': 'Arduino Uno',
            'quantity': '2',
            'unit': 'pieces',
            'componentRole': 'REQUIRED_MATERIAL',
            'categoryId': 'material-cat',
            'materialType': 'Microcontroller',
            'searchKeywords': ['arduino', 'uno'],
            'canBeSubstituted': true,
            'notes': 'Any compatible board works.',
          },
        ],
        'steps': [
          {
            'id': 'step-1',
            'stepNumber': 1,
            'title': 'Wire board',
            'description': 'Connect wires.',
          },
        ],
        'links': [
          {'id': 'link-1', 'url': 'https://example.com', 'title': 'Guide'},
        ],
      });

      expect(submission.id, '44444444-4444-4444-4444-444444444444');
      expect(submission.status.label(), 'Changes requested');
      expect(submission.activeFeedback, 'Clarify the component list.');
      expect(submission.reviewedAt, DateTime.parse('2026-01-02T00:00:00.000Z'));
      expect(submission.statusDatePrefix, 'Reviewed');
      expect(submission.availableActions.canEdit, isTrue);
      expect(submission.availableActions.canResubmit, isTrue);
      expect(submission.requiredComponents.single.name, 'Arduino Uno');
      expect(submission.requiredComponents.single.searchKeywords, [
        'arduino',
        'uno',
      ]);
      expect(submission.steps.single.title, 'Wire board');
      expect(submission.links.single.url, 'https://example.com');
    });

    test('maps build step progress and guide conversation fields', () {
      final build = LearningHubApiMapper.fromBuildJson({
        'id': 'build-1',
        'projectId': 'project-1',
        'status': 'IN_PROGRESS',
        'guideConversationId': 'conv-1',
        'project': {
          'id': 'project-1',
          'title': 'LED build',
          'shortDescription': 'Short',
        },
        'progress': {'total': 2, 'ready': 2, 'percent': 100},
        'materialReadiness': {
          'ready': 2,
          'linked': 0,
          'reserved': 0,
          'missing': 0,
          'total': 2,
        },
        'stepProgress': {
          'completed': 0,
          'total': 2,
          'percent': 0,
          'nextAction': 'COMPLETE_CURRENT_STEP',
          'currentStep': {
            'stepId': 'step-1',
            'stepNumber': 1,
            'title': 'Place the LED',
          },
          'steps': [
            {
              'stepId': 'step-1',
              'stepNumber': 1,
              'title': 'Place the LED',
              'description': 'Insert LED',
              'state': 'CURRENT',
            },
            {
              'stepId': 'step-2',
              'stepNumber': 2,
              'title': 'Add resistor',
              'description': 'Wire resistor',
              'state': 'LOCKED',
            },
          ],
        },
        'items': [],
      });

      expect(build.guideConversationId, 'conv-1');
      expect(build.stepProgress.currentStep?.title, 'Place the LED');
      expect(build.stepProgress.nextAction, ProjectBuildNextAction.completeCurrentStep);
      expect(build.stepProgress.steps.first.state, ProjectBuildStepState.current);
      expect(build.stepProgress.steps.last.state, ProjectBuildStepState.locked);
    });
  });
}
