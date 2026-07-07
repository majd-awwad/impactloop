import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/admin_portal/data/models/admin_learning_projects_models.dart';

void main() {
  group('AdminLearningProjectComponent models', () {
    test('parses component quality and enrichment fields', () {
      final component = AdminLearningProjectComponent.fromJson({
        'id': 'comp-1',
        'name': 'Arduino Uno board',
        'materialType': 'Arduino board',
        'quantity': 2,
        'unit': 'piece',
        'componentRole': 'REQUIRED_MATERIAL',
        'isRequired': true,
        'canBeSubstituted': true,
        'categoryId': 'cat-1',
        'category': {
          'id': 'cat-1',
          'nameEn': 'Electronics',
          'nameAr': 'إلكترونيات',
        },
        'searchKeywords': ['arduino'],
        'alternativeKeywords': ['microcontroller'],
        'notes': 'Any Uno variant',
        'providedByUser': true,
        'confirmedByUser': false,
        'reviewStatus': 'PENDING_REVIEW',
        'quality': {
          'hardIssues': [],
          'softWarnings': [
            {
              'code': 'VAGUE_COMPONENT_NAME',
              'message': 'Name is vague',
              'severity': 'soft',
              'componentId': 'comp-1',
            },
          ],
        },
      });

      expect(component.category?.nameEn, 'Electronics');
      expect(component.alternativeKeywords, ['microcontroller']);
      expect(component.quality.softWarnings, hasLength(1));
    });

    test('parses project component quality summary', () {
      final detail = AdminLearningProjectDetail.fromJson({
        'id': 'proj-1',
        'title': 'Robot',
        'shortDescription': 'Short',
        'description': 'Long',
        'status': 'PENDING_REVIEW',
        'difficulty': 'BEGINNER',
        'category': {'id': 'cat', 'nameEn': 'Robotics', 'nameAr': 'روبوتات'},
        'author': {
          'id': 'user-1',
          'displayName': 'Learner',
          'email': 'learner@test.com',
        },
        'createdAt': '2026-01-01T00:00:00.000Z',
        'updatedAt': '2026-01-01T00:00:00.000Z',
        'reviewedBy': null,
        'images': [],
        'requiredComponents': [],
        'steps': [],
        'links': [],
        'tags': [],
        'componentQuality': {
          'hardIssues': [
            {
              'code': 'NO_COMPONENTS',
              'message': 'Project has no required components.',
              'severity': 'hard',
            },
          ],
          'softWarnings': [],
          'canApprove': false,
        },
        'allowedActions': {
          'canApprove': true,
          'canRequestChanges': true,
          'canReject': true,
          'canHide': false,
          'canRestore': false,
          'canArchive': true,
          'canEditComponents': true,
        },
      });

      expect(detail.componentQuality.canApprove, isFalse);
      expect(detail.allowedActions.canEditComponents, isTrue);
    });
  });
}
