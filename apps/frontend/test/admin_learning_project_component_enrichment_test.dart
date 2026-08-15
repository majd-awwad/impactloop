import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/core/errors/api_exception.dart';
import 'package:frontend/features/admin_portal/data/admin_learning_projects_api.dart';
import 'package:frontend/features/admin_portal/data/models/admin_learning_projects_models.dart';
import 'package:frontend/l10n/app_localizations.dart';
import 'package:frontend/features/admin_portal/presentation/widgets/admin_learning_project_component_editor_dialog.dart';
import 'package:frontend/features/materials/application/material_listing_providers.dart';
import 'package:frontend/features/materials/data/models/category.dart';

AdminLearningProjectComponent _sampleComponent() {
  return AdminLearningProjectComponent.fromJson({
    'id': 'comp-1',
    'name': 'Arduino Uno board',
    'materialType': 'Arduino board',
    'quantity': 2,
    'unit': 'piece',
    'componentRole': 'REQUIRED_MATERIAL',
    'isRequired': true,
    'canBeSubstituted': true,
    'categoryId': 'mat-cat-1',
    'category': {
      'id': 'mat-cat-1',
      'nameEn': 'Electronics',
      'nameAr': 'إلكترونيات',
    },
    'searchKeywords': ['arduino'],
    'alternativeKeywords': ['microcontroller'],
    'notes': 'Any Uno variant',
    'providedByUser': true,
    'confirmedByUser': false,
    'reviewStatus': 'PENDING_REVIEW',
  });
}

