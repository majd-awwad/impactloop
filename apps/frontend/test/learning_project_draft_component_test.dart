import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/learning_hub/domain/models/learning_project_draft_component.dart';

void main() {
  group('LearningProjectDraftComponent', () {
    test('toSubmitPayload maps structured fields', () {
      final payload = LearningProjectDraftComponent(
        name: 'Ultrasonic sensor',
        quantity: 2,
        unit: 'piece',
        role: LearningProjectComponentRole.material,
        materialCategoryId: '11111111-1111-4111-8111-111111111111',
        materialTypeHint: 'Distance sensor',
        keywords: const ['hc-sr04'],
        canBeSubstituted: true,
        notes: 'Any HC-SR04 variant',
      ).toSubmitPayload();

      expect(payload['name'], 'Ultrasonic sensor');
      expect(payload['quantity'], 2);
      expect(payload['unit'], 'piece');
      expect(payload['componentRole'], 'REQUIRED_MATERIAL');
      expect(payload['materialType'], 'Distance sensor');
      expect(payload['categoryId'], '11111111-1111-4111-8111-111111111111');
      expect(payload['searchKeywords'], ['hc-sr04']);
      expect(payload['canBeSubstituted'], isTrue);
      expect(payload['notes'], 'Any HC-SR04 variant');
    });

    test('fromLegacyCommaSeparated migrates comma-separated names', () {
      final components =
          LearningProjectDraftComponent.fromLegacyCommaSeparated(
            'Arduino Uno, LED, jumper wires',
          );

      expect(components, hasLength(3));
      expect(components.first.name, 'Arduino Uno');
      expect(components.last.name, 'jumper wires');
    });

    test('toSubmitPayload omits invalid material category values', () {
      final payload = const LearningProjectDraftComponent(
        name: 'LED',
        materialCategoryId: 'None',
      ).toSubmitPayload();

      expect(payload.containsKey('categoryId'), isFalse);
    });

    test('toSubmitPayload includes pending keyword draft', () {
      final payload = const LearningProjectDraftComponent(
        name: 'LED',
        keywordDraft: 'diode',
      ).toSubmitPayload();

      expect(payload['searchKeywords'], ['diode']);
    });

    test('normalizeMaterialCategoryId rejects sentinel values', () {
      expect(
        LearningProjectDraftComponent.normalizeMaterialCategoryId('None'),
        isNull,
      );
      expect(
        LearningProjectDraftComponent.normalizeMaterialCategoryId(''),
        isNull,
      );
    });

    test('validate requires component name', () {
      final component = const LearningProjectDraftComponent(name: '');
      expect(
        component.validate(requireName: true),
        'Component name is required.',
      );
    });
  });
}
