import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/profile/presentation/pages/profile_page.dart';

void main() {
  test('learnerProfileCompletionHint returns null when profile is complete', () {
    expect(
      learnerProfileCompletionHint(
        missingInterests: false,
        missingBio: false,
      ),
      isNull,
    );
  });

  test('learnerProfileCompletionHint handles missing interests only', () {
    expect(
      learnerProfileCompletionHint(
        missingInterests: true,
        missingBio: false,
      ),
      const LearnerProfileCompletionHintCopy(
        title: 'Add your interests',
        body: 'Add interests to improve project suggestions.',
      ),
    );
  });

  test('learnerProfileCompletionHint handles missing bio only', () {
    expect(
      learnerProfileCompletionHint(
        missingInterests: false,
        missingBio: true,
      ),
      const LearnerProfileCompletionHintCopy(
        title: 'Add a short bio',
        body: 'Add a short bio to help personalize project suggestions.',
      ),
    );
  });

  test('learnerProfileCompletionHint handles missing bio and interests', () {
    expect(
      learnerProfileCompletionHint(
        missingInterests: true,
        missingBio: true,
      ),
      const LearnerProfileCompletionHintCopy(
        title: 'Complete your learner profile',
        body: 'Add interests and a short bio to get better project suggestions.',
      ),
    );
  });
}
