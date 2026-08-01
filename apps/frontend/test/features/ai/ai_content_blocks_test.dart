import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/features/ai/domain/ai_models.dart';

void main() {
  group('AiContentBlock.fromJson', () {
    test('parses text block', () {
      final block = AiContentBlock.fromJson({
        'type': 'text',
        'text': 'Arduino Uno is a microcontroller board.',
        'purpose': 'answer',
      });

      expect(block.type, 'text');
      expect(block.text, 'Arduino Uno is a microcontroller board.');
      expect(block.purpose, 'answer');
    });

    test('parses error block', () {
      final block = AiContentBlock.fromJson({
        'type': 'error',
        'code': 'AI_PROVIDER_ERROR',
        'message': 'Provider failed',
        'retryable': true,
      });

      expect(block.type, 'error');
      expect(block.code, 'AI_PROVIDER_ERROR');
      expect(block.message, 'Provider failed');
      expect(block.retryable, isTrue);
    });

    test('parses material_results block', () {
      final block = AiContentBlock.fromJson({
        'type': 'material_results',
        'items': [
          {
            'materialId': 'mat-1',
            'title': 'Wood panels',
            'priceLabel': 'Free',
            'categoryLabel': 'Wood',
            'condition': 'Good',
            'quantityLabel': '4 sheet',
            'locationLabel': 'Nablus',
            'pickupAllowed': true,
            'deliveryAllowed': false,
          },
        ],
      });

      expect(block.type, 'material_results');
      expect(block.materialItems, hasLength(1));
      expect(block.materialItems.first.materialId, 'mat-1');
      expect(block.materialItems.first.title, 'Wood panels');
      expect(block.materialItems.first.priceLabel, 'Free');
      expect(block.materialItems.first.pickupAllowed, isTrue);
    });

    test('parses material_details block', () {
      final block = AiContentBlock.fromJson({
        'type': 'material_details',
        'item': {
          'materialId': 'mat-2',
          'title': 'Arduino boards',
          'priceLabel': '₪120',
          'thumbnailUrl': 'https://example.com/arduino.jpg',
        },
      });

      expect(block.type, 'material_details');
      expect(block.materialItem?.materialId, 'mat-2');
      expect(block.materialItem?.title, 'Arduino boards');
      expect(
        block.materialItem?.thumbnailUrl,
        'https://example.com/arduino.jpg',
      );
    });

    test('parses project_results block', () {
      final block = AiContentBlock.fromJson({
        'type': 'project_results',
        'items': [
          {
            'projectId': 'proj-1',
            'title': 'Solar night light',
            'difficulty': 'Beginner',
            'estimatedTimeLabel': '2 h',
            'interestLabels': ['Electronics', 'Recycling'],
            'savedByLearner': true,
          },
        ],
      });

      expect(block.type, 'project_results');
      expect(block.projectItems, hasLength(1));
      expect(block.projectItems.first.projectId, 'proj-1');
      expect(block.projectItems.first.difficulty, 'Beginner');
      expect(block.projectItems.first.interestLabels, ['Electronics', 'Recycling']);
      expect(block.projectItems.first.savedByLearner, isTrue);
    });

    test('parses project_results block with owned-materials coverage fields', () {
      final block = AiContentBlock.fromJson({
        'type': 'project_results',
        'items': [
          {
            'projectId': 'proj-owned-1',
            'title': 'Mini Traffic Light',
            'difficulty': 'BEGINNER',
            'readinessPercent': 50,
            'matchedComponentCount': 2,
            'totalRequiredComponentCount': 4,
            'matchedComponents': ['Arduino Uno', 'Jumper wires'],
            'missingComponents': ['LEDs', 'Resistors'],
            'matchExplanation':
                'Mini Traffic Light — estimated component coverage: 50%',
          },
        ],
      });

      expect(block.projectItems.single.readinessPercent, 50);
      expect(block.projectItems.single.matchedComponentCount, 2);
      expect(block.projectItems.single.totalRequiredComponentCount, 4);
      expect(
        block.projectItems.single.matchedComponents,
        ['Arduino Uno', 'Jumper wires'],
      );
      expect(
        block.projectItems.single.missingComponents,
        ['LEDs', 'Resistors'],
      );
    });

    test('parses legacy project_results block without coverage fields', () {
      final block = AiContentBlock.fromJson({
        'type': 'project_results',
        'items': [
          {
            'projectId': 'proj-legacy-1',
            'title': 'Solar night light',
            'difficulty': 'Beginner',
          },
        ],
      });

      expect(block.projectItems.single.readinessPercent, isNull);
      expect(block.projectItems.single.matchedComponents, isEmpty);
      expect(block.projectItems.single.missingComponents, isEmpty);
    });

    test('parses project_details block', () {
      final block = AiContentBlock.fromJson({
        'type': 'project_details',
        'item': {
          'projectId': 'proj-2',
          'title': 'Cardboard robot',
          'summary': 'A simple recycled robot build.',
          'activeBuildId': 'build-1',
        },
      });

      expect(block.type, 'project_details');
      expect(block.projectItem?.projectId, 'proj-2');
      expect(block.projectItem?.summary, 'A simple recycled robot build.');
      expect(block.projectItem?.activeBuildId, 'build-1');
    });

    test('parses component_list block', () {
      final block = AiContentBlock.fromJson({
        'type': 'component_list',
        'projectId': 'proj-3',
        'items': [
          {
            'componentId': 'cmp-1',
            'name': 'LED strip',
            'quantity': 1,
            'unit': 'roll',
            'required': true,
            'categoryLabel': 'Electronics',
          },
        ],
      });

      expect(block.type, 'component_list');
      expect(block.projectId, 'proj-3');
      expect(block.componentItems, hasLength(1));
      expect(block.componentItems.first.name, 'LED strip');
      expect(block.componentItems.first.quantity, 1);
      expect(block.componentItems.first.required, isTrue);
    });

    test('parses build_checklist block', () {
      final block = AiContentBlock.fromJson({
        'type': 'build_checklist',
        'buildId': 'build-9',
        'projectId': 'proj-9',
        'readyCount': 2,
        'totalRequired': 5,
        'items': [
          {
            'componentId': 'cmp-9',
            'name': 'Battery pack',
            'status': 'READY',
            'readinessLabel': 'Linked material',
            'linkedMaterialId': 'mat-9',
          },
        ],
      });

      expect(block.type, 'build_checklist');
      expect(block.buildId, 'build-9');
      expect(block.readyCount, 2);
      expect(block.totalRequired, 5);
      expect(block.checklistItems.first.linkedMaterialId, 'mat-9');
    });

    test('parses component_matches block', () {
      final block = AiContentBlock.fromJson({
        'type': 'component_matches',
        'buildId': 'build-2',
        'groups': [
          {
            'componentId': 'cmp-2',
            'componentName': 'Servo motor',
            'materials': [
              {
                'materialId': 'mat-3',
                'title': 'Mini servo',
                'priceLabel': 'Free',
              },
            ],
          },
        ],
      });

      expect(block.type, 'component_matches');
      expect(block.buildId, 'build-2');
      expect(block.matchGroups, hasLength(1));
      expect(block.matchGroups.first.componentName, 'Servo motor');
      expect(block.matchGroups.first.materials.first.materialId, 'mat-3');
    });

    test('parses component_matches block with empty materials', () {
      final block = AiContentBlock.fromJson({
        'type': 'component_matches',
        'groups': [
          {
            'componentId': 'cmp-3',
            'componentName': 'Ultrasonic sensor',
            'materials': [],
          },
        ],
      });

      expect(block.type, 'component_matches');
      expect(block.matchGroups, hasLength(1));
      expect(block.matchGroups.first.materials, isEmpty);
    });

    test('parses project_budget_estimate block', () {
      final block = AiContentBlock.fromJson({
        'type': 'project_budget_estimate',
        'projectId': 'proj-1',
        'projectTitle': 'Obstacle Avoidance Robot',
        'estimateStatus': 'COMPLETE',
        'estimatedSubtotalNis': 52,
        'currency': 'NIS',
        'requiredComponentCount': 4,
        'pricedComponentCount': 4,
        'missingComponentCount': 0,
        'unpricedComponentCount': 0,
        'deliveryExcludedNotice': 'Delivery excluded.',
        'components': [
          {
            'componentId': 'comp-1',
            'componentName': 'Arduino board',
            'requiredQuantity': 1,
            'status': 'SELECTED',
            'selectedMaterialId': 'mat-1',
            'selectedMaterialTitle': 'Salvaged Arduino Uno Boards',
            'isFree': false,
            'unitPrice': 32,
            'effectiveComponentCost': 32,
            'alternativesCount': 1,
          },
          {
            'componentId': 'comp-2',
            'componentName': 'Ultrasonic distance sensor',
            'requiredQuantity': 1,
            'status': 'SELECTED',
            'selectedMaterialId': 'mat-2',
            'selectedMaterialTitle': 'Free Workshop Ultrasonic Sensors',
            'isFree': true,
            'unitPrice': 0,
            'effectiveComponentCost': 0,
            'alternativesCount': 2,
          },
        ],
      });

      expect(block.type, 'project_budget_estimate');
      expect(block.budgetEstimate?.projectTitle, 'Obstacle Avoidance Robot');
      expect(block.budgetEstimate?.estimatedSubtotalNis, 52);
      expect(block.budgetEstimate?.components, hasLength(2));
      expect(block.budgetEstimate?.components.first.effectiveComponentCost, 32);
    });

    test('parses comparison block', () {
      final block = AiContentBlock.fromJson({
        'type': 'comparison',
        'subject': 'MATERIAL',
        'items': [
          {
            'id': 'mat-a',
            'title': 'Plywood',
            'facts': ['Lightweight', 'Easy to cut'],
          },
          {
            'id': 'mat-b',
            'title': 'Acrylic',
            'facts': ['Transparent', 'Rigid'],
          },
        ],
      });

      expect(block.type, 'comparison');
      expect(block.comparisonSubject, 'MATERIAL');
      expect(block.comparisonItems, hasLength(2));
      expect(block.comparisonItems.first.facts, ['Lightweight', 'Easy to cut']);
    });

    test('parses recommendations block', () {
      final block = AiContentBlock.fromJson({
        'type': 'recommendations',
        'recommendationType': 'NEXT_ACTIONS',
        'items': [
          {
            'itemType': 'ACTION',
            'itemId': 'act-1',
            'title': 'Reserve wood panels',
            'reasons': ['Matches your build', 'Nearby pickup'],
          },
        ],
      });

      expect(block.type, 'recommendations');
      expect(block.recommendationType, 'NEXT_ACTIONS');
      expect(block.recommendationItems.first.itemType, 'ACTION');
      expect(block.recommendationItems.first.reasons, hasLength(2));
    });

    test('parses action_confirmation block', () {
      final block = AiContentBlock.fromJson({
        'type': 'action_confirmation',
        'pendingActionId': 'pending-1',
        'actionType': 'RESERVE_MATERIAL',
        'title': 'Reserve material?',
        'summary': 'Reserve 4 wood panels for your build.',
        'target': {
          'type': 'MATERIAL',
          'id': 'mat-4',
          'title': 'Wood panels',
        },
        'expiresAt': '2026-07-15T12:00:00.000Z',
        'confirmLabel': 'Reserve',
        'cancelLabel': 'Not now',
      });

      expect(block.type, 'action_confirmation');
      expect(block.pendingActionId, 'pending-1');
      expect(block.actionType, 'RESERVE_MATERIAL');
      expect(block.actionTarget?.id, 'mat-4');
      expect(block.confirmLabel, 'Reserve');
      expect(block.expiresAt, isNotNull);
    });

    test('parses grouped build ownership confirmation block', () {
      final block = AiContentBlock.fromJson({
        'type': 'action_confirmation',
        'pendingActionId': 'pending-build-1',
        'actionType': 'UPDATE_BUILD_COMPONENT_STATUSES',
        'title': 'Mark components as already owned?',
        'summary':
            'I will mark these components as already owned:\n- LED\n- Resistor',
        'target': {
          'type': 'BUILD',
          'id': 'build-1',
          'title': 'Solar night light',
        },
        'confirmLabel': 'Confirm',
        'cancelLabel': 'Cancel',
      });

      expect(block.actionType, 'UPDATE_BUILD_COMPONENT_STATUSES');
      expect(block.actionSummary, contains('LED'));
      expect(block.actionSummary, contains('Resistor'));
      expect(block.actionTarget?.type, 'BUILD');
    });

    test('parses action_result block', () {
      final block = AiContentBlock.fromJson({
        'type': 'action_result',
        'actionType': 'RESERVE_MATERIAL',
        'status': 'EXECUTED',
        'title': 'Reservation created',
        'summary': 'Wood panels are reserved for pickup.',
        'target': {
          'type': 'MATERIAL',
          'id': 'mat-4',
          'title': 'Wood panels',
        },
      });

      expect(block.type, 'action_result');
      expect(block.actionStatus, 'EXECUTED');
      expect(block.actionSummary, 'Wood panels are reserved for pickup.');
      expect(block.actionTarget?.title, 'Wood panels');
    });

    test('parses external_sources block', () {
      final block = AiContentBlock.fromJson({
        'type': 'external_sources',
        'items': [
          {
            'title': 'Arduino reference',
            'url': 'https://example.com/arduino',
            'snippet': 'Official documentation',
          },
        ],
      });

      expect(block.type, 'external_sources');
      expect(block.externalSources, hasLength(1));
      expect(block.externalSources.first.url, 'https://example.com/arduino');
      expect(block.externalSources.first.snippet, 'Official documentation');
    });

    test('degrades unknown block types safely', () {
      final block = AiContentBlock.fromJson({
        'type': 'future_block',
        'payload': {'foo': 'bar'},
      });

      expect(block.type, 'future_block');
      expect(block.text, isNull);
      expect(block.materialItems, isEmpty);
      expect(block.projectItems, isEmpty);
    });

    test('filters invalid nested items without failing entire block', () {
      final block = AiContentBlock.fromJson({
        'type': 'material_results',
        'items': [
          {'title': 'Missing id'},
          {
            'materialId': 'mat-valid',
            'title': 'Valid item',
            'priceLabel': 'Free',
          },
        ],
      });

      expect(block.materialItems, hasLength(1));
      expect(block.materialItems.single.materialId, 'mat-valid');
    });

    test('parses recommendations block with project and material items', () {
      final block = AiContentBlock.fromJson({
        'type': 'recommendations',
        'recommendationType': 'PROJECTS',
        'items': [
          {
            'itemType': 'PROJECT',
            'itemId': 'proj-1',
            'title': 'Simple LED Circuit',
            'reasons': ['يطابق اهتمامك بالإلكترونيات'],
            'difficulty': 'BEGINNER',
            'estimatedTimeLabel': '30 min',
          },
          {
            'itemType': 'MATERIAL',
            'itemId': 'mat-1',
            'title': 'Resistor Kit',
            'reasons': ['تتوفر بعض مكوناته حاليًا'],
            'priceLabel': 'Free',
            'categoryLabel': 'Electronics',
          },
        ],
      });

      expect(block.type, 'recommendations');
      expect(block.recommendationType, 'PROJECTS');
      expect(block.recommendationItems, hasLength(2));
      expect(block.recommendationItems.first.itemType, 'PROJECT');
      expect(block.recommendationItems.first.primaryReason, 'يطابق اهتمامك بالإلكترونيات');
      expect(block.recommendationItems.last.itemType, 'MATERIAL');
    });
  });
}