AdminLearningProjectDetail _sampleDetail() {
  return AdminLearningProjectDetail.fromJson({
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
      'hardIssues': [],
      'softWarnings': [],
      'canApprove': true,
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
}

class _CapturingAdminLearningProjectsApi extends AdminLearningProjectsApi {
  _CapturingAdminLearningProjectsApi()
    : super(Dio(BaseOptions(baseUrl: 'http://test')));

  Map<String, dynamic>? lastUpdateBody;

  @override
  Future<AdminLearningProjectDetail> updateProjectComponent({
    required String projectId,
    required String componentId,
    required Map<String, dynamic> body,
  }) async {
    lastUpdateBody = body;
    return _sampleDetail();
  }
}

class _FailingAdminLearningProjectsApi extends AdminLearningProjectsApi {
  _FailingAdminLearningProjectsApi()
    : super(Dio(BaseOptions(baseUrl: 'http://test')));

  @override
  Future<AdminLearningProjectDetail> updateProjectComponent({
    required String projectId,
    required String componentId,
    required Map<String, dynamic> body,
  }) {
    throw ApiException(
      message: 'Each component must have a unique name.',
      code: 'DUPLICATE_COMPONENT_NAME',
      statusCode: 400,
    );
  }
}

void main() {
  group('Admin component enrichment helpers', () {
    test(
      'buildAdminComponentUpdatePayload sends numeric quantity and enum role',
      () {
        final body = buildAdminComponentUpdatePayload(
          componentName: 'Arduino Uno',
          quantity: 1,
          unit: 'piece',
          componentRole: 'REQUIRED_MATERIAL',
          categoryId: 'clxyz1234567890abcdefghij',
          materialType: 'Arduino Uno',
          searchKeywords: const ['arduino, microcontroller'],
          alternativeKeywords: const [],
          canBeSubstituted: true,
          isRequired: true,
          notes: 'Any board',
        );

        expect(body['quantity'], isA<double>());
        expect(body['quantity'], 1);
        expect(body['componentRole'], 'REQUIRED_MATERIAL');
        expect(body['categoryId'], 'clxyz1234567890abcdefghij');
        expect(body['searchKeywords'], ['arduino', 'microcontroller']);
      },
    );

    test('buildAdminComponentUpdatePayload omits categoryId when null', () {
      final body = buildAdminComponentUpdatePayload(
        componentName: 'Sensor',
        quantity: 2,
        unit: 'piece',
        componentRole: 'REQUIRED_MATERIAL',
        categoryId: null,
        materialType: 'Sensor',
        searchKeywords: const [],
        alternativeKeywords: const [],
        canBeSubstituted: false,
        isRequired: true,
        notes: null,
      );

      expect(body.containsKey('categoryId'), isFalse);
    });

    test('normalizeAdminComponentKeywords splits comma-separated values', () {
      expect(
        normalizeAdminComponentKeywords(const ['arduino, microcontroller']),
        ['arduino', 'microcontroller'],
      );
    });

    test('formatAdminComponentEditorError shows field validation message', () {
      final l10n = lookupAppLocalizations(const Locale('en'));
      final message = formatAdminComponentEditorError(
        ApiException(
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: {
            'issues': [
              {
                'path': 'categoryId',
                'message': 'Category id must be a valid category identifier.',
              },
            ],
          },
        ),
        l10n,
      );

      expect(
        message,
        contains('Choose a project category before submitting.'),
      );
      expect(message, isNot('Validation failed'));
    });

    test(
      'formatAdminComponentSummary includes role, category, and keywords',
      () {
        final summary = formatAdminComponentSummary(_sampleComponent());

        expect(summary, contains('2.0 piece'));
        expect(summary, contains('Required material'));
        expect(summary, contains('Electronics'));
        expect(summary, contains('keywords: arduino'));
        expect(summary, contains('alt keywords: microcontroller'));
      },
    );

    test('buildAdminComponentQualityChips renders hard and soft messages', () {
      const hard = AdminComponentQualityIssue(
        code: 'NO_COMPONENTS',
        message: 'Project has no required components.',
        severity: 'hard',
      );
      const soft = AdminComponentQualityIssue(
        code: 'VAGUE_COMPONENT_NAME',
        message: 'Name is vague.',
        severity: 'soft',
        componentId: 'comp-1',
      );

      final widget = MaterialApp(
        home: Scaffold(
          body: Column(
            children: [
              buildAdminComponentQualityChips(const [hard]),
              buildAdminComponentQualityChips(const [soft]),
            ],
          ),
        ),
      );

      expect(widget, isA<MaterialApp>());
    });

    test('approve gating helpers distinguish hard block vs soft confirm', () {
      const hardBlocked = AdminLearningProjectComponentQuality(
        hardIssues: [
          AdminComponentQualityIssue(
            code: 'NO_COMPONENTS',
            message: 'No components',
            severity: 'hard',
          ),
        ],
        canApprove: false,
      );
      const softOnly = AdminLearningProjectComponentQuality(
        softWarnings: [
          AdminComponentQualityIssue(
            code: 'VAGUE_COMPONENT_NAME',
            message: 'Vague name',
            severity: 'soft',
          ),
        ],
        canApprove: true,
      );
      const clean = AdminLearningProjectComponentQuality(canApprove: true);

      expect(adminApproveBlockedByComponentQuality(hardBlocked), isTrue);
      expect(adminApproveNeedsSoftWarningConfirmation(hardBlocked), isFalse);
      expect(adminApproveBlockedByComponentQuality(softOnly), isFalse);
      expect(adminApproveNeedsSoftWarningConfirmation(softOnly), isTrue);
      expect(adminApproveBlockedByComponentQuality(clean), isFalse);
      expect(adminApproveNeedsSoftWarningConfirmation(clean), isFalse);
    });

    test('published projects disable component editing via allowedActions', () {
      final detail = AdminLearningProjectDetail.fromJson({
        'id': 'proj-2',
        'title': 'Published robot',
        'shortDescription': 'Short',
        'description': 'Long',
        'status': 'PUBLISHED',
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
        'allowedActions': {
          'canApprove': false,
          'canRequestChanges': false,
          'canReject': false,
          'canHide': true,
          'canRestore': false,
          'canArchive': true,
          'canEditComponents': false,
        },
      });

      expect(detail.allowedActions.canEditComponents, isFalse);
    });
  });

  group('AdminLearningProjectComponentEditorDialog', () {
    testWidgets('maps component fields into the edit form', (tester) async {
      final api = _CapturingAdminLearningProjectsApi();
      final component = _sampleComponent();

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            adminLearningProjectsApiProvider.overrideWithValue(api),
            materialCategoriesProvider.overrideWith(
              (ref) async => [
                const MaterialCategory(
                  id: 'mat-cat-1',
                  nameEn: 'Electronics',
                  nameAr: 'إلكترونيات',
                  categoryType: 'MATERIAL',
                ),
              ],
            ),
          ],
          child: MaterialApp(
            home: Scaffold(
              body: Builder(
                builder: (context) {
                  return FilledButton(
                    onPressed: () {
                      AdminLearningProjectComponentEditorDialog.show(
                        context,
                        projectId: 'proj-1',
                        component: component,
                      );
                    },
                    child: const Text('Open'),
                  );
                },
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Open'));
      await tester.pumpAndSettle();

      expect(find.text('Edit component'), findsOneWidget);
      expect(find.text('Arduino Uno board'), findsOneWidget);
      expect(find.text('arduino'), findsOneWidget);
      expect(find.text('microcontroller'), findsOneWidget);
      expect(find.text('Any Uno variant'), findsOneWidget);

      await tester.tap(find.text('Save'));
      await tester.pumpAndSettle();

      expect(api.lastUpdateBody, isNotNull);
      expect(api.lastUpdateBody!['componentName'], 'Arduino Uno board');
      expect(api.lastUpdateBody!['componentRole'], 'REQUIRED_MATERIAL');
      expect(api.lastUpdateBody!['categoryId'], 'mat-cat-1');
      expect(api.lastUpdateBody!['quantity'], isA<num>());
      expect(api.lastUpdateBody!['searchKeywords'], ['arduino']);
      expect(api.lastUpdateBody!['alternativeKeywords'], ['microcontroller']);
      expect(api.lastUpdateBody!['reviewStatus'], 'ACCEPTED');
    });

    testWidgets('shows server validation message in modal', (tester) async {
      final api = _FailingAdminLearningProjectsApi();
      final component = _sampleComponent();

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            adminLearningProjectsApiProvider.overrideWithValue(api),
            materialCategoriesProvider.overrideWith(
              (ref) async => [
                const MaterialCategory(
                  id: 'mat-cat-1',
                  nameEn: 'Electronics',
                  nameAr: 'إلكترونيات',
                  categoryType: 'MATERIAL',
                ),
              ],
            ),
          ],
          child: MaterialApp(
            home: Scaffold(
              body: Builder(
                builder: (context) {
                  return FilledButton(
                    onPressed: () {
                      AdminLearningProjectComponentEditorDialog.show(
                        context,
                        projectId: 'proj-1',
                        component: component,
                      );
                    },
                    child: const Text('Open'),
                  );
                },
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Open'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Save'));
      await tester.pumpAndSettle();

      expect(
        find.text('Each component must have a unique name.'),
        findsOneWidget,
      );
    });
  });

  testWidgets('quality warning chips render issue messages', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: buildAdminComponentQualityChips(const [
            AdminComponentQualityIssue(
              code: 'NO_REQUIRED_MATERIAL',
              message: 'No required material components.',
              severity: 'soft',
            ),
          ]),
        ),
      ),
    );

    expect(find.text('No required material components.'), findsOneWidget);
    expect(find.byType(Chip), findsOneWidget);
  });
}
