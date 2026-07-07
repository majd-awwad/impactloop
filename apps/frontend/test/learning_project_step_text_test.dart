import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/learning_hub/domain/models/learning_project_step_text.dart';

void main() {
  group('LearningProjectStepText', () {
    test('formatStepsForEditing shows plain descriptions only', () {
      final text = LearningProjectStepText.formatStepsForEditing([
        (title: 'Step 1', description: 'Prepare the board'),
        (title: 'Step 2', description: 'Wire the sensor'),
      ]);

      expect(text, 'Prepare the board\nWire the sensor');
    });

    test('stripStepPrefix removes common step labels', () {
      expect(
        LearningProjectStepText.stripStepPrefix('Step 1: Prepare'),
        'Prepare',
      );
      expect(
        LearningProjectStepText.stripStepPrefix('Step 2 - Mount parts'),
        'Mount parts',
      );
      expect(LearningProjectStepText.stripStepPrefix('1. Solder pins'), 'Solder pins');
      expect(LearningProjectStepText.stripStepPrefix('1) Test output'), 'Test output');
    });

    test('parseStepsFromText stores clean descriptions with generated titles', () {
      final steps = LearningProjectStepText.parseStepsFromText(
        'Step 1: Prepare\nFinal testing',
      );

      expect(steps, hasLength(2));
      expect(steps[0]['title'], 'Step 1');
      expect(steps[0]['description'], 'Prepare');
      expect(steps[1]['title'], 'Step 2');
      expect(steps[1]['description'], 'Final testing');
    });
  });
}
