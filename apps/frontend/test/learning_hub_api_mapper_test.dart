import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/learning_hub/data/learning_hub_api_mapper.dart';

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
  });
}
