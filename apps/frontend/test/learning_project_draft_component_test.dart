import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/learning_hub/domain/models/learning_project_draft_component.dart';

void main() {
  group('LearningProjectDraftComponent', () {
    test('toSubmitPayload maps structured fields with cuid category id', () {
      const categoryId = 'clxyz1234567890abcdefghij';
      final payload = LearningProjectDraftComponent(
        name: 'Ultrasonic sensor',
        quantity: 2,
        unit: 'piece',
        role: LearningProjectComponentRole.material,
        materialCategoryId: categoryId,
        materialTypeHint: 'Distance sensor',
        keywords: const ['hc-sr04'],
        canBeSubstituted: true,
        notes: 'Any HC-SR04 variant',
      ).toSubmitPayload();

      expect(payload['name'], 'Ultrasonic sensor');
      expect(payload['categoryId'], categoryId);
      expect(payload['searchKeywords'], ['hc-sr04']);
    });

    test('mergeKeywords splits comma-separated draft text', () {
      final merged = LearningProjectDraftComponent.mergeKeywords(
        existing: const [],
        draft: 'arduino, microcontroller',
      );

      expect(merged, ['arduino', 'microcontroller']);
    });

    test('mergeKeywords dedupes case-insensitively and enforces max 5', () {
      final merged = LearningProjectDraftComponent.mergeKeywords(
        existing: const ['Arduino'],
        draft: 'arduino; UNO, nano, chip, board, extra',
      );

      expect(merged, hasLength(5));
      expect(merged.first, 'Arduino');
      expect(merged.contains('UNO'), isTrue);
    });

    test('resolvedKeywords includes pending keyword draft on save', () {
      const component = LearningProjectDraftComponent(
        name: 'LED',
        keywords: const ['diode'],
        keywordDraft: 'light',
      );

      expect(component.resolvedKeywords(), ['diode', 'light']);
    });

    test('normalizeMaterialCategoryId accepts cuid values', () {
      expect(
        LearningProjectDraftComponent.normalizeMaterialCategoryId(
          'clxyz1234567890abcdefghij',
        ),
        'clxyz1234567890abcdefghij',
      );
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
